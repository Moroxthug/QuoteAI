// Home's "Today" (docs/pocket-design/Main.dc.html): done/total with a 44 px bar, then the list —
// a round tick that draws its check, the line, and a meta line in red (overdue money, a blocker),
// amber (due now) or grey. The items are the person's own (routes/today.ts checklist).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useLanguage } from "@/i18n/LanguageContext";
import { haptic } from "@/lib/haptics";
import { pocketApi, type ChecklistItemDto } from "@/lib/today-api";
import { money } from "./format";

type Row = { text: string; meta: string; tone: "urgent" | "soon" | "" };

function describe(i: ChecklistItemDto, t: (k: string) => string, lang: "en" | "fr"): Row {
  const f = (k: string, v: Record<string, string | number>) => Object.entries(v).reduce((s, [a, b]) => s.replace(`{${a}}`, String(b)), t(k));
  switch (i.kind) {
    case "overdue": return { text: f("pocket.today.chase", { number: i.title, who: i.subtitle.split(" ").slice(-1)[0] ?? "" }).replace(/, $/, ""), meta: f(i.days === 1 ? "pocket.today.overdue1" : "pocket.today.overdue", { amount: money(i.amountCents ?? 0, lang, true), n: i.days ?? 0 }), tone: "urgent" };
    case "etransfer": return { text: f("pocket.today.etransfer", { number: i.title }), meta: [money(i.amountCents ?? 0, lang, true), i.subtitle].filter(Boolean).join(" · "), tone: "soon" };
    case "hours": return { text: t(i.people === 1 ? "pocket.today.hours1" : "pocket.today.hours"), meta: f(i.people === 1 ? "pocket.today.hoursMeta1" : "pocket.today.hoursMeta", { h: i.hours ?? 0, n: i.people ?? 0 }), tone: "" };
    case "blocker": return { text: f("pocket.today.blocker", { job: i.title }), meta: i.subtitle, tone: "urgent" };
    case "followup": return { text: f("pocket.today.call", { name: i.title }), meta: [i.phone, i.subtitle].filter(Boolean).join(" · "), tone: "soon" };
    case "waiting": return { text: f("pocket.today.waiting", { name: i.title }), meta: f(i.days === 1 ? "pocket.today.sent1" : "pocket.today.sent", { n: i.days ?? 0 }), tone: "" };
    case "task": return { text: i.title, meta: [i.jobName, (i.days ?? 0) > 0 ? f(i.days === 1 ? "pocket.today.late1" : "pocket.today.late", { n: i.days ?? 0 }) : t("pocket.today.dueToday")].filter(Boolean).join(" · "), tone: (i.days ?? 0) > 0 ? "urgent" : "soon" };
  }
}

export function HomeToday() {
  const { t, lang } = useLanguage();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["pocket-checklist"], queryFn: pocketApi.checklist, staleTime: 30_000, retry: false });
  const tick = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => pocketApi.check(id, done),
    onMutate: async ({ id, done }) => {
      await queryClient.cancelQueries({ queryKey: ["pocket-checklist"] });
      const prev = queryClient.getQueryData<{ day: string; items: ChecklistItemDto[] }>(["pocket-checklist"]);
      if (prev) queryClient.setQueryData(["pocket-checklist"], { ...prev, items: prev.items.map((i) => (i.id === id ? { ...i, done } : i)) });
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) queryClient.setQueryData(["pocket-checklist"], ctx.prev); },
  });
  const items = data?.items ?? [];
  if (!data || items.length === 0) return null;
  const done = items.filter((i) => i.done).length;

  return (
    <section className="pk-rise" style={{ padding: "22px 16px 0", animationDelay: "210ms" }} aria-labelledby="pk-today">
      <div className="pk-sec-head">
        <h2 id="pk-today">{t("pocket.home.today")}</h2>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#6e6e76" }}>
          <span className="pk-num" aria-label={t("pocket.today.progress").replace("{done}", String(done)).replace("{total}", String(items.length))}>{done}/{items.length}</span>
          <span aria-hidden="true" style={{ width: 44, height: 4, borderRadius: 4, background: "#e7e6e2", overflow: "hidden", display: "block" }}><span style={{ display: "block", height: "100%", background: "#141416", borderRadius: 4, transition: "width .6s cubic-bezier(.16,1,.3,1)", width: `${Math.round((done / items.length) * 100)}%` }} /></span>
        </span>
      </div>
      <div className="pk-card" style={{ padding: "4px 0" }}>
        {items.map((i) => {
          const r = describe(i, t, lang);
          return (
            <div key={i.id} className="pk-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 16px" }}>
              <button type="button" className={`pk-chk${i.done ? " done" : ""}`} aria-pressed={i.done} aria-label={(i.done ? t("pocket.today.markNotDone") : t("pocket.today.markDone")).replace("{what}", r.text)}
                onClick={() => { haptic(i.done ? "light" : "success"); tick.mutate({ id: i.id, done: !i.done }); }}
                style={{ width: 22, height: 22, flexShrink: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, cursor: "pointer", background: i.done ? "#141416" : "#ffffff", border: `1.5px solid ${i.done ? "#141416" : "#c9c8c4"}` }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" pathLength={24} /></svg>
              </button>
              <Link href={i.href} style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1, padding: "2px 0", color: "inherit", textDecoration: "none" }}>
                <span className={`pk-tt${i.done ? " done" : ""}`} style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.35 }}>{r.text}</span>
                {r.meta && <span style={{ fontSize: 12, color: i.done ? "#6e6e76" : r.tone === "urgent" ? "#c2371f" : r.tone === "soon" ? "#9a6412" : "#6e6e76" }}>{r.meta}</span>}
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
