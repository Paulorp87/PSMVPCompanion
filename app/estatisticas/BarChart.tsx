"use client";
import { useState } from "react";

export type Bar = { label: string; sub: string; value: number | null; value2?: number; tip: string };
const C2 = "#7aa7ff";

const compact = (x: number) =>
  x >= 1e6 ? (x / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "M"
  : x >= 1e3 ? (x / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "K"
  : Math.round(x).toLocaleString("pt-BR");

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

export default function BarChart({ bars, avg, unit, empty, legend }: { bars: Bar[]; avg: number | null; unit: string; empty: string; legend?: [string, string] }) {
  const [hover, setHover] = useState<number | null>(null);
  const vals = bars.map((b) => (b.value ?? 0) + (b.value2 ?? 0));
  if (!bars.some((b) => b.value != null)) return <p className="note">{empty}</p>;
  const H = 220, padL = 48, padR = 12, padT = 16, padB = 40;
  const slot = Math.max(44, Math.min(180, 900 / Math.max(1, bars.length)));
  const W = padL + padR + slot * bars.length;
  const max = niceMax(Math.max(...vals, avg ?? 0));
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const bw = Math.min(24, slot * 0.5);

  return (
    <div style={{ position: "relative", overflowX: "auto" }}>
      {legend && (
        <div className="row" style={{ gap: 14, fontSize: 12.5, marginBottom: 6 }}>
          <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "var(--accent)", marginRight: 6 }} />{legend[0]}</span>
          <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: C2, marginRight: 6 }} />{legend[1]}</span>
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Gráfico de barras: ${unit} por semana`} style={{ display: "block", maxWidth: "none" }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">{compact(t)}</text>
          </g>
        ))}
        {bars.map((b, i) => {
          const cx = padL + slot * i + slot / 2;
          const v = b.value;
          const top = v != null ? y(v) : y(0);
          const h = y(0) - top;
          const r = Math.min(4, h);
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0}>
              <rect x={cx - slot / 2} y={padT} width={slot} height={H - padT - padB} fill="transparent" />
              {v != null && v > 0 && (
                <path fill={hover === i ? "#ffcd6b" : "var(--accent)"}
                  d={`M${cx - bw / 2},${y(0)} V${top + r} Q${cx - bw / 2},${top} ${cx - bw / 2 + r},${top} H${cx + bw / 2 - r} Q${cx + bw / 2},${top} ${cx + bw / 2},${top + r} V${y(0)} Z`} />
              )}
              {(b.value2 ?? 0) > 0 && (() => {
                const base = v != null && v > 0 ? top - 2 : y(0);
                const t2 = y((v ?? 0) + b.value2!) - (v != null && v > 0 ? 2 : 0);
                const h2 = base - t2, r2 = Math.min(4, h2);
                return h2 > 0 ? <path fill={hover === i ? "#a8c4ff" : C2}
                  d={`M${cx - bw / 2},${base} V${t2 + r2} Q${cx - bw / 2},${t2} ${cx - bw / 2 + r2},${t2} H${cx + bw / 2 - r2} Q${cx + bw / 2},${t2} ${cx + bw / 2},${t2 + r2} V${base} Z`} /> : null;
              })()}
              {v == null && <text x={cx} y={y(0) - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">—</text>}
              <text x={cx} y={H - padB + 16} textAnchor="middle" fontSize={11} fill="var(--text)">{b.label}</text>
              <text x={cx} y={H - padB + 30} textAnchor="middle" fontSize={10} fill="var(--muted)">{b.sub}</text>
            </g>
          );
        })}
        {avg != null && avg > 0 && (
          <g pointerEvents="none">
            <line x1={padL} x2={W - padR} y1={y(avg)} y2={y(avg)} stroke="var(--text)" strokeOpacity={0.55} strokeWidth={1.5} />
            <text x={W - padR} y={y(avg) - 5} textAnchor="end" fontSize={11} fill="var(--text)">média {compact(avg)}</text>
          </g>
        )}
      </svg>
      {hover != null && (
        <div className="panel" style={{ position: "absolute", top: 4, left: Math.min(padL + slot * hover + slot / 2 + 8, W - 160), padding: "6px 10px", fontSize: 13, pointerEvents: "none", whiteSpace: "nowrap" }}>
          {bars[hover].tip}
        </div>
      )}
    </div>
  );
}
