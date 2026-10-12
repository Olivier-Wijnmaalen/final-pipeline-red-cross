"""Essential output checks and non-destructive QA for the DEMA pipeline.

These checks protect technical reliability only. They do not score model
quality or alter model output to satisfy research criteria.
"""

from __future__ import annotations

from collections import Counter
from typing import Any

from .config import EXTRACTION_PROMPT_NAME, EXTRACTION_PROMPT_VERSION

STAGE1_REQUIRED_TOP_LEVEL_FIELDS = {
    "source_id",
    "source_file",
    "source_url",
    "processing_unit_id",
    "dema_evidence_rows",
}
STAGE1_REQUIRED_ROW_FIELDS = {
    "evidence_id",
    "subdimension",
    "evidence_scope",
    "country_specificity",
    "supporting_quote",
    "evidence_statement",
    "interpretation_boundary",
    "page_number",
}
STAGE2_REQUIRED_TOP_LEVEL_FIELDS = {
    "country",
    "framework_version",
    "assessment_summary",
    "indicator_assessments",
}
STAGE2_REQUIRED_ASSESSMENT_FIELDS = {
    "indicator_code",
    "indicator_name",
    "phase_score",
    "matched_phase_requirement",
    "score_reasoning",
    "evidence_supporting_score",
    "contrary_or_limiting_evidence",
    "contrary_or_limiting_reasoning",
    "next_phase_gap",
    "assigned_phase_requirement_checks",
    "framework_ambiguity",
}
STAGE2_REQUIRED_CHECK_FIELDS = {
    "requirement", "status", "evidence_ids", "explanation",
}
STAGE2_STRING_FIELDS = {
    "indicator_code",
    "indicator_name",
    "matched_phase_requirement",
    "score_reasoning",
    "contrary_or_limiting_reasoning",
    "next_phase_gap",
    "framework_ambiguity",
}


