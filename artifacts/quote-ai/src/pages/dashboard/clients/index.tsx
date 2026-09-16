import { useListClients } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useLocation } from "wouter";
import { Users, Search, Plus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(v);

export default function ClientsPage() {
  const { data: clients, isLoading } = useListClients();
  const [search, setSearch] = useState("");
  const [, navigate] = useLocation();

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
          <h1>Clients</h1>
          <p className="sub">All clients extracted from your quotes.</p>
        </div>
        <div className="head-actions">
          <Link href="/dashboard/new" className="btn btn-navy">
            <Plus className="h-4 w-4" />
            Add client
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
              placeholder="Search clients"
              aria-label="Search clients"
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
            <p className="font-semibold text-foreground">No clients yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-3">
              Clients will show up here as soon as you create quotes with a client name.
            </p>
            <Link href="/dashboard/new" className="btn btn-navy btn-sm">Create your first quote</Link>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Contact</th>
                  <th>Quotes</th>
                  <th>Lifetime value</th>
                  <th>Status</th>
                  <th>Last activity</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(client => {
                  const status = client.unlockedCount > 0
                    ? { cls: "chip-green", label: "Active" }
                    : { cls: "chip-teal", label: "Prospect" };
                  return (
                    <tr key={client.id} onClick={() => navigate(`/dashboard/clients/${client.id}`)} className="cursor-pointer">
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
                      <td className="t-amt">{formatCurrency(client.totalValue)}</td>
                      <td><span className={cn("chip", status.cls)}>{status.label}</span></td>
                      <td>
                        <span className="flex items-center gap-2 justify-between">
                          {new Date(client.lastQuoteDate).toLocaleDateString("en-CA")}
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
              {filtered.length} client{filtered.length === 1 ? "" : "s"} · {totalQuotes} quotes all-time
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
