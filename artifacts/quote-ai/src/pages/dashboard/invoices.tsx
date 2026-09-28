import { useEffect, useMemo, useState } from "react";
import { rowLink } from "@/lib/row-link";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Receipt, Search, ChevronRight, Plus, AlertTriangle, Clock } from "lucide-react";
import { ListSkeleton, StatStripSkeleton } from "@/components/skeletons";
import { EmptyState, ErrorState, PlanLocked } from "@/components/states";
import { usePrefetchOnPress } from "@/hooks/use-prefetch-on-press";
import { useProgressiveList } from "@/hooks/use-progressive-list";
import { InvoiceListRow, invoiceStatusChip } from "@/components/invoices/invoice-list-row";
import { PhoneListBar } from "@/components/mobile/list-filter";
import { StatStrip } from "@/components/mobile/stat-strip";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";
import { useGetBusinessProfile } from "@workspace/api-client-react";
import { hasFeature } from "@/lib/plans";
import { formatCents } from "@/lib/jobs-api";
import { invoicesApi, isOpenInvoice, type InvoiceDto, type AgingDto } from "@/lib/invoices-api";
import { InvoiceStatusBadge, InvoiceTypeBadge } from "@/components/jobs/badges";
import { NewInvoiceDialog, RecordPaymentDialog } from "@/components/invoices/invoice-dialogs";
import { UpgradeLink } from "@/components/billing/upgrade-link";

const FILTERS = ["all", "draft", "open", "overdue", "paid", "void"] as const;
type Filter = (typeof FILTERS)[number];

const inFilter = (i: InvoiceDto, f: Filter): boolean => (f === "all" ? true : f === "open" ? isOpenInvoice(i.status) : i.status === f);


