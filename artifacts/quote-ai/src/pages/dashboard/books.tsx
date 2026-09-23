import { useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { AlertTriangle, ArrowRight, Banknote, BookCheck, Check, CircleCheck, CircleDashed, HardHat, Info, Link2, Loader2, Lock, Plus, RefreshCw, Undo2, EyeOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useCan, useRole } from "@/hooks/use-role";
import { useMediaQuery } from "@/hooks/use-media-query";
import { formatCents, jobsApi } from "@/lib/jobs-api";
import { booksApi, type BankLineDto, type BooksOverviewDto, type CostCategory } from "@/lib/books-api";

// ── Phase 88: /dashboard/books ──────────────────────────────────────────────
// The month-end close (what is not finished in QuoteAI for a month), the bank
// feed matched to costs and payments, and a crew's materials claims matched to
// the receipts that prove them. The accounting itself stays in QuickBooks or
// Wave, or with the accountant.

const TABS = ["close", "bank", "claims"] as const;
type Tab = (typeof TABS)[number];
const TAB_ICONS: Record<Tab, typeof BookCheck> = { close: BookCheck, bank: Banknote, claims: HardHat };

const monthDate = (m: string) => new Date(`${m}-01T12:00:00`);
const day = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);

type Overview = Extract<BooksOverviewDto, { enabled: true }>;

export default function BooksPage() {
  const { t } = useLanguage();
  useDocumentTitle(t("books.title"));
  const search = useSearch();
  const initial = new URLSearchParams(search).get("tab");
  const [tab, setTab] = useState<Tab>(TABS.includes(initial as Tab) ? (initial as Tab) : "close");
  // The books are the owner's and the office's (invoicing:full); a foreman is told so instead of asking and being refused.
  const { loaded: roleLoaded } = useRole();
  const allowed = useCan()("invoicing", "full");
  const { data, isLoading, error } = useQuery({ queryKey: ["books-overview"], queryFn: booksApi.overview, retry: false, enabled: roleLoaded && allowed });

  return (
    <div className="animate-in fade-in duration-500">
      <div className="page-head">
        <div>
          <h1>{t("books.title")}</h1>
          <p className="sub">{t("books.subtitle")}</p>
        </div>
      </div>

      {(!roleLoaded || (allowed && isLoading)) && <div className="space-y-3"><Skeleton className="h-12 w-full rounded-[var(--radius-mk)]" /><Skeleton className="h-64 w-full rounded-[var(--radius-mk)]" /></div>}

      {roleLoaded && (!allowed || error) && <div className="notice info"><Info /><span className="grow">{!allowed || (error as Error & { status?: number }).status === 403 ? t("books.notYourRole") : (error as Error).message}</span></div>}

      {data && !data.enabled && (
        <section className="card">
          <div className="card-foot" style={{ borderTop: "none" }}>
            <div className="flex items-center gap-3 min-w-0">
              <span className="qa-ic navy"><Lock className="h-4 w-4" /></span>
              <span className="text-sm text-slate-600">{t("books.locked")}</span>
            </div>
            <Link href="/dashboard/billing" className="cta-link" style={{ fontSize: 13.5 }}>{t("dashboard.calendar.upgrade")} <ArrowRight className="chev" /></Link>
          </div>
        </section>
      )}

      {data?.enabled && (
        <>
          <div className="pills mb-4">
            {TABS.map((k) => {
              const Icon = TAB_ICONS[k];
              return (
                <button key={k} type="button" onClick={() => setTab(k)} className={cn("pill", tab === k && "on")}>
                  <Icon /> {t(`books.tab.${k}`)}
                </button>
              );
            })}
          </div>
          {tab === "close" && <CloseTab overview={data} />}
          {tab === "bank" && <BankTab overview={data} />}
          {tab === "claims" && <ClaimsTab />}
        </>
      )}
    </div>
  );
}

// ── Month-end close ──────────────────────────────────────────────────────────

