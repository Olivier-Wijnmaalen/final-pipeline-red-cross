"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DemaRadar, RadarMode } from "@/components/DemaRadar";
import {
  assertDashboardData,
  DashboardData,
  Indicator,
  indicators,
} from "@/lib/contract";

const states = [
  "Uploaded",
  "Preparing document",
  "Extracting evidence",
  "Checking output structure",
  "Building evidence bank",
  "Scoring indicators",
  "Building dashboard",
  "Complete",
  "Failed",
];
type Dimension = DashboardData["dimensions"][number];
type Subdimension = Dimension["subdimensions"][number];

function average(items: Indicator[]) {
  const values = items.flatMap((item) =>
    typeof item.phase_score === "number" ? [item.phase_score] : [],
  );
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}
function dimensionIndicators(dimension: Dimension) {
  return dimension.subdimensions.flatMap((item) => item.indicators);
}

function SiteHeader({ onNew }: { onNew?: () => void }) {
  return (
    <header className="institutional-header">
      <div className="brand-mark">
        <span>DEMA</span>
      </div>
      <div className="site-title">
        <b>Data Ecosystem Maturity Assessment</b>
        <small>Documentary pre-assessment pipeline</small>
      </div>
      <nav>
        <span>INTERNAL</span>
        {onNew && <button onClick={onNew}>New assessment</button>}
      </nav>
    </header>
  );
}

function EvidenceCard({
  item,
}: {
  item: Indicator["supporting_evidence"][number];
}) {
  const url = item.source_url || item.reference_source_url;
  return (
    <article className="evidence-card">
      <div className="evidence-top">
        <span>{item.evidence_id}</span>
        {item.quotation_verification && (
          <b className={item.quotation_verification}>
            {item.quotation_verification} quote
          </b>
        )}
      </div>
      <p>{item.evidence_statement}</p>
      {item.quotation_verification &&
        item.quotation_verification !== "matched" && (
          <div className="qa-alert">
            Verify this quotation against the source before relying on it.
          </div>
        )}
      {item.supporting_quote && (
        <blockquote>“{item.supporting_quote}”</blockquote>
      )}
      <div className="evidence-source">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer">
            {item.source_file || "Open source"}
          </a>
        ) : (
          item.source_file || "Source unavailable"
        )}
        {item.page_number && ` · p. ${item.page_number}`}
      </div>
    </article>
  );
}

