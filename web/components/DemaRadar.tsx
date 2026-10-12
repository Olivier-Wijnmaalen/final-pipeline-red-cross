"use client";

import { useMemo, useState } from "react";
import { DashboardData, Indicator } from "@/lib/contract";

export type RadarMode = "dimensions" | "subdimensions" | "indicators";
type Dimension = DashboardData["dimensions"][number];
type Subdimension = Dimension["subdimensions"][number];
type Point = {
  id: string;
  label: string;
  value: number;
  color: string;
  dimension: Dimension;
  subdimension?: Subdimension;
  indicator?: Indicator;
};

const SIZE = 760,
  CENTER = SIZE / 2,
  RADIUS = 258,
  TAU = Math.PI * 2;
const polar = (index: number, count: number, radius: number) => {
  const angle = -Math.PI / 2 + (index / count) * TAU;
  return {
    x: CENTER + Math.cos(angle) * radius,
    y: CENTER + Math.sin(angle) * radius,
  };
};
const polygon = (points: { x: number; y: number }[]) =>
  points.map((point) => `${point.x},${point.y}`).join(" ");
const score = (items: Indicator[]) => {
  const values = items.flatMap((item) =>
    typeof item.phase_score === "number" ? [item.phase_score] : [],
  );
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
};
const dimensionIndicators = (dimension: Dimension) =>
  dimension.subdimensions.flatMap((item) => item.indicators);

export function DemaRadar({
  data,
  mode,
  onModeChange,
  onSelect,
  selectedId,
}: {
  data: DashboardData;
  mode: RadarMode;
  onModeChange: (mode: RadarMode) => void;
  onSelect: (point: Point) => void;
  selectedId: string;
}) {
  const [hovered, setHovered] = useState<Point | null>(null);
  const points = useMemo<Point[]>(() => {
    if (mode === "dimensions")
      return data.dimensions.map((d) => ({
        id: d.id,
        label: d.label,
        value: score(dimensionIndicators(d)),
        color: d.color,
        dimension: d,
      }));
    if (mode === "subdimensions")
      return data.dimensions.flatMap((d) =>
        d.subdimensions.map((s) => ({
          id: s.id,
          label: s.label,
          value: score(s.indicators),
          color: d.color,
          dimension: d,
          subdimension: s,
        })),
      );
    return data.dimensions.flatMap((d) =>
      d.subdimensions.flatMap((s) =>
        s.indicators.map((i) => ({
          id: i.indicator_code,
          label: i.indicator_name,
          value: i.phase_score ?? 0,
          color: d.color,
          dimension: d,
          subdimension: s,
          indicator: i,
        })),
      ),
    );
  }, [data, mode]);
  const valuePoints = points.map((point, index) =>
    polar(index, points.length, (point.value / 5) * RADIUS),
  );
  const active =
    hovered ?? points.find((point) => point.id === selectedId) ?? points[0];
  return (
    <section className="legacy-card radar-card">
      <div className="card-heading">
        <div>
          <p className="kicker">Interactive maturity profile</p>
          <h2>Phase radar</h2>
        </div>
        <div className="mode-toggle" aria-label="Chart detail level">
          {(["dimensions", "subdimensions", "indicators"] as const).map(
            (option) => (
              <button
                key={option}
                className={mode === option ? "selected" : ""}
                onClick={() => onModeChange(option)}
              >
                {option}
              </button>
            ),
          )}
        </div>
      </div>
      <div className="radar-wrap">
        {active && (
          <div className="radar-tooltip" style={{ borderColor: active.color }}>
            <small>
              {active.indicator
                ? "Indicator"
                : active.subdimension
                  ? "Subdimension"
                  : "Dimension"}{" "}
              {active.id}
            </small>
            <b>{active.label}</b>
            <strong style={{ color: active.color }}>
              {active.value.toFixed(active.indicator ? 0 : 2)} <span>/ 5</span>
            </strong>
          </div>
        )}
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label="DEMA phase radar chart"
        >
          {[1, 2, 3, 4, 5].map((phase) => {
            const ring = points.map((_, index) =>
              polar(index, points.length, (phase / 5) * RADIUS),
            );
            return (
              <g key={phase}>
                <polygon
                  points={polygon(ring)}
                  fill={phase % 2 ? "#f8fafc" : "#fff"}
                  stroke="#d1d5db"
                />
                <text x={CENTER + 7} y={CENTER - (phase / 5) * RADIUS + 14}>
                  {phase}
                </text>
              </g>
            );
          })}
          {points.map((point, index) => {
            const edge = polar(index, points.length, RADIUS);
            return (
              <line
                key={`axis-${point.id}`}
                x1={CENTER}
                y1={CENTER}
                x2={edge.x}
                y2={edge.y}
              />
            );
          })}
          <polygon className="score-area" points={polygon(valuePoints)} />
          {points.map((point, index) => {
            const value = valuePoints[index],
              label = polar(
                index,
                points.length,
                mode === "dimensions" ? RADIUS + 48 : RADIUS + 28,
              ),
              selected = point.id === selectedId;
            return (
              <g
                key={point.id}
                tabIndex={0}
                role="button"
                onMouseEnter={() => setHovered(point)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(point)}
                onBlur={() => setHovered(null)}
                onClick={() => onSelect(point)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ")
                    onSelect(point);
                }}
              >
                <circle
                  cx={value.x}
                  cy={value.y}
                  r={selected ? 9 : 6}
                  fill={point.color}
                  stroke="#fff"
                  strokeWidth="3"
                />
                {selected && (
                  <circle
                    cx={value.x}
                    cy={value.y}
                    r="14"
                    fill="none"
                    stroke={point.color}
                    strokeOpacity=".35"
                    strokeWidth="4"
                  />
                )}
                <text
                  className={selected ? "active-label" : ""}
                  x={label.x}
                  y={label.y}
                  textAnchor="middle"
                  fill={selected ? point.color : "#374151"}
                >
                  {mode === "dimensions" ? point.label : point.id}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