function lastMonths(today: string, n: number): string[] {
  const [y, m] = today.split("-").map(Number) as [number, number];
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

function CloseTab({ overview }: { overview: Overview }) {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const months = useMemo(() => lastMonths(overview.today, 13), [overview.today]);
  const [month, setMonth] = useState<string>(months[1]!);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");
  const { data, isLoading, error } = useQuery({ queryKey: ["books-close", month], queryFn: () => booksApi.close(month), retry: false });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["books-close"] });
  const onError = (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" });
  const close = useMutation({ mutationFn: () => booksApi.closeMonth(month, note.trim()), onSuccess: () => { setConfirming(false); setNote(""); refresh(); toast({ title: t("books.close.closedToast") }); }, onError });
  const reopen = useMutation({ mutationFn: () => booksApi.reopenMonth(month), onSuccess: refresh, onError });
  const monthLabel = format(monthDate(month), "MMMM yyyy", { locale });
  const isCurrent = month === overview.today.slice(0, 7);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <section className="card">
        <div className="toolbar">
          <select className="inp-sm" style={{ width: "auto" }} aria-label={t("books.close.pickMonth")} value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => (
              <option key={m} value={m}>
                {format(monthDate(m), "MMMM yyyy", { locale })}{data?.closedMonths.includes(m) ? ` · ${t("books.close.closedShort")}` : ""}
              </option>
            ))}
          </select>
          <p className="foot-note m-0 grow">{t("books.close.intro")}</p>
        </div>
      </section>

      {isLoading && <Skeleton className="h-64 w-full rounded-[var(--radius-mk)]" />}
      {error && <div className="card card-empty">{(error as Error).message}</div>}

      {data && (
        <>
          {data.closed ? (
            <div className="notice ok">
              <CircleCheck />
              <span className="grow">
                {t("books.close.closedBy").replace("{month}", monthLabel).replace("{date}", format(new Date(data.closed.closedAt), "PP", { locale })).replace("{name}", data.closed.closedByName ?? "—")}
                {data.closed.note ? ` — “${data.closed.note}”` : ""}
              </span>
              <span className="actions"><button type="button" className="btn btn-sm btn-outline-navy" disabled={reopen.isPending} onClick={() => reopen.mutate()}><Undo2 className="h-4 w-4" /> {t("books.close.reopen")}</button></span>
            </div>
          ) : (
            <div className={cn("notice", data.open ? "warn" : "ok")}>
              {data.open ? <AlertTriangle /> : <CircleCheck />}
              <span className="grow">{data.open ? t("books.close.openCount").replace("{n}", String(data.open)).replace("{month}", monthLabel) : t("books.close.allDone").replace("{month}", monthLabel)}</span>
              {!isCurrent && <span className="actions"><button type="button" className="btn btn-sm btn-navy" onClick={() => setConfirming(true)}><Check className="h-4 w-4" /> {t("books.close.closeMonth").replace("{month}", monthLabel)}</button></span>}
            </div>
          )}
          {data.changedSinceClose.length > 0 && (
            <div className="notice warn"><AlertTriangle /><span className="grow">{t("books.close.changedSince").replace("{items}", data.changedSinceClose.map((k) => t(`books.check.${k}`)).join(", "))}</span></div>
          )}
          {isCurrent && <div className="notice info"><Info /><span className="grow">{t("books.close.currentMonth")}</span></div>}

          <section className="card">
            <div className="card-head"><div><h2>{t("books.close.checklist").replace("{month}", monthLabel)}</h2></div></div>
            <ul className="stack" style={{ gap: 0, margin: 0, padding: 0, listStyle: "none" }}>
              {data.items.map((item) => <CheckRow key={item.key} item={item} books={data.books} locale={locale} />)}
            </ul>
            <div className="card-foot"><span className="foot-note">{t("books.close.foot")}</span></div>
          </section>
        </>
      )}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("books.close.confirmTitle").replace("{month}", monthLabel)}</DialogTitle>
            <DialogDescription>{data?.open ? t("books.close.confirmOpen").replace("{n}", String(data.open)) : t("books.close.confirmDesc")}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="field">
              <label htmlFor="close-note">{t("books.close.note")}</label>
              <input id="close-note" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder={t("books.close.notePlaceholder")} />
            </div>
          </DialogBody>
          <DialogFooter>
            <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setConfirming(false)}>{t("jobs.cancel")}</button>
            <button type="button" className="btn btn-sm btn-navy" disabled={close.isPending} onClick={() => close.mutate()}>{close.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("books.close.confirm")}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CheckRow({ item, books, locale }: { item: NonNullable<Awaited<ReturnType<typeof booksApi.close>>>["items"][number]; books: "quickbooks" | "wave" | null; locale: typeof enCA }) {
  const { t } = useLanguage();
  const done = item.applies && item.count === 0;
  const label = t(`books.check.${item.key}`).replace("{books}", books === "wave" ? "Wave" : "QuickBooks");
  const Icon = !item.applies ? CircleDashed : done ? CircleCheck : AlertTriangle;
  const tone = !item.applies ? "var(--muted-mk)" : done ? "var(--green-dark)" : "var(--yellow-dark)";
  const showCents = item.key !== "time_unapproved" && item.cents > 0;
  return (
    <li style={{ borderTop: "1px solid var(--soft)", padding: "12px 20px" }}>
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 shrink-0" style={{ color: tone, marginTop: 2 }} aria-hidden />
        <div className="grow min-w-0">
          <p className="t-strong" style={{ margin: 0 }}>{label}</p>
          <p className="t-sub" style={{ margin: 0 }}>
            {!item.applies ? t(`books.check.na.${item.key}`) : done ? t("books.check.none") : `${t("books.check.count").replace("{n}", String(item.count))}${showCents ? ` · ${formatCents(item.cents)}` : ""}`}
          </p>
          {item.applies && item.count > 0 && (
            <details style={{ marginTop: 6 }}>
              <summary className="text-link" style={{ cursor: "pointer", fontSize: 13 }}>{t("books.check.show")}</summary>
              <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none" }}>
                {item.rows.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 text-sm" style={{ padding: "3px 0" }}>
                    <span className="text-slate-500" style={{ whiteSpace: "nowrap" }}>{format(day(r.date), "d MMM", { locale })}</span>
                    <Link href={r.href} className="text-link truncate">{r.label || "—"}</Link>
                    {r.cents !== 0 && <span className="t-amt" style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>{formatCents(r.cents)}</span>}
                  </li>
                ))}
              </ul>
              {item.rows.length < item.count && <p className="foot-note" style={{ marginTop: 4 }}>{t("books.check.more").replace("{n}", String(item.count - item.rows.length))}</p>}
            </details>
          )}
        </div>
        {item.applies && item.count > 0 && <Link href={item.href} className="btn btn-sm btn-outline-navy shrink-0">{t("books.check.fix")}</Link>}
      </div>
    </li>
  );
}