function ScoreOverview({
  data,
  onSelect,
}: {
  data: DashboardData;
  onSelect: (
    dimension: Dimension,
    subdimension: Subdimension,
    indicator: Indicator,
  ) => void;
}) {
  return (
    <section className="legacy-card overview">
      <div className="card-heading">
        <div>
          <p className="kicker">Full DEMA output</p>
          <h2>All dimensions, subdimensions and indicators</h2>
          <p>
            Select a row to inspect the complete reasoning and evidence trail.
          </p>
        </div>
        <b>{indicators(data).length} indicators</b>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Dimension</th>
              <th>Subdimension</th>
              <th>Indicator</th>
              <th>Phase</th>
              <th>Evidence</th>
              <th>Review</th>
            </tr>
          </thead>
          <tbody>
            {data.dimensions.flatMap((dimension) =>
              dimension.subdimensions.flatMap((subdimension) =>
                subdimension.indicators.map((indicator) => (
                  <tr
                    key={indicator.indicator_code}
                    onClick={() => onSelect(dimension, subdimension, indicator)}
                  >
                    <td>
                      <b style={{ color: dimension.color }}>{dimension.id}</b>
                    </td>
                    <td>{subdimension.label}</td>
                    <td>
                      <small>{indicator.indicator_code}</small>
                      <strong>{indicator.indicator_name}</strong>
                    </td>
                    <td>
                      <span
                        className="phase-square"
                        style={{ background: dimension.color }}
                      >
                        {indicator.phase_score ?? "—"}
                      </span>
                      <small>{indicator.phase_name}</small>
                    </td>
                    <td>
                      {indicator.supporting_evidence.length +
                        indicator.limiting_evidence.length}
                    </td>
                    <td>
                      <button>Open full output</button>
                    </td>
                  </tr>
                )),
              ),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DetailPanel({
  dimension,
  subdimension,
  indicator,
  onSubdimension,
  onIndicator,
}: {
  dimension: Dimension;
  subdimension: Subdimension;
  indicator: Indicator;
  onSubdimension: (item: Subdimension) => void;
  onIndicator: (item: Indicator) => void;
}) {
  return (
    <section className="legacy-card detail-panel">
      <div className="detail-title" style={{ borderColor: dimension.color }}>
        <p>
          Dimension {dimension.id} / Subdimension {subdimension.id}
        </p>
        <div>
          <div>
            <h2>
              {indicator.indicator_code} {indicator.indicator_name}
            </h2>
            <span>
              {dimension.label} / {subdimension.label}
            </span>
          </div>
          <div className="phase-block">
            <b>{indicator.phase_score ?? "—"}</b>
            <span>{indicator.phase_name}</span>
          </div>
        </div>
      </div>
      <div className="detail-grid">
        <aside>
          <p className="aside-heading">Subdimensions</p>
          {dimension.subdimensions.map((item) => (
            <button
              key={item.id}
              className={item.id === subdimension.id ? "active" : ""}
              style={
                item.id === subdimension.id
                  ? { borderColor: dimension.color }
                  : undefined
              }
              onClick={() => onSubdimension(item)}
            >
              <b style={{ background: dimension.color }}>
                {average(item.indicators).toFixed(1)}
              </b>
              <span>{item.label}</span>
            </button>
          ))}
          <p className="aside-heading indicators-heading">Indicators</p>
          {subdimension.indicators.map((item) => (
            <button
              key={item.indicator_code}
              className={
                item.indicator_code === indicator.indicator_code ? "active" : ""
              }
              style={
                item.indicator_code === indicator.indicator_code
                  ? { borderColor: dimension.color }
                  : undefined
              }
              onClick={() => onIndicator(item)}
            >
              <b
                className="indicator-score"
                style={{ background: dimension.color }}
              >
                {item.phase_score ?? "—"}
              </b>
              <span>
                <small>{item.indicator_code}</small>
                {item.indicator_name}
              </span>
            </button>
          ))}
        </aside>
        <div className="analysis">
          <div className="analysis-intro">
            <p className="kicker">LLM provisional scoring justification</p>
            <span>
              This evidence-grounded assessment is intended for expert review.
            </span>
          </div>
          {indicator.score_status !== "scored" ? (
            <div className="empty-result">
              <h3>Insufficient documentary evidence</h3>
              <p>No score was invented for this indicator.</p>
            </div>
          ) : (
            <>
              {indicator.matched_phase_requirement && (
                <section>
                  <h3>Exact matched phase requirement</h3>
                  <blockquote
                    className="requirement"
                    style={{ borderColor: dimension.color }}
                  >
                    {indicator.matched_phase_requirement}
                  </blockquote>
                </section>
              )}
              <section>
                <h3>Scoring reasoning</h3>
                <p>{indicator.score_reasoning}</p>
              </section>
              <section className="next-gap">
                <h3>Next-phase gap</h3>
                <p>{indicator.next_phase_gap || "Not supplied."}</p>
              </section>
              <section>
                <h3>Requirement checks</h3>
                {indicator.requirement_checks.map((check, index) => (
                  <div className="requirement-check" key={index}>
                    <b>{check.status}</b>
                    <span>
                      {check.requirement ||
                        check.note ||
                        "Requirement recorded"}
                    </span>
                  </div>
                ))}
              </section>
              {indicator.unresolved_evidence_references &&
                indicator.unresolved_evidence_references.length > 0 && (
                  <section className="limitation">
                    <h3>Unresolved evidence references</h3>
                    <p>
                      The model returned IDs not found in the evidence bank:{" "}
                      {indicator.unresolved_evidence_references.join(", ")}.
                    </p>
                  </section>
                )}
              {(indicator.contrary_or_limiting_reasoning ||
                indicator.limiting_evidence.length > 0) && (
                <section className="limitation">
                  <h3>Contrary or limiting evidence</h3>
                  <p>{indicator.contrary_or_limiting_reasoning}</p>
                  <div className="evidence-grid">
                    {indicator.limiting_evidence.map((item) => (
                      <EvidenceCard key={item.evidence_id} item={item} />
                    ))}
                  </div>
                </section>
              )}
              <section>
                <div className="section-heading">
                  <div>
                    <h3>Supporting evidence</h3>
                    <h2>Audit trail</h2>
                  </div>
                  <b>{indicator.supporting_evidence.length} evidence records</b>
                </div>
                <div className="evidence-grid">
                  {indicator.supporting_evidence.map((item) => (
                    <EvidenceCard key={item.evidence_id} item={item} />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Dashboard({
  data,
  runId,
  onNew,
}: {
  data: DashboardData;
  runId: string;
  onNew: () => void;
}) {
  const all = indicators(data);
  const [mode, setMode] = useState<RadarMode>("dimensions");
  const [selectedCode, setSelectedCode] = useState(
    all[0]?.indicator_code || "",
  );
  const selected =
    all.find((item) => item.indicator_code === selectedCode) ?? all[0];
  const dimension =
    data.dimensions.find((item) =>
      item.subdimensions.some((sub) =>
        sub.indicators.some(
          (ind) => ind.indicator_code === selected.indicator_code,
        ),
      ),
    ) ?? data.dimensions[0];
  const subdimension =
    dimension.subdimensions.find((item) =>
      item.indicators.some(
        (ind) => ind.indicator_code === selected.indicator_code,
      ),
    ) ?? dimension.subdimensions[0];
  const scored = all.filter((item) => item.score_status === "scored");
  const choose = (
    nextDimension: Dimension,
    nextSubdimension: Subdimension,
    nextIndicator: Indicator,
  ) => {
    setSelectedCode(nextIndicator.indicator_code);
    setTimeout(
      () =>
        document
          .querySelector(".detail-panel")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      0,
    );
  };
  return (
    <div>
      <SiteHeader onNew={onNew} />
      <section className="assessment-hero">
        <div>
          <p>Data Ecosystem Maturity Assessment</p>
          <h1>{data.run.country} DEMA phase profile</h1>
          <span>
            Evidence-based maturity scores across the full framework hierarchy.
          </span>
        </div>
        <div className="coverage">
          <p>Assessment coverage</p>
          <div>
            <b>
              {data.dimensions.length}
              <small>dimensions</small>
            </b>
            <b>
              {data.dimensions.reduce(
                (sum, item) => sum + item.subdimensions.length,
                0,
              )}
              <small>subdimensions</small>
            </b>
            <b>
              {all.length}
              <small>indicators</small>
            </b>
          </div>
        </div>
      </section>
      <div className="assessment-notice">
        <b>{data.notice}.</b>{" "}
        {data.run.assessment_mode === "baseline_plus_document"
          ? "This run combines an approved baseline with the uploaded document."
          : "This run uses only evidence extracted from the uploaded document."}
      </div>
      <main className="dashboard-content">
        <DemaRadar
          data={data}
          mode={mode}
          onModeChange={setMode}
          selectedId={
            mode === "dimensions"
              ? dimension.id
              : mode === "subdimensions"
                ? subdimension.id
                : selected.indicator_code
          }
          onSelect={(point) => {
            const nextSub =
              point.subdimension ?? point.dimension.subdimensions[0];
            choose(
              point.dimension,
              nextSub,
              point.indicator ?? nextSub.indicators[0],
            );
          }}
        />
        <ScoreOverview data={data} onSelect={choose} />
        <div className="dimension-cards">
          {data.dimensions.map((item) => (
            <button
              key={item.id}
              className={item.id === dimension.id ? "selected" : ""}
              style={{ borderColor: item.color }}
              onClick={() =>
                choose(
                  item,
                  item.subdimensions[0],
                  item.subdimensions[0].indicators[0],
                )
              }
            >
              <small>{item.id}</small>
              <b>{item.label}</b>
              <strong style={{ color: item.color }}>
                {average(dimensionIndicators(item)).toFixed(2)}
              </strong>
            </button>
          ))}
        </div>
        <DetailPanel
          dimension={dimension}
          subdimension={subdimension}
          indicator={selected}
          onSubdimension={(item) => choose(dimension, item, item.indicators[0])}
          onIndicator={(item) => choose(dimension, subdimension, item)}
        />
        <section className="provenance legacy-card">
          <div>
            <p className="kicker">Run provenance</p>
            <h2>{runId}</h2>
            <span>
              {scored.length} scored indicators ·{" "}
              {data.run.assessment_mode.replaceAll("_", " ")}
            </span>
          </div>
          <div>
            {["evidence", "score", "manifest", "dashboard"].map((artifact) => (
              <a
                key={artifact}
                href={
                  data.run.sample
                    ? `/api/sample/artifacts/${artifact}`
                    : `/api/runs/${runId}/artifacts/${artifact}`
                }
              >
                Download {artifact}
              </a>
            ))}
          </div>
        </section>
      </main>
      <footer className="legacy-footer">
        <b>DEMA documentary pre-assessment</b>
        <span>Internal decision support · Human expert review required</span>
      </footer>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [runId, setRunId] = useState("");
  const [state, setState] = useState("");
  const [error, setError] = useState("");
  const busy = useMemo(
    () => state && state !== "Complete" && state !== "Failed",
    [state],
  );
  async function poll(id: string) {
    const response = await fetch(`/api/runs/${id}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setState(body.state);
    if (body.state === "Complete") {
      assertDashboardData(body.dashboard);
      setData(body.dashboard);
    } else if (body.state === "Failed")
      setError(body.error || "Processing failed");
    else setTimeout(() => poll(id).catch((e) => setError(e.message)), 1500);
  }
  useEffect(() => {
    const existing = new URLSearchParams(window.location.search).get("run");
    if (existing) {
      setRunId(existing);
      setState("Building dashboard");
      poll(existing).catch((e) => setError(e.message));
    }
  }, []);
  async function sample() {
    setError("");
    setState("Building dashboard");
    const response = await fetch("/api/runs/sample", { method: "POST" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    assertDashboardData(body.dashboard);
    setRunId(body.run_id);
    setState("Complete");
    setData(body.dashboard);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setData(null);
    const response = await fetch("/api/runs", {
      method: "POST",
      body: new FormData(event.currentTarget),
    });
    const body = await response.json();
    if (!response.ok) {
      setState("");
      setError(body.error);
      return;
    }
    setRunId(body.run_id);
    setState(body.state);
    window.history.replaceState({}, "", `?run=${body.run_id}`);
    poll(body.run_id).catch((reason) => setError(reason.message));
  }
  function reset() {
    setData(null);
    setState("");
    setRunId("");
    window.history.replaceState({}, "", window.location.pathname);
  }
  if (data) return <Dashboard data={data} runId={runId} onNew={reset} />;
  return (
    <div>
      <SiteHeader />
      <main className="upload-page">
        <section>
          <p className="kicker">Evidence to decision support</p>
          <h1>
            Upload one document.
            <br />
            Receive a traceable assessment.
          </h1>
          <p>
            The application prepares the source, extracts evidence, scores all
            DEMA indicators and opens the result in the dashboard.
          </p>
          <ol>
            {[
              "Prepare & chunk",
              "Extract evidence",
              "Check & aggregate",
              "Score indicators",
              "Build dashboard",
            ].map((item, index) => (
              <li key={item}>
                <b>0{index + 1}</b>
                {item}
              </li>
            ))}
          </ol>
        </section>
        <section className="upload-card">
          <p className="kicker">New assessment</p>
          <h2>Start with one source file</h2>
          <p>
            Choose a source file, confirm the country and run the assessment.
          </p>
          <form onSubmit={submit}>
            <label>
              Country
              <input
                name="country"
                defaultValue="Togo"
                required
                maxLength={80}
              />
            </label>
            <label>
              Markdown or source document
              <input
                name="document"
                type="file"
                accept=".md,.markdown,.pdf,.html,.htm,.docx"
                required
              />
              <small>
                Markdown is recommended. PDF, HTML and DOCX are also supported.
              </small>
            </label>
            <fieldset>
              <legend>Evidence mode</legend>
              <label>
                <input
                  type="radio"
                  name="mode"
                  value="document_only"
                  defaultChecked
                />{" "}
                Document only
                <small>Use only evidence extracted from this upload.</small>
              </label>
              <label>
                <input
                  type="radio"
                  name="mode"
                  value="baseline_plus_document"
                />{" "}
                Baseline + document
                <small>Requires an explicitly configured approved bank.</small>
              </label>
            </fieldset>
            <button className="run-button" disabled={!!busy}>
              Run assessment
            </button>
          </form>
          <div className="or">or</div>
          <button
            className="sample-button"
            onClick={() => sample().catch((reason) => setError(reason.message))}
            disabled={!!busy}
          >
            Open synthetic sample
          </button>
          {state && (
            <div className="progress">
              <b>{state}</b>
              <div>
                {states.map((item) => (
                  <span
                    key={item}
                    className={
                      states.indexOf(item) <= states.indexOf(state)
                        ? "done"
                        : ""
                    }
                  />
                ))}
              </div>
            </div>
          )}
          {error && <p className="error-message">{error}</p>}
          <small className="privacy">
            Local uploads and results stay in the ignored <code>runs/</code>{" "}
            directory.
          </small>
        </section>
      </main>
      <footer className="legacy-footer">
        <b>DEMA documentary pre-assessment</b>
        <span>Internal decision support · Human expert review required</span>
      </footer>
    </div>
  );
}
