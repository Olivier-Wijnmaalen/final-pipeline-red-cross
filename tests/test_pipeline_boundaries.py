import unittest
from types import SimpleNamespace

from dema import config, pipeline
from dema.llm import UnusableResponseError, create_json_response, parse_json_response
from dema.prompts import scoring_prompt_snapshot


class PipelineBoundaryTests(unittest.TestCase):
    def test_json_response_accepts_fenced_object(self):
        self.assertEqual(
            parse_json_response('```json\n{"ok": true}\n```'),
            {"ok": True},
        )

    def test_invalid_json_is_reported_as_an_unusable_response(self):
        response = SimpleNamespace(status="completed", output_text="{not-json")
        client = SimpleNamespace(
            responses=SimpleNamespace(create=lambda **kwargs: response)
        )
        with self.assertRaises(UnusableResponseError) as raised:
            create_json_response(
                client=client,
                model="test-model",
                input_text="test",
                temperature=0,
                max_output_tokens=100,
            )
        self.assertIs(raised.exception.response, response)

    def test_stage1_accepts_exact_quote_and_preserves_traceability(self):
        metadata = {
            "source_id": "001",
            "source_file": "001_chunk.md",
            "source_url": "https://example.test/source",
            "processing_unit_id": "001_chunk",
            "relative_path": "001/001_chunk.md",
        }
        row = {
            "evidence_id": "E-001",
            "subdimension": "A.1",
            "evidence_scope": "country",
            "country_specificity": "Togo",
            "supporting_quote": "Exact quotation",
            "evidence_statement": "A statement",
            "interpretation_boundary": "Documentary evidence only",
            "page_number": "1",
        }

        accepted, rejected, errors = pipeline.validate_stage1(
            {"source_id": "001", "source_file": "001_chunk.md", "source_url": "https://example.test/source", "processing_unit_id": "001_chunk", "dema_evidence_rows": [row]},
            "Text with Exact quotation in it.", metadata
        )

        self.assertFalse(rejected)
        self.assertFalse(errors)
        self.assertEqual(accepted[0]["source_chunk"], "001/001_chunk.md")
        self.assertEqual(accepted[0]["quotation_verification"], "matched")
        self.assertEqual(
            accepted[0]["stage1_prompt_version"],
            config.EXTRACTION_PROMPT_VERSION,
        )

    def test_stage1_flags_but_keeps_non_verbatim_quote(self):
        metadata = {
            "source_id": "001",
            "source_file": "001_chunk.md",
            "source_url": "",
            "processing_unit_id": "001_chunk",
            "relative_path": "001/001_chunk.md",
        }
        row = {
            "evidence_id": "E-002",
            "subdimension": "A.1",
            "evidence_scope": "country",
            "country_specificity": "Togo",
            "supporting_quote": "Not present",
            "evidence_statement": "A statement",
            "interpretation_boundary": "Documentary evidence only",
            "page_number": "1",
        }

        accepted, rejected, findings = pipeline.validate_stage1(
            {"source_id": "001", "source_file": "001_chunk.md", "source_url": "", "processing_unit_id": "001_chunk", "dema_evidence_rows": [row]},
            "Different source text", metadata
        )

        self.assertFalse(rejected)
        self.assertEqual(accepted[0]["quotation_verification"], "unmatched")
        self.assertIn("not an exact contiguous source substring", findings[0])

    def test_stage1_does_not_mark_metadata_only_quote_as_matched(self):
        metadata = {
            "source_id": "metadata-only-value",
            "source_file": "001_chunk.md",
            "source_url": "https://example.test/source",
            "processing_unit_id": "001_chunk",
            "relative_path": "001/001_chunk.md",
        }
        row = {
            "evidence_id": "E-003",
            "subdimension": "A.1",
            "evidence_scope": "country",
            "country_specificity": "Togo",
            "supporting_quote": "metadata-only-value",
            "evidence_statement": "A statement",
            "interpretation_boundary": "Documentary evidence only",
            "page_number": "1",
        }

        accepted, rejected, findings = pipeline.validate_stage1(
            {"source_id": "metadata-only-value", "source_file": "001_chunk.md", "source_url": "https://example.test/source", "processing_unit_id": "001_chunk", "dema_evidence_rows": [row]},
            "Actual source body", metadata
        )

        self.assertFalse(rejected)
        self.assertEqual(accepted[0]["quotation_verification"], "unmatched")
        self.assertTrue(findings)

    def test_cache_keys_require_an_exact_match(self):
        expected = {"country": "Togo", "model": "deployment-a"}
        self.assertTrue(pipeline.cache_key_matches({"cache_key": expected}, expected))
        self.assertFalse(
            pipeline.cache_key_matches(
                {"cache_key": {"country": "Togo"}}, expected
            )
        )
        self.assertFalse(pipeline.cache_key_matches({}, expected))

    def test_artifact_path_components_cannot_traverse(self):
        component = pipeline.artifact_path_component("../../restricted/source")
        self.assertNotIn("/", component)
        self.assertNotIn("\\", component)
        self.assertNotIn("..", component)

    def test_scoring_scope_is_derived_from_prompt(self):
        prompt = (
            "INDICATOR A1.1 — Actor roles\n"
            "INDICATOR B.2.1. — Interoperability\n"
        )
        self.assertEqual(
            pipeline.extract_scoring_scope(prompt),
            [
                {"indicator_code": "A.1.1", "indicator_name": "Actor roles"},
                {"indicator_code": "B.2.1", "indicator_name": "Interoperability"},
            ],
        )

    def test_evidence_aggregation_preserves_items_and_rejects_duplicate_ids(self):
        base = [{"evidence_id": "BASE-1", "supporting_quote": "Base"}]
        extracted = [{"evidence_id": "NEW-1", "supporting_quote": "New"}]
        combined = pipeline.combine_evidence_items(base, extracted)
        self.assertEqual([item["evidence_id"] for item in combined], ["BASE-1", "NEW-1"])
        with self.assertRaisesRegex(ValueError, "duplicates"):
            pipeline.combine_evidence_items(base, [{"evidence_id": "BASE-1"}])

    def test_stage2_reports_unknown_evidence_ids_without_mutating_output(self):
        result = {
            "country": "Togo",
            "framework_version": "test",
            "assessment_summary": "Test",
            "indicator_assessments": [
                {
                    "indicator_code": "A.1.1",
                    "indicator_name": "Actor roles",
                    "phase_score": 3,
                    "matched_phase_requirement": "Requirement",
                    "evidence_supporting_score": ["UNKNOWN"],
                    "contrary_or_limiting_evidence": [],
                    "assigned_phase_requirement_checks": [
                        {"requirement": "Requirement", "status": "SUPPORTED", "evidence_ids": ["UNKNOWN"], "explanation": "Explanation"}
                    ],
                    "score_reasoning": "Short reasoning is operationally valid.",
                    "contrary_or_limiting_reasoning": "",
                    "next_phase_gap": "Gap",
                    "framework_ambiguity": "",
                }
            ]
        }
        original = result.copy()
        warnings = pipeline.validate_stage2(
            result,
            [{"indicator_code": "A.1.1", "indicator_name": "Actor roles"}],
        )
        findings = pipeline.stage2_quality_findings(result, {"E-001"})
        self.assertIsNone(warnings)
        self.assertEqual(findings[0]["values"], ["UNKNOWN"])
        self.assertEqual(result, original)

    def test_scoring_batches_are_uniform_and_have_no_indicator_retry(self):
        scope = [
            {"indicator_code": f"A.1.{index}", "indicator_name": str(index)}
            for index in range(1, 6)
        ]
        batches = pipeline.build_scoring_batches(scope)
        self.assertEqual([len(batch) for batch in batches], [2, 2, 1])
        self.assertEqual([item for batch in batches for item in batch], scope)

    def test_scoring_prompt_snapshot_preserves_reproducibility_fields(self):
        prompt = SimpleNamespace(
            name="scoring",
            version=3,
            prompt="Line 1\nLine 2",
            config={"temperature": 0},
        )
        snapshot = scoring_prompt_snapshot(prompt)
        self.assertEqual(snapshot["name"], "scoring")
        self.assertEqual(snapshot["version"], 3)
        self.assertEqual(snapshot["config"], {"temperature": 0})
        self.assertEqual(snapshot["prompt"], prompt.prompt)
        self.assertNotEqual(snapshot["api_sha256"], snapshot["crlf_sha256"])


if __name__ == "__main__":
    unittest.main()