// ── Bank lines ───────────────────────────────────────────────────────────────

const STATUSES = ["unmatched", "matched", "ignored", "all"] as const;

function BankTab({ overview }: { overview: Overview }) {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("unmatched");
  const [matching, setMatching] = useState<BankLineDto | null>(null);
  const enabled = overview.bank.onPlan && overview.bank.connected;
  // On a phone the table would hide the amount and the Match button off to the right; each line becomes a stacked row.
  const phone = useMediaQuery("(max-width: 640px)");
  const { data, isLoading } = useQuery({ queryKey: ["books-bank", status], queryFn: () => booksApi.bank(status), enabled });
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ["books-bank"] }); queryClient.invalidateQueries({ queryKey: ["books-close"] }); };
  const onError = (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" });
  const sync = useMutation({ mutationFn: booksApi.syncBank, onSuccess: (r) => { refresh(); toast({ title: t("books.bank.synced").replace("{n}", String(r.fetched)).replace("{m}", String(r.matched)) }); }, onError });
  const unmatch = useMutation({ mutationFn: (id: string) => booksApi.unmatch(id), onSuccess: refresh, onError });
  const ignore = useMutation({ mutationFn: (id: string) => booksApi.ignore(id), onSuccess: refresh, onError });

  if (!overview.bank.onPlan) {
    return (
      <section className="card">
        <div className="card-foot" style={{ borderTop: "none" }}>
          <div className="flex items-center gap-3 min-w-0"><span className="qa-ic navy"><Lock className="h-4 w-4" /></span><span className="text-sm text-slate-600">{t("books.bank.locked")}</span></div>
          <Link href="/dashboard/billing" className="cta-link" style={{ fontSize: 13.5 }}>{t("dashboard.calendar.upgrade")} <ArrowRight className="chev" /></Link>
        </div>
      </section>
    );
  }
  if (!overview.bank.connected) {
    return (
      <div className="notice info">
        <Info />
        <span className="grow">{t("books.bank.notConnected")}</span>
        <span className="actions"><Link href="/dashboard/settings?tab=integrations" className="btn btn-sm btn-navy">{t("books.bank.connect")}</Link></span>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <section className="card">
        <div className="toolbar">
          <select className="inp-sm" style={{ width: "auto" }} aria-label={t("books.bank.filter")} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`books.bank.status.${s}`)}</option>)}
          </select>
          <p className="foot-note m-0 grow">
            {overview.bank.account ? `${overview.bank.account.institution} · ${overview.bank.account.name}${overview.bank.account.last4 ? ` ••${overview.bank.account.last4}` : ""}` : ""}
            {overview.bank.lastSyncedAt ? ` · ${t("books.bank.lastSynced").replace("{date}", format(new Date(overview.bank.lastSyncedAt), "PPp", { locale }))}` : ""}
          </p>
          <button type="button" className="btn btn-sm btn-outline-navy" disabled={sync.isPending} onClick={() => sync.mutate()}>{sync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {t("books.bank.refresh")}</button>
        </div>
        {isLoading ? <div className="p-5"><Skeleton className="h-32 w-full" /></div> : !data || data.lines.length === 0 ? (
          <div className="card-empty">{t(status === "unmatched" ? "books.bank.allMatched" : "books.bank.empty")}</div>
        ) : phone ? (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label={t("books.tab.bank")}>
            {data.lines.map((l) => (
              <li key={l.id} style={{ borderTop: "1px solid var(--soft)", padding: "12px 16px" }}>
                <div className="flex items-start gap-3">
                  <div className="grow min-w-0">
                    <p className="t-strong" style={{ margin: 0, overflowWrap: "anywhere" }}>{l.description || "—"}</p>
                    <p className="t-sub" style={{ margin: 0 }}>{format(day(l.date), "PP", { locale })}</p>
                  </div>
                  <span className="t-amt" style={{ whiteSpace: "nowrap", color: l.amountCents > 0 ? "var(--green-dark)" : undefined }}>{l.amountCents > 0 ? "+" : "−"}{formatCents(Math.abs(l.amountCents))}</span>
                </div>
                <div className="flex items-center gap-2" style={{ marginTop: 8, flexWrap: "wrap" }}>
                  <div className="grow min-w-0"><MatchCell line={l} /></div>
                  {l.status === "unmatched" && (
                    <span className="flex items-center gap-2 shrink-0">
                      <button type="button" className="btn btn-sm btn-navy" onClick={() => setMatching(l)}><Link2 className="h-3.5 w-3.5" /> {t("books.bank.findMatch")}</button>
                      <button type="button" className="ic-btn" title={t("books.bank.ignore")} aria-label={t("books.bank.ignore")} disabled={ignore.isPending} onClick={() => ignore.mutate(l.id)}><EyeOff /></button>
                    </span>
                  )}
                  {l.status !== "unmatched" && <button type="button" className="text-link" disabled={unmatch.isPending} onClick={() => unmatch.mutate(l.id)}><Undo2 className="h-3.5 w-3.5" /> {t("books.bank.undo")}</button>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="tbl-wrap" tabIndex={0} role="region" aria-label={t("books.tab.bank")}>
            <table className="tbl">
              <thead><tr><th>{t("books.col.date")}</th><th>{t("books.col.line")}</th><th className="t-amt">{t("books.col.amount")}</th><th>{t("books.col.match")}</th><th></th></tr></thead>
              <tbody>
                {data.lines.map((l) => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{format(day(l.date), "PP", { locale })}</td>
                    <td><span className="t-strong">{l.description || "—"}</span></td>
                    <td className="t-amt" style={{ whiteSpace: "nowrap", color: l.amountCents > 0 ? "var(--green-dark)" : undefined }}>{l.amountCents > 0 ? "+" : "−"}{formatCents(Math.abs(l.amountCents))}</td>
                    <td><MatchCell line={l} /></td>
                    <td>
                      <div className="row-act">
                        {l.status === "unmatched" && (
                          <>
                            <button type="button" className="btn btn-sm btn-navy" onClick={() => setMatching(l)}><Link2 className="h-3.5 w-3.5" /> {t("books.bank.findMatch")}</button>
                            <button type="button" className="ic-btn" title={t("books.bank.ignore")} aria-label={t("books.bank.ignore")} disabled={ignore.isPending} onClick={() => ignore.mutate(l.id)}><EyeOff /></button>
                          </>
                        )}
                        {l.status !== "unmatched" && <button type="button" className="text-link" disabled={unmatch.isPending} onClick={() => unmatch.mutate(l.id)}><Undo2 className="h-3.5 w-3.5" /> {t("books.bank.undo")}</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="card-foot"><span className="foot-note">{t("books.bank.foot")}</span></div>
      </section>
      <MatchDialog line={matching} onOpenChange={(v) => !v && setMatching(null)} onDone={() => { setMatching(null); refresh(); }} />
    </div>
  );
}

function MatchCell({ line }: { line: BankLineDto }) {
  const { t } = useLanguage();
  if (line.status === "ignored") return <span className="chip chip-grey">{t("books.bank.line.ignored")}</span>;
  if (!line.match) return <span className="chip chip-yellow">{t("books.bank.line.unmatched")}</span>;
  const m = line.match;
  return (
    <span>
      {m.kind === "cost" ? (
        <>
          <span className="t-strong">{m.label || t("books.bank.cost")}</span>
          <span className="t-sub">{[m.projectName, m.status === "pending_review" ? t("books.bank.toReview") : null].filter(Boolean).join(" · ") || t("books.bank.noJob")}</span>
        </>
      ) : (
        <>
          <Link href={`/dashboard/invoices/${m.invoiceId}`} className="t-strong text-link">{m.invoiceNumber}</Link>
          <span className="t-sub">{m.customer}</span>
        </>
      )}
      {line.autoMatched && <span className="chip chip-teal" style={{ marginTop: 4 }}>{t("books.bank.auto")}</span>}
    </span>
  );
}

const CATEGORIES: CostCategory[] = ["materials", "subcontractor", "equipment", "permits_fees", "labour", "misc"];

function MatchDialog({ line, onOpenChange, onDone }: { line: BankLineDto | null; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const { toast } = useToast();
  const [category, setCategory] = useState<CostCategory>("materials");
  const [projectId, setProjectId] = useState<string>("");
  const open = !!line;
  const { data, isLoading } = useQuery({ queryKey: ["books-candidates", line?.id], queryFn: () => booksApi.candidates(line!.id), enabled: open });
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: jobsApi.list, enabled: open && !!line && line.amountCents < 0 });
  const onError = (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" });
  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => { toast({ title: t("books.bank.matchedToast") }); onDone(); },
    onError,
  });
  if (!line) return null;
  const out = line.amountCents < 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t("books.match.title")}</DialogTitle>
          <DialogDescription>{`${format(day(line.date), "PP", { locale })} · ${line.description || "—"} · ${out ? "−" : "+"}${formatCents(Math.abs(line.amountCents))}`}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {isLoading && <Skeleton className="h-24 w-full" />}
          {data && (
            <div className="stack" style={{ gap: 14 }}>
              {out ? (
                <>
                  <h3 className="t-strong" style={{ fontSize: 14 }}>{t("books.match.costs")}</h3>
                  {data.costs.length === 0 ? <p className="foot-note">{t("books.match.noCosts")}</p> : (
                    <ul className="stack" style={{ gap: 6, listStyle: "none", margin: 0, padding: 0 }}>
                      {data.costs.map((c) => (
                        <li key={c.id} className="flex items-center gap-3" style={{ border: "1px solid var(--soft)", borderRadius: 10, padding: "8px 12px" }}>
                          <div className="grow min-w-0">
                            <p className="t-strong truncate" style={{ margin: 0 }}>{c.vendor || c.description || "—"}</p>
                            <p className="t-sub" style={{ margin: 0 }}>{[format(day(c.date), "PP", { locale }), c.projectName, c.status === "pending_review" ? t("books.bank.toReview") : null].filter(Boolean).join(" · ")}</p>
                          </div>
                          <button type="button" className="btn btn-sm btn-navy" disabled={act.isPending} onClick={() => act.mutate(() => booksApi.matchCost(line.id, c.id))}>{t("books.match.same")}</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <h3 className="t-strong" style={{ fontSize: 14 }}>{t("books.match.newCost")}</h3>
                  <p className="foot-note" style={{ marginTop: -8 }}>{t("books.match.newCostHelp")}</p>
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="m-cat">{t("books.match.category")}</label>
                      <select id="m-cat" value={category} onChange={(e) => setCategory(e.target.value as CostCategory)}>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{t(`jobs.cost.${c}`)}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="m-job">{t("books.match.job")}</label>
                      <select id="m-job" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                        <option value="">{t("books.match.noJob")}</option>
                        {(jobs.data?.items ?? []).filter((j) => j.status !== "completed").map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div><button type="button" className="btn btn-sm btn-outline-navy" disabled={act.isPending} onClick={() => act.mutate(() => booksApi.createCost(line.id, category, projectId || null))}><Plus className="h-4 w-4" /> {t("books.match.createCost")}</button></div>
                </>
              ) : (
                <>
                  <h3 className="t-strong" style={{ fontSize: 14 }}>{t("books.match.payments")}</h3>
                  {data.payments.length === 0 ? <p className="foot-note">{t("books.match.noPayments")}</p> : (
                    <ul className="stack" style={{ gap: 6, listStyle: "none", margin: 0, padding: 0 }}>
                      {data.payments.map((p) => (
                        <li key={p.id} className="flex items-center gap-3" style={{ border: "1px solid var(--soft)", borderRadius: 10, padding: "8px 12px" }}>
                          <div className="grow min-w-0">
                            <p className="t-strong truncate" style={{ margin: 0 }}>{p.invoiceNumber} · {p.customer}</p>
                            <p className="t-sub" style={{ margin: 0 }}>{format(day(p.date), "PP", { locale })} · {t(`books.method.${p.method}`)}</p>
                          </div>
                          <button type="button" className="btn btn-sm btn-navy" disabled={act.isPending} onClick={() => act.mutate(() => booksApi.matchPayment(line.id, p.id))}>{t("books.match.same")}</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <h3 className="t-strong" style={{ fontSize: 14 }}>{t("books.match.invoices")}</h3>
                  <p className="foot-note" style={{ marginTop: -8 }}>{t("books.match.invoicesHelp")}</p>
                  {data.invoices.length === 0 ? <p className="foot-note">{t("books.match.noInvoices")}</p> : (
                    <ul className="stack" style={{ gap: 6, listStyle: "none", margin: 0, padding: 0 }}>
                      {data.invoices.map((i) => (
                        <li key={i.id} className="flex items-center gap-3" style={{ border: "1px solid var(--soft)", borderRadius: 10, padding: "8px 12px" }}>
                          <div className="grow min-w-0">
                            <p className="t-strong truncate" style={{ margin: 0 }}>{i.number} · {i.customer}</p>
                            <p className="t-sub" style={{ margin: 0 }}>{t("books.match.owing").replace("{amount}", formatCents(i.balanceCents))}{i.exact ? ` · ${t("books.match.exact")}` : ""}</p>
                          </div>
                          <button type="button" className={cn("btn btn-sm", i.exact ? "btn-navy" : "btn-outline-navy")} disabled={act.isPending} onClick={() => act.mutate(() => booksApi.recordPayment(line.id, i.id))}>{t("books.match.recordPayment")}</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => onOpenChange(false)}>{t("jobs.cancel")}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Materials claims ─────────────────────────────────────────────────────────

function ClaimsTab() {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["books-claims"], queryFn: booksApi.claims });
  const merge = useMutation({
    mutationFn: ({ claim, receipt }: { claim: string; receipt: string }) => booksApi.mergeClaim(claim, receipt),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["books-claims"] }); queryClient.invalidateQueries({ queryKey: ["books-close"] }); toast({ title: t("books.claims.mergedToast") }); },
    onError: (e: Error & { code?: string }) => toast({ title: t("jobs.error"), description: e.code === "CLAIM_SYNCED" ? t("books.claims.synced") : e.message, variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-40 w-full rounded-[var(--radius-mk)]" />;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="notice info"><Info /><span className="grow">{t("books.claims.intro")}</span></div>
      {!data || data.claims.length === 0 ? <div className="card card-empty">{t("books.claims.empty")}</div> : data.claims.map((c) => (
        <section key={c.costEntryId} className="card">
          <div className="card-head">
            <div className="min-w-0">
              <h2 className="truncate">{c.body || t("books.claims.materials")} · {formatCents(c.totalCents)}</h2>
              <p className="sub">
                {t("books.claims.by").replace("{name}", c.authorName || "—").replace("{date}", format(new Date(c.reportedAt), "PP", { locale }))}
                {c.projectId ? <> · <Link href={`/dashboard/jobs/${c.projectId}?tab=costs`} className="text-link">{c.projectName}</Link></> : null}
              </p>
            </div>
            <span className="chip chip-yellow">{t("books.claims.claim")}</span>
          </div>
          {c.receipts.length === 0 ? (
            <div className="card-foot">
              <span className="foot-note">{t("books.claims.noReceipt")}</span>
              <Link href="/dashboard/documents" className="cta-link" style={{ fontSize: 13 }}>{t("books.claims.scan")} <ArrowRight className="chev" /></Link>
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {c.receipts.map((r) => (
                <li key={r.id} className="flex items-center gap-3" style={{ borderTop: "1px solid var(--soft)", padding: "10px 20px" }}>
                  <div className="grow min-w-0">
                    <p className="t-strong truncate" style={{ margin: 0 }}>{r.vendor || r.description || t("books.claims.receipt")} · {formatCents(r.totalCents)}</p>
                    <p className="t-sub" style={{ margin: 0 }}>
                      {format(day(r.date), "PP", { locale })}
                      {r.taxCents > 0 ? ` · ${t("books.claims.tax").replace("{amount}", formatCents(r.taxCents))}` : ""}
                      {r.totalCents !== c.totalCents ? ` · ${t("books.claims.diff").replace("{amount}", formatCents(Math.abs(r.totalCents - c.totalCents)))}` : ""}
                    </p>
                  </div>
                  <button type="button" className="btn btn-sm btn-navy shrink-0" disabled={merge.isPending} onClick={() => merge.mutate({ claim: c.costEntryId, receipt: r.id })}><Link2 className="h-3.5 w-3.5" /> {t("books.claims.same")}</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