export default function InvoicesPage() {
  const { t, lang } = useLanguage();
  const can = useCan();
  const phone = useMediaQuery("(max-width: 640px)");
  const locale = lang === "fr" ? frCA : enCA;
  const { data: profile } = useGetBusinessProfile();
  const gated = profile ? !hasFeature(profile as never, "invoicing") : false;
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["invoices"], queryFn: invoicesApi.list, enabled: !gated, retry: false });
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [paying, setPaying] = useState<InvoiceDto | null>(null);
  // Phase 107: the phone New sheet opens the form with ?new=1 (then drops it, so Back does not reopen it).
  const query = useSearch();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (new URLSearchParams(query).get("new") !== "1" || !profile) return;
    if (!gated) setNewOpen(true);
    navigate("/dashboard/invoices", { replace: true });
  }, [query, navigate, gated, profile]);
  const all = data?.items ?? [];

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.items ?? []).filter((i) => {
      const inSearch = !q || i.number.toLowerCase().includes(q) || (i.clientName ?? "").toLowerCase().includes(q) || (i.projectName ?? "").toLowerCase().includes(q);
      return inFilter(i, filter) && inSearch;
    });
  }, [data, filter, search]);
  // Phase 115: a long list draws its first 50 rows now, the rest when idle.
  const shown = useProgressiveList(items);

  return (
    <div className="animate-in fade-in duration-300">
      <div className="page-head">
        <div>
          <h1>{t("invoices.title")}</h1>
          <p className="sub">{t("invoices.subtitle")}</p>
        </div>
        {can("invoicing", "edit") && (
          <div className="head-actions hide-phone">
            <button type="button" className="btn btn-navy" onClick={() => setNewOpen(true)} disabled={gated}><Plus className="h-4 w-4" /> {t("invoices.new")}</button>
          </div>
        )}
      </div>

      {gated || (error as Error & { code?: string } | null)?.code === "PLAN_REQUIRED" ? (
        <div className="card">
          <PlanLocked title={t("invoices.gatedTitle")} body={t("invoices.gatedDesc")} action={<UpgradeLink className="btn btn-sm btn-navy">{t("invoices.upgrade")}</UpgradeLink>} />
        </div>
      ) : (
        <>
          {/* Phase 107: the four numbers as one strip (two by two on a phone). */}
          {isLoading ? <StatStripSkeleton cells={4} /> : <StatStrip
            label={t("invoices.title")}
            items={[
              { label: t("invoices.stat.outstanding"), value: formatCents(data?.stats.outstandingCents ?? 0) },
              { label: t("invoices.stat.overdue"), value: formatCents(data?.stats.overdueCents ?? 0), tone: data?.stats.overdueCents ? "bad" : undefined, sub: data?.stats.overdueCount ? `${data.stats.overdueCount} ${t("invoices.stat.invoices")}` : undefined },
              { label: t("invoices.stat.paidMonth"), value: formatCents(data?.stats.paidThisMonthCents ?? 0) },
              { label: t("invoices.stat.drafts"), value: String(data?.stats.drafts ?? 0) },
            ]}
          />}

          {data && data.aging.totalCents > 0 && <Aging aging={data.aging} />}

          <div className="card qlist" style={{ marginTop: 16 }}>
            {phone ? (
              <PhoneListBar<Filter>
                search={search}
                onSearch={setSearch}
                placeholder={t("invoices.searchPlaceholder")}
                filters={FILTERS.map((f) => ({ id: f, label: t(`invoices.filter.${f}`), count: all.filter((i) => inFilter(i, f)).length }))}
                value={filter}
                onChange={setFilter}
              />
            ) : (
            <div className="toolbar">
              <div className="pills">
                {FILTERS.map((f) => (
                  <button key={f} type="button" className={cn("pill", filter === f && "on")} aria-pressed={filter === f} onClick={() => setFilter(f)}>{t(`invoices.filter.${f}`)}</button>
                ))}
              </div>
              <label className="search sm grow">
                <Search className="h-4 w-4" />
                <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("invoices.searchPlaceholder")} aria-label={t("invoices.searchPlaceholder")} />
              </label>
            </div>
            )}

            {isLoading ? (
              <ListSkeleton rows={6} />
            ) : error && !data ? (
              <ErrorState onRetry={() => void refetch()} />
            ) : items.length === 0 ? (
              filter !== "all" || search.trim() ? (
                <EmptyState art="search" title={t("states.search.empty")} action={<button type="button" className="btn btn-sm btn-outline-navy" onClick={() => { setFilter("all"); setSearch(""); }}>{t("dashboard.quotesList.clearFilters")}</button>} />
              ) : (
                <EmptyState art="invoices" title={t("states.invoices.empty")} action={can("invoicing", "edit") ? <button type="button" className="btn btn-sm btn-navy" onClick={() => setNewOpen(true)}>{t("invoices.new")}</button> : undefined} />
              )
            ) : phone ? (
              <ul className="lrows" aria-label={t("invoices.title")}>
                {shown.map((inv) => <li key={inv.id}><InvoiceListRow inv={inv} locale={locale} onRecord={can("invoicing", "edit") ? setPaying : undefined} /></li>)}
              </ul>
            ) : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>{t("invoices.col.invoice")}</th>
                      <th>{t("invoices.col.client")}</th>
                      <th>{t("invoices.col.issued")}</th>
                      <th>{t("invoices.col.due")}</th>
                      <th style={{ textAlign: "right" }}>{t("invoices.col.amount")}</th>
                      <th>{t("invoices.col.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((inv) => <InvoiceTableRow key={inv.id} inv={inv} locale={locale} />)}
                  </tbody>
                </table>
              </div>
            )}
            <div className="card-foot">
              <span className="foot-note">{t("invoices.showingCount").replace("{shown}", String(items.length)).replace("{total}", String(data?.items.length ?? 0))}</span>
            </div>
          </div>
        </>
      )}

      <NewInvoiceDialog open={newOpen} onOpenChange={setNewOpen} />
      {paying && <RecordPaymentDialog invoice={paying} open onOpenChange={(v) => !v && setPaying(null)} />}
    </div>
  );
}

function InvoiceTableRow({ inv, locale }: { inv: InvoiceDto; locale: typeof enCA }) {
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const press = usePrefetchOnPress();
  return (
    <tr {...rowLink(() => navigate(`/dashboard/invoices/${inv.id}`))} {...press(`/dashboard/invoices/${inv.id}`)}>
      <td className="t-strong">{inv.number}</td>
      <td>{inv.clientName}{inv.projectName ? <span className="t-sub">{inv.projectName}</span> : null}</td>
      <td>{format(new Date(inv.issueDate), "PP", { locale })}</td>
      <td>{format(new Date(inv.dueDate), "PP", { locale })}</td>
      <td className="t-amt" style={{ textAlign: "right" }}>{formatCents(inv.totalCents)}</td>
      <td><span className={cn("chip", invoiceStatusChip(inv.status))}>{t(`invoices.status.${inv.status}`)}</span></td>
    </tr>
  );
}