def combine_evidence_items(
    base_items: list[dict[str, Any]],
    extracted_items: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Combine evidence while requiring unique, nonblank identifiers."""
    combined = [dict(item) for item in base_items] + [dict(item) for item in extracted_items]
    identifiers = [str(item.get("evidence_id", "")).strip() for item in combined]
    blanks = [index for index, value in enumerate(identifiers) if not value]
    duplicates = sorted(
        value for value, count in Counter(identifiers).items() if value and count > 1
    )
    if blanks or duplicates:
        raise ValueError(f"Combined evidence IDs invalid: blanks={blanks}, duplicates={duplicates}")
    return combined


def validate_stage1(
    data: dict[str, Any],
    source_text: str,
    metadata: dict[str, str],
    *,
    prompt_name: str = EXTRACTION_PROMPT_NAME,
    prompt_version: int = EXTRACTION_PROMPT_VERSION,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[str]]:
    """Return structurally usable rows, unusable rows, and optional QA findings."""
    missing_top_level = sorted(STAGE1_REQUIRED_TOP_LEVEL_FIELDS - set(data))
    if missing_top_level:
        raise ValueError(f"Stage 1 output lacks required fields: {missing_top_level}")
    rows = data["dema_evidence_rows"]
    if not isinstance(rows, list):
        raise ValueError("Stage 1 output lacks a dema_evidence_rows array")

    usable: list[dict[str, Any]] = []
    unusable: list[dict[str, Any]] = []
    findings: list[str] = []
    for index, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            unusable.append({"row_index": index, "row": row, "reasons": ["not_an_object"]})
            continue
        reasons: list[str] = []
        missing = sorted(STAGE1_REQUIRED_ROW_FIELDS - set(row))
        if missing:
            reasons.append("missing_fields:" + ",".join(missing))
        wrong_types = sorted(
            field for field in STAGE1_REQUIRED_ROW_FIELDS
            if field in row and not isinstance(row[field], str)
        )
        if wrong_types:
            reasons.append("fields_must_be_strings:" + ",".join(wrong_types))
        if not str(row.get("evidence_id", "")).strip():
            reasons.append("blank_evidence_id")
        if reasons:
            unusable.append({"row_index": index, "row": row, "reasons": reasons})
            continue

        quote = row["supporting_quote"]
        if not quote:
            quote_status = "empty"
            findings.append(f"row {index}: supporting_quote is empty")
        elif quote in source_text:
            quote_status = "matched"
        else:
            quote_status = "unmatched"
            findings.append(
                f"row {index}: supporting_quote is not an exact contiguous source substring"
            )
        usable.append(
            {
                **row,
                "source_id": metadata["source_id"],
                "source_file": metadata["source_file"],
                "source_url": metadata["source_url"],
                "processing_unit_id": metadata["processing_unit_id"],
                "source_chunk": metadata["relative_path"],
                "stage1_prompt_name": prompt_name,
                "stage1_prompt_version": prompt_version,
                "quotation_verification": quote_status,
            }
        )

    if data.get("source_id") not in (None, "", metadata["source_id"]):
        findings.append("top_level_source_id_mismatch")
    if data.get("processing_unit_id") not in (None, "", metadata["processing_unit_id"]):
        findings.append("top_level_processing_unit_id_mismatch")
    return usable, unusable, findings


def validate_stage2(data: dict[str, Any], scoring_scope: list[dict[str, str]]) -> None:
    """Require the fields and types needed by the adapter and reviewers."""
    missing_top_level = sorted(STAGE2_REQUIRED_TOP_LEVEL_FIELDS - set(data))
    if missing_top_level:
        raise ValueError(f"Stage 2 output lacks required fields: {missing_top_level}")
    assessments = data["indicator_assessments"]
    if not isinstance(assessments, list):
        raise ValueError("Stage 2 output lacks indicator_assessments")

    received: list[str] = []
    for item in assessments:
        if not isinstance(item, dict):
            raise ValueError("Stage 2 assessments must be JSON objects")
        missing = sorted(STAGE2_REQUIRED_ASSESSMENT_FIELDS - set(item))
        if missing:
            raise ValueError(f"Stage 2 assessment lacks required fields: {missing}")
        code = item["indicator_code"]
        if any(not isinstance(item[field], str) for field in STAGE2_STRING_FIELDS):
            raise ValueError(f"{code} has a non-string required text field")
        received.append(code)
        if type(item["phase_score"]) is not int or not 1 <= item["phase_score"] <= 5:
            raise ValueError(f"Invalid phase score for {code}")
        for field in ("evidence_supporting_score", "contrary_or_limiting_evidence"):
            identifiers = item[field]
            if not isinstance(identifiers, list) or any(not isinstance(value, str) for value in identifiers):
                raise ValueError(f"{code}.{field} must be an array of strings")
        checks = item["assigned_phase_requirement_checks"]
        if not isinstance(checks, list):
            raise ValueError(f"{code}.assigned_phase_requirement_checks is not an array")
        for check in checks:
            if not isinstance(check, dict):
                raise ValueError(f"{code} requirement checks must be objects")
            missing_check = sorted(STAGE2_REQUIRED_CHECK_FIELDS - set(check))
            if missing_check:
                raise ValueError(f"{code} requirement check lacks fields: {missing_check}")
            if not isinstance(check["evidence_ids"], list) or any(
                not isinstance(value, str) for value in check["evidence_ids"]
            ):
                raise ValueError(
                    f"{code} requirement check evidence_ids must be an array of strings"
                )
            if any(
                not isinstance(check[field], str)
                for field in ("requirement", "status", "explanation")
            ):
                raise ValueError(f"{code} requirement check has a non-string required field")

    expected = [item["indicator_code"] for item in scoring_scope]
    if len(received) != len(set(received)) or set(received) != set(expected):
        raise ValueError(f"Stage 2 indicator mismatch: expected {expected}, received {received}")


def stage2_quality_findings(
    data: dict[str, Any], evidence_ids: set[str]
) -> list[dict[str, Any]]:
    """Report unresolved references without changing or rejecting model output."""
    findings: list[dict[str, Any]] = []
    for assessment in data.get("indicator_assessments", []):
        for field in ("evidence_supporting_score", "contrary_or_limiting_evidence"):
            unknown = [value for value in assessment.get(field, []) if value not in evidence_ids]
            if unknown:
                findings.append(
                    {
                        "indicator_code": assessment.get("indicator_code", "unknown"),
                        "field": field,
                        "issue": "unknown_evidence_references",
                        "values": unknown,
                    }
                )
    return findings
