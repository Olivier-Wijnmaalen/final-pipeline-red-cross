# DEMA documentary pre-assessment pipeline

A reproducible implementation of the two-stage DEMA documentary
pre-assessment pipeline, with document preparation and an internal visualizer.
It was prepared for an access-controlled Red Cross environment.

The result is a **provisional assessment for expert review**, not an autonomous
finding. Review source traceability, QA findings, and scoring reasoning before
using or sharing an assessment.

## What the repository does

```text
PDF, HTML, or Markdown
  -> Stage 0: convert to Markdown; split PDFs into 10-page chunks
  -> Stage 1: extract documentary evidence
  -> combined evidence bank + quotation QA report
  -> Stage 2: score DEMA maturity indicators
  -> reference QA report
  -> Stage 3: adapt the result for the visualizer
```

Stage 0 is optional when reviewed Markdown already exists. OCR is disabled by
design: image-only scans must first be OCR-processed and reviewed outside this
pipeline.

Stage 1 and Stage 2 remain separate model calls. The pipeline preserves raw
responses and intermediate artifacts so each stage can be inspected or rerun.
Mandatory validation is deliberately limited to parseable JSON, required
fields and types, unique evidence IDs, valid phase scores, and expected
indicator coverage. Quotation and evidence-reference matching are reported as
non-destructive QA findings; they do not rewrite the model output.

## Quick review with fictional data

The visualizer is empty by default. To inspect it without credentials or API
calls, load the committed synthetic sample:

```powershell
cd web
npm ci
npm run dev
```

Open `http://localhost:3000`, choose **Load synthetic sample**, then open the
completed assessment. The sample is fictional and is not a research result.

## Run a live assessment

### 1. Install and configure

Python 3.12 and Node.js 24 are used in CI.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
cd web
npm ci
cd ..
```

Fill in the appropriate OpenAI or Azure OpenAI values in the ignored `.env`
file. Never commit that file or any API key. See
[configuration](docs/CONFIGURATION.md) for the variables and optional Langfuse
tracing.

The approved prompts are already committed as plain text:

- `prompts/stage1-evidence-extraction.txt`
- `prompts/stage2-maturity-scoring.txt`

Their identities and SHA-256 hashes are pinned in `prompts/manifest.json`.
Langfuse access is not required at runtime.

### 2. Start the local application

```powershell
cd web
npm run dev
```

At `http://localhost:3000`:

1. enter the country;
2. upload one PDF, HTML, or Markdown file;
3. choose document-only or baseline-plus-document mode;
4. start the assessment;
5. wait for the run to complete and open the visualizer.

Document-only mode begins with an empty evidence bank. Baseline-plus-document
mode requires `DEMA_BASELINE_BANK` in `.env`; this must point to a reviewed
local evidence-bank JSON file.

The local web application starts a Python worker and stores its artifacts in
the ignored `runs/` directory. For shared deployment, use an authenticated
remote worker and durable private storage as described in
[deployment](docs/deployment.md).

## Command-line use

Prepare source documents when necessary:

```powershell
python prepare_documents.py --input data/raw --output data/prepared
```

Run Stage 1 and Stage 2 over prepared Markdown chunks:

```powershell
python main.py `
  --chunks data/prepared/chunks `
  --base-bank examples/synthetic/base_evidence_bank.json `
  --output runs/my-assessment `
  --country Togo
```

Rebuild only the dashboard data from a completed run:

```powershell
python build_dashboard.py runs/my-assessment
```

Use `python main.py --help` and `python prepare_documents.py --help` for all
options. Stage 0 and Docling installation details are in
[docs/STAGE0.md](docs/STAGE0.md).

## Outputs and inspection

Each run keeps the important boundary artifacts:

- `stage1/`: per-chunk request metadata, raw responses, parsed output,
  structurally usable and unusable rows, and quotation QA;
- `combined_evidence_bank.json`: Stage 2 input;
- `stage2/`: batch requests and responses, structurally checked scoring output,
  and unresolved-reference QA;
- `manifest.json`: run settings, prompt identities, hashes, and token usage;
- `dashboard-data.json`: stable visualizer input;
- `status.json`: web-job state.

The historical filename `final_score.validated.json` is retained for dashboard
compatibility. “Validated” here means structurally usable, not expert-approved
or research-accepted.

No historical 2 September scoring data is used by the current dashboard.

## Repository map

- `dema/`: Stage 0, model client, orchestration, storage, prompt loading, and
  technical validation;
- `dashboard_adapter/`: Stage 2 output to the stable dashboard contract;
- `web/`: upload workflow and empty-by-default visualizer;
- `prompts/`: frozen prompts, provenance, and update notes;
- `examples/synthetic/`: fictional input and output for inspection;
- `tests/`: credential-free unit and mocked orchestration tests;
- `docs/`: configuration, architecture, Stage 0, deployment, and data handling;
- `data/README.md`: expected private input layout.

Start with [architecture](docs/architecture.md) for component boundaries and
[dashboard data contract](docs/dashboard-data-contract.md) for the adapter
schema.

## Test before handover

No credentials or paid model calls are used by these checks:

```powershell
python -m unittest discover -s tests -v
cd web
npm run typecheck
npm test
npm run build
```

CI runs the same Python and web checks on pushes and pull requests.

## Data and security boundary

This repository must contain code, frozen prompts, documentation, and
fictional examples only. Real source documents, evidence banks, generated
assessments, keys, and traces are ignored and must remain in approved private
storage. Before sharing or deploying, follow [SECURITY.md](SECURITY.md) and
[security and data handling](docs/security-and-data-handling.md).

The dashboard is an internal review interface. It does not score indicators;
the Python pipeline is authoritative and `dashboard_adapter/` is the only
translation layer.
