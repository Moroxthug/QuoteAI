import { useMemo, useState } from "react";
import { rowLink } from "@/lib/row-link";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { FileSignature, ChevronRight } from "lucide-react";
import { ListSkeleton } from "@/components/skeletons";
import { usePrefetchOnPress } from "@/hooks/use-prefetch-on-press";
import { useProgressiveList } from "@/hooks/use-progressive-list";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ListRow } from "@/components/mobile/list-row";
import { PhoneListBar } from "@/components/mobile/list-filter";
import { formatCadWhole } from "@/lib/money";
import { contractsApi, type ContractDto } from "@/lib/contracts-api";

const FILTERS = ["all", "review", "signed", "closed"] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_KEY: Record<Filter, string> = { all: "all", review: "sent", signed: "signed", closed: "closed" };

function inFilter(c: ContractDto, f: Filter): boolean {
  if (f === "all") return true;
  if (f === "review") return c.status === "sent" || c.status === "viewed";
  if (f === "signed") return c.status === "signed";
  return ["draft", "declined", "voided", "expired"].includes(c.status);
}

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
  const [search, setSearch] = useState("");
  const phone = useMediaQuery("(max-width: 640px)");
  const press = usePrefetchOnPress();

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.items ?? []).filter((c) => inFilter(c, filter) && (!q || c.contractNumber.toLowerCase().includes(q) || c.variables.customer.name.toLowerCase().includes(q) || c.variables.projectTitle.toLowerCase().includes(q)));
  }, [data, filter, search]);
  // Phase 115: a long list draws its first 50 rows now, the rest when idle.
  const shown = useProgressiveList(items);

  return (
    <div className="animate-in fade-in duration-500">
      <div className="page-head">
        <div>
          <h1>{t("contracts.title")}</h1>
          <p className="sub">{t("contracts.subtitle")}</p>
        </div>
      </div>

      <div className="card qlist">
        {phone ? (
          <PhoneListBar<Filter>
            search={search}
            onSearch={setSearch}
            placeholder={t("contracts.m.search")}
            filters={FILTERS.map((f) => ({ id: f, label: t(`contracts.filter.${FILTER_KEY[f]}`), count: (data?.items ?? []).filter((c) => inFilter(c, f)).length }))}
            value={filter}
            onChange={setFilter}
          />
        ) : (
        <div className="toolbar">
          <div className="pills">
            {FILTERS.map((f) => (
              <button key={f} type="button" className={cn("pill", filter === f && "on")} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {t(`contracts.filter.${FILTER_KEY[f]}`)}
              </button>
            ))}
          </div>
        </div>
        )}

        {isLoading ? (
          <ListSkeleton rows={6} />
        ) : items.length === 0 ? (
          <div className="text-center py-14 px-5">
            <FileSignature className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-20" />
            <h3 className="text-base font-medium text-foreground mb-1">{t("contracts.emptyTitle")}</h3>
            <p className="text-sm text-muted-foreground mb-2">{t("contracts.emptyDesc")}</p>
            <Link href="/dashboard/quotes" className="cta-link mx-auto">{t("contracts.goToQuotes")}</Link>
          </div>
        ) : phone ? (
          // Phase 107: the client, the contract and its job / the price / where it stands.
          <ul className="lrows" aria-label={t("contracts.title")}>
            {shown.map((c) => {
              const chip = statusChip(c.status, t);
              return (
                <li key={c.id}>
                  <ListRow
                    href={`/dashboard/contracts/${c.id}`}
                    title={c.variables.customer.name || c.contractNumber}
                    meta={[c.contractNumber, c.variables.projectTitle]}
                    amount={formatCadWhole(c.variables.total)}
                    end={<span className={cn("chip", chip.cls)}>{chip.label}</span>}
                  />
                </li>
              );
            })}
          </ul>
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
                {shown.map((c) => {
                  const chip = statusChip(c.status, t);
                  return (
                    <tr key={c.id} {...rowLink(() => navigate(`/dashboard/contracts/${c.id}`))} {...press(`/dashboard/contracts/${c.id}`)}>
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

