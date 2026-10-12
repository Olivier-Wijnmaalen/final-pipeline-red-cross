# Dashboard data contract

Stage 3 reads only `dashboard-data.json`. It never interprets raw model output.
`build_dashboard.py` combines the canonical structurally checked Stage 2 result, combined
evidence bank, run manifest, and frozen framework prompt into schema version
`1.0`.

The file contains run provenance, QA warnings, 3 dimensions, 8
subdimensions, and 31 indicators. Each indicator is either `scored` with a
phase, reasoning, requirement checks, and resolved evidence objects, or
`insufficient_evidence` with a null phase. Evidence IDs that cannot be resolved
are retained as `unresolved_evidence_references` and shown as QA warnings rather
than rewritten or treated as verified evidence. Dimension and subdimension means are presentation aids;
indicator-level requirement matches remain authoritative.

Generate it for an existing completed run:

```powershell
python build_dashboard.py C:\path\to\run
```
