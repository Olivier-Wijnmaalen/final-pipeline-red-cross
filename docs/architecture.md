# Application architecture

```text
upload -> Stage 0 -> Stage 1 -> structurally checked evidence bank -> Stage 2
       -> dashboard adapter -> dashboard-data.json -> visualizer
```

Mandatory checks stop only unusable data: invalid JSON, missing required fields
or types, duplicate/blank evidence IDs, invalid score values, or incomplete
indicator coverage. Exact quotation matching and unresolved evidence references
are written as non-destructive QA findings. No operational step rewrites model
citations or retries a particular indicator to satisfy research criteria.

The Python pipeline remains authoritative. `dema/pipeline.py` orchestrates the
stages, while `dema/validation.py` contains the small technical-validation and
QA boundary. `dashboard_adapter/` is the only translation layer. `web/` starts
jobs and displays the contract; it does not score indicators. Runs use
generated IDs and live under ignored `runs/` paths.

The web job boundary has two implementations:

- local: a detached Python worker and filesystem-backed status/artifacts;
- production: `DEMA_REMOTE_WORKER_URL`, an authenticated HTTPS worker that
  implements `POST /jobs` and writes status/artifacts to durable shared storage.

The sample route creates a run from committed fictional artifacts without
model calls. The initial interface is deliberately empty.
