// Home's "Business" (docs/pocket-design/Main.dc.html): Week · Month · Quarter; "Collected in
// September", the total, ↑ the change against the period before; the smooth orange line with its
// soft area and end dot (drawn in, then eased between periods); the period labels in mono; then
// Quotes won with its bar, Outstanding with what is overdue, and Margin after labour.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/i18n/LanguageContext";
import { pocketApi, type BusinessPeriod } from "@/lib/today-api";
import { Segmented } from "../kit";
import { money } from "./format";

const W = 326;

/** The canvas's Catmull-Rom smoothing, as a cubic path. */
function smooth(pts: [number, number][]): string {
  const f = (n: number) => n.toFixed(1);
  // Control points stay between the top line and the baseline (a flat run of zeros would dip under it).
  const y = (n: number) => Math.min(104, Math.max(4, n));
  let d = `M${f(pts[0]![0])} ${f(pts[0]![1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!, p1 = pts[i]!, p2 = pts[i + 1]!, p3 = pts[i + 2] ?? p2;
    d += " C" + [p1[0] + (p2[0] - p0[0]) / 6, y(p1[1] + (p2[1] - p0[1]) / 6), p2[0] - (p3[0] - p1[0]) / 6, y(p2[1] - (p3[1] - p1[1]) / 6), p2[0], p2[1]].map(f).join(" ");
  }
  return d;
}

function labels(period: BusinessPeriod, starts: string[], lang: "en" | "fr"): string[] {
  const loc = lang === "fr" ? "fr-CA" : "en-US";
  const at = (s: string) => new Date(`${s}T12:00:00`);
  if (period === "M") return starts.map((s) => at(s).toLocaleDateString(loc, { month: "short" }).replace(".", ""));
  if (period === "Q") {
    const thisYear = at(starts[starts.length - 1]!).getFullYear();
    return starts.map((s) => { const d = at(s); const q = `${lang === "fr" ? "T" : "Q"}${Math.floor(d.getMonth() / 3) + 1}`; return d.getFullYear() === thisYear ? q : `${q} ’${String(d.getFullYear()).slice(2)}`; });
  }
  // Weeks: the month on the first and where it changes, else the day ("Aug 3", "10", "17" … "Sep 7").
  return starts.map((s, i) => { const d = at(s); const prev = i ? at(starts[i - 1]!) : null; return !prev || prev.getMonth() !== d.getMonth() ? d.toLocaleDateString(loc, { month: "short", day: "numeric" }).replace(".", "") : String(d.getDate()); });
}

export function HomeBusiness() {
  const { t, lang } = useLanguage();
  const [period, setPeriod] = useState<BusinessPeriod>("M");
  const { data } = useQuery({ queryKey: ["pocket-business", period], queryFn: () => pocketApi.business(period), staleTime: 60_000, retry: false, placeholderData: (prev) => prev });
  if (!data?.buckets) return null;
  const b = data.buckets;
  const vals = b.map((x) => x.collectedCents);
  const cur = vals[vals.length - 1] ?? 0, prev = vals[vals.length - 2] ?? 0;
  const delta = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
  const mx = Math.max(...vals), mn = Math.min(...vals) * 0.85;
  const span = mx - mn || 1;
  const pts = vals.map((v, i) => [6 + i * ((W - 12) / Math.max(1, vals.length - 1)), mx === 0 ? 100 : 10 + (1 - (v - mn) / span) * 90] as [number, number]);
  const line = smooth(pts);
  const last = pts[pts.length - 1]!;
  const lab = labels(period, b.map((x) => x.start), lang);
  const startCur = new Date(`${b[b.length - 1]!.start}T12:00:00`);
  const word = period === "W" ? t("pocket.biz.thisWeek") : period === "M" ? t("pocket.biz.inMonth").replace("{month}", startCur.toLocaleDateString(lang === "fr" ? "fr-CA" : "en-US", { month: "long" })) : t("pocket.biz.inQuarter").replace("{q}", lab[lab.length - 1]!);
  const vs = period === "W" ? t("pocket.biz.vsLastWeek") : t("pocket.biz.vs").replace("{p}", lab[lab.length - 2] ?? "");
  const win = data.winPercent;

  return (
    <section className="pk-rise" style={{ padding: "22px 16px 0", animationDelay: "280ms" }} aria-labelledby="pk-biz">
      <div className="pk-sec-head">
        <h2 id="pk-biz">{t("pocket.home.business")}</h2>
        <Segmented label={t("pocket.biz.period")} width={156} size={28} variant="tint" value={period} onChange={setPeriod}
          options={[{ value: "W", label: t("pocket.biz.week") }, { value: "M", label: t("pocket.biz.month") }, { value: "Q", label: t("pocket.biz.quarter") }]} />
      </div>
      <div className="pk-card" style={{ padding: "16px 16px 14px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12.5, color: "#6e6e76" }}>{t("pocket.biz.collected").replace("{when}", word)}</span>
            <span className="pk-num" style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.045em", lineHeight: 1 }}>{money(cur, lang)}</span>
          </div>
          {delta != null && <span className="pk-num" style={{ fontSize: 12.5, fontWeight: 500, color: delta >= 0 ? "#1f7a45" : "#c2371f", paddingBottom: 3, textAlign: "right" }}>{delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}% <span style={{ color: "#6e6e76", fontWeight: 400 }}>{vs}</span></span>}
        </div>
        <svg viewBox={`0 0 ${W} 112`} role="img" aria-label={t("pocket.biz.chart").replace("{total}", money(cur, lang))} style={{ display: "block", width: "100%", height: "auto", marginTop: 16, overflow: "visible" }}>
          <line x1="0" y1="8" x2={W} y2="8" stroke="#efeeea" strokeDasharray="2 4" />
          <line x1="0" y1="56" x2={W} y2="56" stroke="#efeeea" strokeDasharray="2 4" />
          <line x1="0" y1="104" x2={W} y2="104" stroke="#e7e6e2" />
          <path className="pk-area" d={`${line} L${last[0].toFixed(1)} 104 L${pts[0]![0].toFixed(1)} 104 Z`} fill="#e4572e" fillOpacity={0.07} />
          <path className="pk-draw" d={line} pathLength={1} fill="none" stroke="#e4572e" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <circle className="pk-dot" cx={last[0]} cy={last[1]} r={4.5} fill="#ffffff" stroke="#e4572e" strokeWidth={2} />
        </svg>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }} aria-hidden="true">
          {lab.map((l, i) => <span key={i} className="pk-mono" style={{ fontSize: 10.5, color: "#6e6e76" }}>{l}</span>)}
        </div>
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #efeeea", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 11.5, color: "#6e6e76" }}>{t("pocket.biz.won")}</span>
            <span className="pk-num" style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.03em" }}>{win != null ? `${win}%` : "—"}</span>
            <span aria-hidden="true" style={{ height: 3, borderRadius: 3, background: "#efeeea", overflow: "hidden", marginTop: 3, width: 72, display: "block" }}><span className="pk-grow" style={{ display: "block", height: "100%", background: "#141416", transition: "width .6s cubic-bezier(.16,1,.3,1)", width: `${win ?? 0}%` }} /></span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingLeft: 14, borderLeft: "1px solid #efeeea" }}>
            <span style={{ fontSize: 11.5, color: "#6e6e76" }}>{t("pocket.biz.outstanding")}</span>
            <span className="pk-num" style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.03em" }}>{data.outstanding ? money(data.outstanding.balanceCents, lang) : "—"}</span>
            {data.outstanding && data.outstanding.overdueCents > 0 && <span style={{ fontSize: 11.5, color: "#c2371f" }}>{t("pocket.biz.overdue").replace("{amount}", money(data.outstanding.overdueCents, lang))}</span>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingLeft: 14, borderLeft: "1px solid #efeeea" }}>
            <span style={{ fontSize: 11.5, color: "#6e6e76" }}>{t("pocket.biz.margin")}</span>
            <span className="pk-num" style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.03em" }}>{data.marginPercent != null ? `${data.marginPercent}%` : "—"}</span>
            <span style={{ fontSize: 11.5, color: "#6e6e76" }}>{t("pocket.biz.afterLabour")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
