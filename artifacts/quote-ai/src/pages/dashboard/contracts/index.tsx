import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { FileSignature, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { contractsApi, type ContractDto } from "@/lib/contracts-api";

const FILTERS = ["all", "review", "signed", "closed"] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_KEY: Record<Filter, string> = { all: "all", review: "sent", signed: "signed", closed: "closed" };

function statusChip(status: ContractDto["status"], t: (key: string) => string): { cls: string; label: string } {
  if (status === "signed") return { cls: "chip-green", label: t("contracts.status.signed") };
  if (status === "sent" || status === "viewed") return { cls: "chip-yellow", label: t(`contracts.status.${status}`) };
  if (status === "draft") return { cls: "chip-grey", label: t("contracts.status.draft") };
  return { cls: "chip-grey", label: t(`contracts.status.${status}`) };
}

export default function ContractsListPage() {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery({ queryKey: ["contracts"], queryFn: contractsApi.list });
  const [filter, setFilter] = useState<Filter>("all");

  const items = useMemo(() => {
    const all = data?.items ?? [];
    return all.filter((c) => {
      if (filter === "all") return true;
      if (filter === "review") return c.status === "sent" || c.status === "viewed";
      if (filter === "signed") return c.status === "signed";
      return ["draft", "declined", "voided", "expired"].includes(c.status);
    });
  }, [data, filter]);

  return (
    <div className="animate-in fade-in duration-500">
      <div className="page-head">
        <div>
          <h1>{t("contracts.title")}</h1>
          <p className="sub">{t("contracts.subtitle")}</p>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="pills">
            {FILTERS.map((f) => (
              <button key={f} type="button" className={cn("pill", filter === f && "on")} onClick={() => setFilter(f)}>
                {t(`contracts.filter.${FILTER_KEY[f]}`)}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full rounded-[var(--radius-sm)]" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-14 px-5">
            <FileSignature className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-20" />
            <h3 className="text-base font-medium text-foreground mb-1">{t("contracts.emptyTitle")}</h3>
            <p className="text-sm text-muted-foreground mb-2">{t("contracts.emptyDesc")}</p>
            <Link href="/dashboard/quotes" className="cta-link mx-auto">{t("contracts.goToQuotes")}</Link>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("contracts.col.contract")}</th>
                  <th>{t("contracts.col.client")}</th>
                  <th>{t("contracts.col.status")}</th>
                  <th>{t("contracts.col.sent")}</th>
                  <th>{t("contracts.col.signed")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => {
                  const chip = statusChip(c.status, t);
                  return (
                    <tr key={c.id} onClick={() => navigate(`/dashboard/contracts/${c.id}`)} className="cursor-pointer">
                      <td>
                        <span className="t-strong">{c.contractNumber}</span>
                        <span className="t-sub">{c.variables.projectTitle}</span>
                      </td>
                      <td>{c.variables.customer.name}</td>
                      <td><span className={cn("chip", chip.cls)}>{chip.label}</span></td>
                      <td>{c.sentAt ? format(new Date(c.sentAt), "PP", { locale }) : "—"}</td>
                      <td>{c.signedAt ? format(new Date(c.signedAt), "PP", { locale }) : "—"}</td>
                      <td><ChevronRight className="chev" style={{ color: "var(--faint)" }} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && items.length > 0 && (
          <div className="card-foot">
            <span className="foot-note">
              {t("contracts.footShowing").replace("{shown}", String(items.length)).replace("{total}", String(data?.items.length ?? 0))}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

