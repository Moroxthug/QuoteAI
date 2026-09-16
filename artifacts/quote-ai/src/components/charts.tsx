// Shared bits for the Phase 5 recharts dashboards: one fixed categorical
// palette (validated for CVD separation and contrast), tooltip styling and a
// couple of tiny building blocks so every chart reads as one system.
import type { ReactNode } from "react";
import { formatCents } from "@/lib/jobs-api";

/** Fixed series colours — assigned by entity, never cycled. */
export const SERIES = {
  actual: "#7c3aed", // violet — costs / actual
  planned: "#c2410c", // orange — budget / plan
  invoiced: "#0284c7", // sky — billed
  collected: "#059669", // emerald — cash in
  outflow: "#c2410c",
  neutral: "#94a3b8",
} as const;

export const STATUS = { good: "#059669", warn: "#d97706", bad: "#e11d48" } as const;

export const TOOLTIP_STYLE = { borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12, boxShadow: "0 4px 12px rgba(15,23,42,.08)" } as const;
export const AXIS_TICK = { fontSize: 11, fill: "#64748b" } as const;

export const money = (v: number) => formatCents(v);
export const moneyShort = (v: number) => {
  const d = v / 100;
  const abs = Math.abs(d);
  if (abs >= 1_000_000) return `${(d / 1_000_000).toFixed(1)}M $`;
  if (abs >= 1_000) return `${Math.round(d / 1_000)}k $`;
  return `${Math.round(d)} $`;
};

export function ChartCard({ title, subtitle, children, right, className }: { title: string; subtitle?: string; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={`card ${className ?? ""}`}>
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="sub">{subtitle}</p>}
        </div>
        {right}
      </div>
      <div className="act-body">{children}</div>
    </section>
  );
}

export function LegendRow({ items }: { items: { color: string; label: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 mb-2">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm" style={i.dashed ? { border: `2px dashed ${i.color}`, height: 0, width: 12 } : { background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="h-40 flex items-center justify-center text-sm text-slate-400">{text}</div>;
}
