import { useListClients } from "@workspace/api-client-react";
import { rowLink } from "@/lib/row-link";
import { ListSkeleton } from "@/components/skeletons";
import { EmptyState, ErrorState } from "@/components/states";
import { usePrefetchOnPress } from "@/hooks/use-prefetch-on-press";
import { useProgressiveList } from "@/hooks/use-progressive-list";
import { Link, useLocation } from "wouter";
import { Search, Plus, ChevronRight, Phone } from "lucide-react";
import { SwipeRow } from "@/components/mobile/swipe-row";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ListRow } from "@/components/mobile/list-row";
import { PhoneListBar } from "@/components/mobile/list-filter";

const formatCurrency = (v: number, lang: string) =>
  new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(v);

export default function ClientsPage() {
  const { data: clients, isLoading, error, refetch } = useListClients();
  const [search, setSearch] = useState("");
  const [, navigate] = useLocation();
  const { t, lang } = useLanguage();
  const phone = useMediaQuery("(max-width: 640px)");

  const filtered = (clients ?? []).filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.clientName.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q);
  });

  // Phase 115: first 50 rows now, the rest when idle; rows prefetch the client on press.
  const shown = useProgressiveList(filtered);
  const press = usePrefetchOnPress();
  const totalQuotes = (clients ?? []).reduce((sum, c) => sum + c.quoteCount, 0);

  return (
    <div className="animate-in fade-in duration-500">
      <div className="page-head">
        <div>
          <h1>{t("clients.title")}</h1>
          <p className="sub">{t("clients.subtitle")}</p>
        </div>
        {/* On a phone the + in the top bar starts a quote (a client comes with it). */}
        <div className="head-actions hide-phone">
          <Link href="/dashboard/new" className="btn btn-navy">
            <Plus className="h-4 w-4" />
            {t("clients.add")}
          </Link>
        </div>
      </div>

      <div className="card qlist">
        {phone ? (
          <PhoneListBar search={search} onSearch={setSearch} placeholder={t("clients.search")} />
        ) : (
        <div className="toolbar">
          <label className="search sm">
            <Search className="h-4 w-4" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t("clients.search")}
              aria-label={t("clients.search")}
            />
          </label>
        </div>
        )}

        {isLoading ? (
          <ListSkeleton rows={6} lead="avatar" />
        ) : error && !clients ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : filtered.length === 0 ? (
          search.trim() ? (
            <EmptyState art="search" title={t("states.search.empty")} action={<button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setSearch("")}>{t("dashboard.quotesList.clearFilters")}</button>} />
          ) : (
            <EmptyState art="clients" title={t("states.clients.empty")} action={<Link href="/dashboard/new" className="btn btn-navy btn-sm">{t("clients.empty.cta")}</Link>} />
          )
        ) : phone ? (
          // Phase 107: who, where and how many quotes / what they are worth / active or prospect.
          <ul className="lrows" aria-label={t("clients.title")}>
            {shown.map((client) => {
              const active = client.unlockedCount > 0;
              const row = (
                  <ListRow
                    href={`/dashboard/clients/${client.id}`}
                    lead={<span className="avat" aria-hidden="true">{client.clientName.slice(0, 2)}</span>}
                    title={client.clientName}
                    meta={[client.city || client.phone || client.email, t(client.quoteCount === 1 ? "clients.m.oneQuote" : "clients.m.quotes").replace("{n}", String(client.quoteCount))]}
                    amount={formatCurrency(client.totalValue, lang)}
                    end={<span className={cn("chip", active ? "chip-green" : "chip-teal")}>{active ? t("clients.status.active") : t("clients.status.prospect")}</span>}
                  />
              );
              // Phase 120: swipe right to call (the client's page keeps the Call button).
              const tel = client.phone?.replace(/[^\d+]/g, "");
              return (
                <li key={client.id}>
                  {tel ? <SwipeRow label={t("clients.m.call")} icon={Phone} tone="teal" stays onSwipe={() => { window.location.href = `tel:${tel}`; }}>{row}</SwipeRow> : row}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("clients.col.client")}</th>
                  <th>{t("clients.col.contact")}</th>
                  <th>{t("clients.col.quotes")}</th>
                  <th>{t("clients.col.lifetime")}</th>
                  <th>{t("clients.col.status")}</th>
                  <th>{t("clients.col.lastActivity")}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(client => {
                  const status = client.unlockedCount > 0
                    ? { cls: "chip-green", label: t("clients.status.active") }
                    : { cls: "chip-teal", label: t("clients.status.prospect") };
                  return (
                    <tr key={client.id} {...rowLink(() => navigate(`/dashboard/clients/${client.id}`))} {...press(`/dashboard/clients/${client.id}`)}>
                      <td>
                        <span className="cell-flex">
                          <span className="avat">{client.clientName.slice(0, 2)}</span>
                          <span>
                            <span className="t-strong">{client.clientName}</span>
                            <span className="t-sub">
                              {client.city ? client.city + (client.province ? ` (${client.province})` : "") : (client.indirizzo || "—")}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td>{client.email || client.phone || "—"}</td>
                      <td>{client.quoteCount}</td>
                      <td className="t-amt">{formatCurrency(client.totalValue, lang)}</td>
                      <td><span className={cn("chip", status.cls)}>{status.label}</span></td>
                      <td>
                        <span className="flex items-center gap-2 justify-between">
                          {new Date(client.lastQuoteDate).toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA")}
                          <ChevronRight className="chev" style={{ color: "var(--faint)" }} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <div className="card-foot">
            <span className="foot-note">
              {t("clients.foot").replace("{clients}", filtered.length === 1 ? t("clients.count.one") : t("clients.count.many").replace("{n}", String(filtered.length))).replace("{quotes}", String(totalQuotes))}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
