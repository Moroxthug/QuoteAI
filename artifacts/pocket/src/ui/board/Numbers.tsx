// Components.dc.html · "Numbers": the stat strip, KPI tiles and progress rows.
import { useTranslation } from "react-i18next";
import { money, number, percent, shortDate, type Locale } from "@/lib/format";
import { KpiGrid, KpiTile, ProgressList, ProgressRow, StatStrip } from "../Numbers";
import { BoardGroup, BoardPad, BoardSection } from "../sandbox";

export function NumbersSection() {
  const { t, i18n } = useTranslation();
  const c = (k: string, o?: Record<string, unknown>) => t(`board.numbers.${k}`, o);
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const m = (n: number) => money(n, locale, { cents: false });
  return (
    <>
      <BoardSection title={c("title")} />
      <BoardGroup label={c("strip")} />
      <BoardPad>
        <StatStrip items={[
          { label: c("waiting"), value: m(15396), sub: c("quotes", { count: 4 }) },
          { label: c("won"), value: m(6165), sub: c("accepted", { count: 2 }), subTone: "ok" },
          { label: c("winRate"), value: percent(0.62, locale), sub: c("pts", { count: 4 }), subTone: "ok" },
        ]} />
      </BoardPad>
      <BoardGroup label={c("tiles")} />
      <BoardPad>
        <KpiGrid>
          <KpiTile label={c("collected")} value={m(48230)} sub={c("vsAugust", { pct: percent(0.12, locale) })} subTone="ok" />
          <KpiTile label={c("overdue")} value={m(3120)} sub={c("invoices", { count: 2 })} subTone="bad" />
          <KpiTile label={c("crewHours")} value={c("hours", { n: number(126.5, locale, 1) })} sub={c("thisWeek")} />
          <KpiTile label={c("activeJobs")} value={number(3, locale)} sub={c("starts", { count: 1, date: shortDate(new Date(2026, 9, 5), locale) })} />
        </KpiGrid>
      </BoardPad>
      <BoardGroup label={c("progress")} />
      <BoardPad>
        <ProgressList>
          <ProgressRow label={c("basement")} figure={percent(0.64, locale)} value={0.64} />
          <ProgressRow label={c("hallway")} figure={percent(0.2, locale)} value={0.2} fill="acc" />
          <ProgressRow label={c("hart")} figure={percent(0.9, locale)} value={0.9} tone="warn" fill="warn-dot" />
          <ProgressRow label={c("deck")} figure={percent(1.08, locale)} value={1.08} tone="bad" fill="bad" />
        </ProgressList>
      </BoardPad>
    </>
  );
}
