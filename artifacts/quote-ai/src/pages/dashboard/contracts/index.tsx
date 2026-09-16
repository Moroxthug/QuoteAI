import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { FileSignature, Search, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { contractsApi, type ContractDto } from "@/lib/contracts-api";
import { ContractStatusBadge } from "./[id]";

const formatCad = (n: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);

const FILTERS: ("all" | "draft" | "sent" | "signed" | "closed")[] = ["all", "draft", "sent", "signed", "closed"];

export default function ContractsListPage() {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const { data, isLoading } = useQuery({ queryKey: ["contracts"], queryFn: contractsApi.list });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [search, setSearch] = useState("");

  const items = useMemo(() => {
    const all = data?.items ?? [];
    const q = search.trim().toLowerCase();
    return all.filter((c) => {
      const inFilter =
        filter === "all" ? true
        : filter === "sent" ? c.status === "sent" || c.status === "viewed"
        : filter === "closed" ? ["declined", "voided", "expired"].includes(c.status)
        : c.status === filter;
      const inSearch = !q || c.contractNumber.toLowerCase().includes(q) || c.variables.customer.name.toLowerCase().includes(q) || c.variables.projectTitle.toLowerCase().includes(q);
      return inFilter && inSearch;
    });
  }, [data, filter, search]);

  const stats = useMemo(() => {
    const all = data?.items ?? [];
    const awaiting = all.filter((c) => c.status === "sent" || c.status === "viewed");
    const signed = all.filter((c) => c.status === "signed");
    return {
      drafts: all.filter((c) => c.status === "draft").length,
      awaiting: awaiting.length,
      signedCount: signed.length,
      signedValue: signed.reduce((s, c) => s + c.variables.total, 0),
    };
  }, [data]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
          <FileSignature className="h-8 w-8 text-navy-600" />
          {t("contracts.title")}
        </h1>
        <p className="text-slate-500 mt-1">{t("contracts.subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label={t("contracts.stat.drafts")} value={String(stats.drafts)} />
        <Stat label={t("contracts.stat.awaiting")} value={String(stats.awaiting)} accent="text-blue-600" />
        <Stat label={t("contracts.stat.signed")} value={String(stats.signedCount)} accent="text-emerald-600" />
        <Stat label={t("contracts.stat.signedValue")} value={formatCad(stats.signedValue)} accent="text-emerald-600" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn("px-3 py-1.5 text-sm font-medium rounded-lg transition-all", filter === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {t(`contracts.filter.${f}`)}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("contracts.searchPlaceholder")} className="pl-9" />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-card p-12 text-center">
          <FileSignature className="h-10 w-10 text-slate-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-800">{t("contracts.emptyTitle")}</h2>
          <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">{t("contracts.emptyDesc")}</p>
          <Link href="/dashboard/quotes" className="inline-block mt-4 text-sm font-medium text-navy-600 hover:underline">{t("contracts.goToQuotes")}</Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-card overflow-hidden divide-y">
          {items.map((c) => (
            <ContractRow key={c.id} c={c} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-card px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={cn("text-xl font-bold text-slate-900 mt-0.5", accent)}>{value}</div>
    </div>
  );
}

function ContractRow({ c, locale }: { c: ContractDto; locale: Locale }) {
  const { t } = useLanguage();
  const when = c.signedAt ?? c.sentAt ?? c.createdAt;
  return (
    <Link href={`/dashboard/contracts/${c.id}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 transition-colors">
      <div className="h-10 w-10 rounded-lg bg-navy-50 text-navy-600 flex items-center justify-center shrink-0">
        <FileSignature className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-900">{c.contractNumber}</span>
          <ContractStatusBadge status={c.status} />
        </div>
        <div className="text-sm text-slate-500 truncate">{c.variables.customer.name} · {c.variables.projectTitle}</div>
      </div>
      <div className="text-right shrink-0 hidden sm:block">
        <div className="font-semibold text-slate-900">{formatCad(c.variables.total)}</div>
        <div className="text-xs text-slate-400">{t(`contracts.when.${c.signedAt ? "signed" : c.sentAt ? "sent" : "created"}`)} {format(new Date(when), "PP", { locale })}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
    </Link>
  );
}

type Locale = typeof enCA;