const BUCKETS: { key: keyof Omit<AgingDto, "totalCents" | "overdueCents">; color: string }[] = [
  { key: "current", color: "#34d399" },
  { key: "d1_30", color: "#fbbf24" },
  { key: "d31_60", color: "#f97316" },
  { key: "d61_90", color: "#f43f5e" },
  { key: "d90_plus", color: "#9f1239" },
];

function Aging({ aging }: { aging: AgingDto }) {
  const { t } = useLanguage();
  return (
    <section className="card aging-card" style={{ marginTop: 16 }}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-slate-900 inline-flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400" /> {t("invoices.aging.title")}</h2>
        <span className="text-sm text-slate-600">{t("invoices.aging.total")} <span className="font-semibold text-slate-900">{formatCents(aging.totalCents)}</span></span>
      </div>
      <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex">
        {BUCKETS.map((b) => (aging[b.key] > 0 ? <div key={b.key} className="h-full" style={{ width: `${(aging[b.key] / aging.totalCents) * 100}%`, background: b.color }} title={`${t(`invoices.aging.${b.key}`)}: ${formatCents(aging[b.key])}`} /> : null))}
      </div>
      <div className="aging-legend">
        {BUCKETS.map((b) => (
          <div key={b.key} className={cn("min-w-0", aging[b.key] === 0 && "aging-zero")}>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate"><span className="h-2 w-2 rounded-full shrink-0" style={{ background: b.color }} /> {t(`invoices.aging.${b.key}`)}</div>
            <div className={cn("text-sm font-semibold tabular-nums", aging[b.key] > 0 ? "text-slate-900" : "text-slate-500")}>{formatCents(aging[b.key])}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function InvoiceRow({ inv, locale, compact }: { inv: InvoiceDto; locale: typeof enCA; compact?: boolean }) {
  const { t } = useLanguage();
  const overdue = inv.status === "overdue";
  const scheduled = inv.status === "draft" && !!inv.scheduledFor && new Date(inv.scheduledFor) > new Date();
  const when = inv.status === "paid" && inv.paidAt ? `${t("invoices.paidOn")} ${format(new Date(inv.paidAt), "PP", { locale })}`
    : isOpenInvoice(inv.status) ? `${inv.paidCents > 0 ? `${formatCents(inv.balanceCents)} ${t("invoices.due")} · ` : ""}${t("invoices.dueOn")} ${format(new Date(inv.dueDate), "PP", { locale })}`
    : scheduled ? `${t("invoices.sendableOn")} ${format(new Date(inv.scheduledFor!), "PP", { locale })}`
    : format(new Date(inv.issueDate), "PP", { locale });
  const press = usePrefetchOnPress();
  return (
    <Link href={`/dashboard/invoices/${inv.id}`} className="q-row" {...press(`/dashboard/invoices/${inv.id}`)}>
      <span className={cn("q-ic", overdue && "bg-[var(--red-t)] text-[var(--red)]", inv.status === "paid" && "bg-[var(--green-t)] text-[var(--green-dark)]")}>
        {overdue ? <AlertTriangle className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
      </span>
      <div className="q-body">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="q-title">{inv.number}</p>
          <InvoiceStatusBadge status={inv.status} scheduled={scheduled} />
          {!compact && <InvoiceTypeBadge type={inv.type} />}
          {inv.autoSendAt && inv.status === "draft" && <span className="chip chip-yellow">{t("invoices.autoSendAt")} {format(new Date(inv.autoSendAt), "PPp", { locale })}</span>}
        </div>
        <div className="q-meta">
          <span className="q-date truncate">{inv.clientName}{inv.projectName ? ` · ${inv.projectName}` : ""}{inv.paymentTermLabel && !compact ? ` · ${inv.paymentTermLabel}` : ""}</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={cn("q-amt", inv.type === "credit_note" && "text-[var(--red)]")}>{formatCents(inv.totalCents)}</div>
        <div className="q-date" style={overdue ? { color: "var(--red)" } : undefined}>{when}</div>
      </div>
      <ChevronRight className="chev" />
    </Link>
  );
}
