import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Receipt, Search, ChevronRight, Plus, AlertTriangle, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { useGetBusinessProfile } from "@workspace/api-client-react";
import { hasFeature } from "@/lib/plans";
import { formatCents } from "@/lib/jobs-api";
import { invoicesApi, isOpenInvoice, type InvoiceDto, type AgingDto, type InvoiceStatus } from "@/lib/invoices-api";
import { InvoiceStatusBadge, InvoiceTypeBadge } from "@/components/jobs/badges";
import { NewInvoiceDialog } from "@/components/invoices/invoice-dialogs";

const FILTERS = ["all", "draft", "open", "overdue", "paid", "void"] as const;
type Filter = (typeof FILTERS)[number];

function statusChip(status: InvoiceStatus): string {
  if (status === "paid") return "chip-green";
  if (status === "overdue") return "chip-red";
  if (status === "void") return "chip-grey";
  if (status === "draft") return "chip-grey";
  return "chip-yellow";
}

export default function InvoicesPage() {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const { data: profile } = useGetBusinessProfile();
  const gated = profile ? !hasFeature(profile as never, "invoicing") : false;
  const { data, isLoading, error } = useQuery({ queryKey: ["invoices"], queryFn: invoicesApi.list, enabled: !gated, retry: false });
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  const items = useMemo(() => {
    const all = data?.items ?? [];
    const q = search.trim().toLowerCase();
    return all.filter((i) => {
      const inFilter =
        filter === "all" ? true
        : filter === "open" ? isOpenInvoice(i.status)
        : i.status === filter;
      const inSearch = !q || i.number.toLowerCase().includes(q) || (i.clientName ?? "").toLowerCase().includes(q) || (i.projectName ?? "").toLowerCase().includes(q);
      return inFilter && inSearch;
    });
  }, [data, filter, search]);

  return (
    <div className="animate-in fade-in duration-300">
      <div className="page-head">
        <div>
          <h1>{t("invoices.title")}</h1>
          <p className="sub">{t("invoices.subtitle")}</p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn-navy" onClick={() => setNewOpen(true)} disabled={gated}><Plus className="h-4 w-4" /> {t("invoices.new")}</button>
        </div>
      </div>

      {gated || (error as Error & { code?: string } | null)?.code === "PLAN_REQUIRED" ? (
        <div className="card" style={{ padding: "40px 22px", textAlign: "center" }}>
          <Receipt className="h-10 w-10 text-navy-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-800">{t("invoices.gatedTitle")}</h2>
          <p className="text-slate-600 text-sm mt-1 max-w-md mx-auto">{t("invoices.gatedDesc")}</p>
          <Link href="/dashboard/billing" className="cta-link" style={{ justifyContent: "center", marginTop: 16 }}>{t("invoices.upgrade")}</Link>
        </div>
      ) : (
        <>
          <div className="stat-grid">
            <Stat label={t("invoices.stat.outstanding")} value={formatCents(data?.stats.outstandingCents ?? 0)} />
            <Stat label={t("invoices.stat.overdue")} value={formatCents(data?.stats.overdueCents ?? 0)} sub={data?.stats.overdueCount ? `${data.stats.overdueCount} ${t("invoices.stat.invoices")}` : undefined} neg={!!data?.stats.overdueCents} />
            <Stat label={t("invoices.stat.paidMonth")} value={formatCents(data?.stats.paidThisMonthCents ?? 0)} />
            <Stat label={t("invoices.stat.drafts")} value={String(data?.stats.drafts ?? 0)} />
          </div>

          {data && data.aging.totalCents > 0 && <Aging aging={data.aging} />}

          <div className="card" style={{ marginTop: 16 }}>
            <div className="toolbar">
              <div className="pills">
                {FILTERS.map((f) => (
                  <button key={f} type="button" className={cn("pill", filter === f && "on")} onClick={() => setFilter(f)}>{t(`invoices.filter.${f}`)}</button>
                ))}
              </div>
              <label className="search sm grow">
                <Search className="h-4 w-4" />
                <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("invoices.searchPlaceholder")} aria-label={t("invoices.searchPlaceholder")} />
              </label>
            </div>

            {isLoading ? (
              <div className="p-5 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full rounded-[var(--radius-sm)]" />)}</div>
            ) : items.length === 0 ? (
              <div className="text-center py-14 px-5">
                <Receipt className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-20" />
                <h3 className="text-base font-medium text-foreground mb-1">{t("invoices.emptyTitle")}</h3>
                <p className="text-sm text-muted-foreground">{t("invoices.emptyDesc")}</p>
              </div>
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
                    {items.map((inv) => <InvoiceTableRow key={inv.id} inv={inv} locale={locale} />)}
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
    </div>
  );
}

function InvoiceTableRow({ inv, locale }: { inv: InvoiceDto; locale: typeof enCA }) {
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  return (
    <tr onClick={() => navigate(`/dashboard/invoices/${inv.id}`)} className="cursor-pointer">
      <td className="t-strong">{inv.number}</td>
      <td>{inv.clientName}{inv.projectName ? <span className="t-sub">{inv.projectName}</span> : null}</td>
      <td>{format(new Date(inv.issueDate), "PP", { locale })}</td>
      <td>{format(new Date(inv.dueDate), "PP", { locale })}</td>
      <td className="t-amt" style={{ textAlign: "right" }}>{formatCents(inv.totalCents)}</td>
      <td><span className={cn("chip", statusChip(inv.status))}>{t(`invoices.status.${inv.status}`)}</span></td>
    </tr>
  );
}

function Stat({ label, value, sub, neg }: { label: string; value: string; sub?: string; neg?: boolean }) {
  return (
    <div className="card stat-card">
      <p className="lbl">{label}</p>
      <p className="val">{value}</p>
      {sub && <p className={cn("delta", neg ? "neg" : "flat")}>{sub}</p>}
    </div>
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
    <section className="card" style={{ marginTop: 16, padding: "18px 22px" }}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-slate-900 inline-flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400" /> {t("invoices.aging.title")}</h2>
        <span className="text-sm text-slate-600">{t("invoices.aging.total")} <span className="font-semibold text-slate-900">{formatCents(aging.totalCents)}</span></span>
      </div>
      <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex">
        {BUCKETS.map((b) => (aging[b.key] > 0 ? <div key={b.key} className="h-full" style={{ width: `${(aging[b.key] / aging.totalCents) * 100}%`, background: b.color }} title={`${t(`invoices.aging.${b.key}`)}: ${formatCents(aging[b.key])}`} /> : null))}
      </div>
      <div className="grid grid-cols-5 gap-2 mt-2">
        {BUCKETS.map((b) => (
          <div key={b.key} className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate"><span className="h-2 w-2 rounded-full shrink-0" style={{ background: b.color }} /> {t(`invoices.aging.${b.key}`)}</div>
            <div className={cn("text-sm font-semibold tabular-nums", aging[b.key] > 0 ? "text-slate-900" : "text-slate-300")}>{formatCents(aging[b.key])}</div>
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
  return (
    <Link href={`/dashboard/invoices/${inv.id}`} className="q-row">
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
