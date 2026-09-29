// Home's "Schedule" (docs/pocket-design/Main.dc.html): this week, Monday to Sunday, the chosen
// day under a sliding black tile (today's date in accent), a dot under days with something
// booked; then that day's agenda: time in mono, a coloured dot, what and where, and a tag
// ("On site" while it is happening, "Next" for the next one today). Nothing booked: "Add visit".
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/i18n/LanguageContext";
import { calendarApi, type AgendaEntryDto } from "@/lib/calendar-api";
import { haptic } from "@/lib/haptics";
import { LinkChevron } from "../icons";
import { clock, dayKey } from "./format";

/** The canvas's dot colours: site work ink, an estimate or call accent, a walkthrough / milestone green, a delivery or money amber. */
const DOT: Record<AgendaEntryDto["kind"], string> = { block: "#141416", followup: "#e4572e", milestone: "#1f7a45", invoice: "#b7791f", external: "#b7791f", filing: "#b7791f", permit: "#1f7a45" };

export function HomeSchedule() {
  const { t, lang } = useLanguage();
  const today = new Date();
  const monday = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKey(today)]);
  const days = Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
  const [sel, setSel] = useState(() => (today.getDay() + 6) % 7);
  const end = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);
  const { data } = useQuery({ queryKey: ["pocket-week", dayKey(monday), lang], queryFn: () => calendarApi.agenda(monday, end, lang), staleTime: 60_000, retry: false });
  const entries = (data?.entries ?? []).filter((e) => e.state !== "done");
  const byDay = new Map<string, AgendaEntryDto[]>();
  for (const e of entries) {
    const k = dayKey(new Date(e.startsAt));
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  for (const list of byDay.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const agenda = byDay.get(dayKey(days[sel]!)) ?? [];
  const now = Date.now();
  const isToday = dayKey(days[sel]!) === dayKey(today);
  const nextId = isToday ? agenda.find((e) => Date.parse(e.startsAt) > now)?.id : undefined;
  const dow = (d: Date) => d.toLocaleDateString(lang === "fr" ? "fr-CA" : "en-US", { weekday: "short" }).replace(".", "");
  const month = today.toLocaleDateString(lang === "fr" ? "fr-CA" : "en-US", { month: "long" });

  return (
    <section className="pk-rise" style={{ padding: "22px 16px 0", animationDelay: "140ms" }} aria-labelledby="pk-sched">
      <div className="pk-sec-head">
        <h2 id="pk-sched">{t("pocket.home.schedule")}</h2>
        <Link href="/dashboard/schedule" className="pk-sec-link">{month.charAt(0).toUpperCase() + month.slice(1)}<LinkChevron /></Link>
      </div>
      <div className="pk-card">
        <div style={{ position: "relative", padding: 6, display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
          <span className="pk-slide" aria-hidden="true" style={{ position: "absolute", top: 6, left: 6, width: "calc((100% - 12px) / 7)", height: 56, borderRadius: 16, background: "#141416", transform: `translateX(${sel * 100}%)` }} />
          {days.map((d, i) => {
            const on = i === sel;
            const n = byDay.get(dayKey(d))?.length ?? 0;
            const isT = dayKey(d) === dayKey(today);
            return (
              <button key={i} type="button" className="pk-press" onClick={() => { haptic("selection"); setSel(i); }} aria-pressed={on}
                aria-label={`${dow(d)} ${d.getDate()}, ${t(n === 1 ? "pocket.home.dayBooked1" : "pocket.home.dayBooked").replace("{day}", d.toLocaleDateString(lang === "fr" ? "fr-CA" : "en-US", { weekday: "long", month: "long", day: "numeric" })).replace("{n}", String(n))}`}
                style={{ position: "relative", height: 56, border: 0, background: "transparent", borderRadius: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                <span className="pk-dayt" style={{ fontSize: 11, fontWeight: 500, color: on ? "rgba(255,255,255,.6)" : "#6e6e76" }}>{dow(d)}</span>
                <span className="pk-dayt pk-num" style={{ fontSize: 15, fontWeight: 600, color: on ? "#ffffff" : isT ? "#c2441f" : "#141416" }}>{d.getDate()}</span>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: n ? (on ? "rgba(255,255,255,.7)" : "#c4c3c0") : "transparent" }} />
              </button>
            );
          })}
        </div>
        <div style={{ height: 1, background: "#efeeea", margin: "0 16px" }} />
        {agenda.length > 0 ? (
          <div style={{ padding: "6px 0 8px" }}>
            {agenda.map((ev, i) => {
              const live = Date.parse(ev.startsAt) <= now && now < Date.parse(ev.endsAt) && ev.kind === "block";
              const tag = live ? t("pocket.home.onSite") : ev.id === nextId ? t("pocket.home.next") : "";
              const body = (
                <>
                  <span className="pk-mono" style={{ fontSize: 12, color: "#3c3c43", paddingTop: 1 }}>{ev.allDay ? t("pocket.home.allDay") : clock(ev.startsAt)}</span>
                  <span style={{ display: "flex", justifyContent: "center", paddingTop: 5 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: DOT[ev.kind] }} /></span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "#141416", lineHeight: 1.3 }}>{ev.title}</span>
                    {ev.subtitle && <span style={{ fontSize: 12, color: "#6e6e76" }}>{ev.subtitle}</span>}
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 500, paddingTop: 2, color: tag && !live ? "#c2441f" : "#6e6e76" }}>{tag}</span>
                </>
              );
              const style: React.CSSProperties = { display: "grid", gridTemplateColumns: "44px 14px 1fr auto", columnGap: 10, alignItems: "start", padding: "10px 16px", animationDelay: `${i * 60}ms`, color: "inherit", textDecoration: "none" };
              return ev.href ? <Link key={ev.id} href={ev.href} className="pk-row pk-rise" style={style}>{body}</Link> : <div key={ev.id} className="pk-row pk-rise" style={style}>{body}</div>;
            })}
          </div>
        ) : (
          <div className="pk-rise" style={{ padding: "18px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13.5, color: "#6e6e76" }}>{t("pocket.home.nothingBooked")}</span>
            <Link href={`/dashboard/schedule?new=1&day=${dayKey(days[sel]!)}`} className="pk-press" style={{ height: 34, padding: "0 12px", borderRadius: 10, background: "#f1f0ec", color: "#141416", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", textDecoration: "none" }}>{t("pocket.home.addVisit")}</Link>
          </div>
        )}
      </div>
    </section>
  );
}
