import { useListClients } from "@workspace/api-client-react";
import { rowLink } from "@/lib/row-link";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useLocation } from "wouter";
import { Users, Search, Plus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";

const formatCurrency = (v: number, lang: string) =>
  new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(v);

export default function ClientsPage() {
  const { data: clients, isLoading } = useListClients();
  const [search, setSearch] = useState("");
  const [, navigate] = useLocation();
  const { t, lang } = useLanguage();

  const filtered = (clients ?? []).filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.clientName.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q);
  });

  const totalQuotes = (clients ?? []).reduce((sum, c) => sum + c.quoteCount, 0);

  return (
    <div className="animate-in fade-in duration-500">
      <div className="page-head">
        <div>
          <h1>{t("clients.title")}</h1>
          <p className="sub">{t("clients.subtitle")}</p>
        </div>
        <div className="head-actions">
          <Link href="/dashboard/new" className="btn btn-navy">
            <Plus className="h-4 w-4" />
            {t("clients.add")}
          </Link>
        </div>
      </div>

      <div className="card">
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

        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full rounded-[var(--radius-sm)]" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 px-5">
            <Users className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-20" />
            <p className="font-semibold text-foreground">{t("clients.empty.title")}</p>
            <p className="text-sm text-muted-foreground mt-1 mb-3">
              {t("clients.empty.desc")}
            </p>
            <Link href="/dashboard/new" className="btn btn-navy btn-sm">{t("clients.empty.cta")}</Link>
          </div>
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
                {filtered.map(client => {
                  const status = client.unlockedCount > 0
                    ? { cls: "chip-green", label: t("clients.status.active") }
                    : { cls: "chip-teal", label: t("clients.status.prospect") };
                  return (
                    <tr key={client.id} {...rowLink(() => navigate(`/dashboard/clients/${client.id}`))}>
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
