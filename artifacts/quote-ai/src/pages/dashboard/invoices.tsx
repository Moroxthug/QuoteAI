import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Receipt, Search, ChevronRight, Plus, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { useGetBusinessProfile } from "@workspace/api-client-react";
import { hasFeature } from "@/lib/plans";
import { formatCents } from "@/lib/jobs-api";
import { invoicesApi, isOpenInvoice, type InvoiceDto, type AgingDto } from "@/lib/invoices-api";
import { InvoiceStatusBadge, InvoiceTypeBadge } from "@/components/jobs/badges";
import { NewInvoiceDialog } from "@/components/invoices/invoice-dialogs";

const FILTERS = ["all", "draft", "open", "overdue", "paid", "void"] as const;
type Filter = (typeof FILTERS)[number];

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
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            <Receipt className="h-8 w-8 text-violet-600" />
            {t("invoices.title")}
          </h1>
          <p className="text-slate-500 mt-1">{t("invoices.subtitle")}</p>
        </div>
        <Button className="gap-2" onClick={() => setNewOpen(true)} disabled={gated}><Plus className="h-4 w-4" /> {t("invoices.new")}</Button>
      </div>

      {gated || (error as Error & { code?: string } | null)?.code === "PLAN_REQUIRED" ? (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-8 text-center">
          <Receipt className="h-10 w-10 text-violet-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-800">{t("invoices.gatedTitle")}</h2>
          <p className="text-slate-600 text-sm mt-1 max-w-md mx-auto">{t("invoices.gatedDesc")}</p>
          <Link href="/dashboard/billing" className="inline-block mt-4 text-sm font-medium text-violet-600 hover:underline">{t("invoices.upgrade")}</Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label={t("invoices.stat.outstanding")} value={formatCents(data?.stats.outstandingCents ?? 0)} accent="text-blue-600" />
            <Stat label={t("invoices.stat.overdue")} value={formatCents(data?.stats.overdueCents ?? 0)} sub={data?.stats.overdueCount ? `${data.stats.overdueCount} ${t("invoices.stat.invoices")}` : undefined} accent={data?.stats.overdueCents ? "text-rose-600" : undefined} />
            <Stat label={t("invoices.stat.paidMonth")} value={formatCents(data?.stats.paidThisMonthCents ?? 0)} accent="text-emerald-600" />
            <Stat label={t("invoices.stat.drafts")} value={String(data?.stats.drafts ?? 0)} />
          </div>

          {data && data.aging.totalCents > 0 && <Aging aging={data.aging} />}

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit overflow-x-auto max-w-full">
              {FILTERS.map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={cn("px-3 py-1.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap", filter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
                  {t(`invoices.filter.${f}`)}
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("invoices.searchPlaceholder")} className="pl-9" />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
              <Receipt className="h-10 w-10 text-slate-300 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-slate-800">{t("invoices.emptyTitle")}</h2>
              <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">{t("invoices.emptyDesc")}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden divide-y">
              {items.map((inv) => <InvoiceRow key={inv.id} inv={inv} locale={locale} />)}
            </div>
          )}
        </>
      )}

      <NewInvoiceDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={cn("text-xl font-bold text-slate-900 mt-0.5", accent)}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

const BUCKETS: { key: keyof Omit<AgingDto, "totalCents" | "overdueCents">; color: string }[] = [
  { key: "current", color: "bg-emerald-400" },
  { key: "d1_30", color: "bg-amber-400" },
  { key: "d31_60", color: "bg-orange-500" },
  { key: "d61_90", color: "bg-rose-500" },
  { key: "d90_plus", color: "bg-rose-800" },
];

function Aging({ aging }: { aging: AgingDto }) {
  const { t } = useLanguage();
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-slate-900 inline-flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400" /> {t("invoices.aging.title")}</h2>
        <span className="text-sm text-slate-600">{t("invoices.aging.total")} <span className="font-semibold text-slate-900">{formatCents(aging.totalCents)}</span></span>
      </div>
      <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex">
        {BUCKETS.map((b) => (aging[b.key] > 0 ? <div key={b.key} className={cn("h-full", b.color)} style={{ width: `${(aging[b.key] / aging.totalCents) * 100}%` }} title={`${t(`invoices.aging.${b.key}`)}: ${formatCents(aging[b.key])}`} /> : null))}
      </div>
      <div className="grid grid-cols-5 gap-2 mt-2">
        {BUCKETS.map((b) => (
          <div key={b.key} className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate"><span className={cn("h-2 w-2 rounded-full shrink-0", b.color)} /> {t(`invoices.aging.${b.key}`)}</div>
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
  return (
    <Link href={`/dashboard/invoices/${inv.id}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 transition-colors">
      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", overdue ? "bg-rose-50 text-rose-600" : inv.status === "paid" ? "bg-emerald-50 text-emerald-600" : "bg-violet-50 text-violet-600")}>
        {overdue ? <AlertTriangle className="h-5 w-5" /> : <Receipt className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-900">{inv.number}</span>
          <InvoiceStatusBadge status={inv.status} scheduled={scheduled} />
          {!compact && <InvoiceTypeBadge type={inv.type} />}
          {inv.autoSendAt && inv.status === "draft" && <span className="text-[11px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">{t("invoices.autoSendAt")} {format(new Date(inv.autoSendAt), "PPp", { locale })}</span>}
        </div>
        <div className="text-sm text-slate-500 truncate">
          {inv.clientName}{inv.projectName ? ` · ${inv.projectName}` : ""}{inv.paymentTermLabel && !compact ? ` · ${inv.paymentTermLabel}` : ""}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={cn("font-semibold", inv.type === "credit_note" ? "text-rose-600" : "text-slate-900")}>{formatCents(inv.totalCents)}</div>
        <div className={cn("text-xs", overdue ? "text-rose-600 font-medium" : "text-slate-400")}>
          {inv.status === "paid" && inv.paidAt ? `${t("invoices.paidOn")} ${format(new Date(inv.paidAt), "PP", { locale })}`
            : isOpenInvoice(inv.status) ? `${inv.paidCents > 0 ? `${formatCents(inv.balanceCents)} ${t("invoices.due")} · ` : ""}${t("invoices.dueOn")} ${format(new Date(inv.dueDate), "PP", { locale })}`
            : scheduled ? `${t("invoices.sendableOn")} ${format(new Date(inv.scheduledFor!), "PP", { locale })}`
            : format(new Date(inv.issueDate), "PP", { locale })}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
    </Link>
  );
}
