import type { ReactNode } from "react";

// ---- formatters (en-CA, CAD). Missing values are never shown as 0. -----------
export const NOT_CONNECTED = "not connected";
export const NOT_ENOUGH = "not enough data";

const cad0 = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
const cad2 = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const int = new Intl.NumberFormat("en-CA");
const pct = new Intl.NumberFormat("en-CA", { style: "percent", maximumFractionDigits: 1 });

const ok = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

export function money(cents: number | null | undefined, opts?: { exact?: boolean; fallback?: string }): string {
  if (!ok(cents)) return opts?.fallback ?? NOT_CONNECTED;
  const d = cents / 100;
  return (opts?.exact || Math.abs(d) < 100 ? cad2 : cad0).format(d);
}
export const count = (n: number | null | undefined, fallback = NOT_ENOUGH) => (ok(n) ? int.format(n) : fallback);
export const percent = (r: number | null | undefined, fallback = NOT_ENOUGH) => (ok(r) ? pct.format(r) : fallback);
export const months = (n: number | null | undefined, fallback = NOT_ENOUGH) =>
  ok(n) ? `${n.toLocaleString("en-CA", { maximumFractionDigits: 1 })} mo` : fallback;

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric", timeZone: "America/Toronto" });
}

// ---- layout primitives ------------------------------------------------------
export function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-h`} className="space-y-3 min-w-0">
      <div>
        <h2 id={`${id}-h`} className="text-base font-bold text-slate-900">{title}</h2>
        {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-slate-200 p-4 shadow-sm min-w-0 ${className}`}>{children}</div>;
}

export function Stat({
  label, value, sub, missing, tone,
}: { label: string; value: string; sub?: string; missing?: boolean; tone?: "good" | "bad" }) {
  const color = missing ? "text-slate-500" : tone === "bad" ? "text-red-700" : tone === "good" ? "text-emerald-700" : "text-slate-900";
  return (
    <Card>
      <dt className="text-xs font-medium text-slate-600">{label}</dt>
      <dd className={`mt-1 font-bold tabular-nums break-words ${missing ? "text-sm italic" : "text-xl"} ${color}`}>{value}</dd>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </Card>
  );
}

export function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-2xl bg-slate-200/70 ${className}`} />;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-500 italic">{children}</p>;
}

export const inputCls =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-500";
export const btnCls =
  "inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg text-sm font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-navy-500";
export const btnPrimaryCls =
  "inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg text-sm font-semibold bg-navy-600 text-white hover:bg-navy-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-navy-500";
