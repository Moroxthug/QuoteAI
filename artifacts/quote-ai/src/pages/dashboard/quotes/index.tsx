import { useListQuotes, useDeleteQuote, useDuplicateQuote, useArchiveQuote, getListQuotesQueryKey } from "@workspace/api-client-react";
import { rowLink } from "@/lib/row-link";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, MoreVertical, FileText, Trash2, Eye, Copy, Loader2, Plus, ChevronRight, Archive } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatCad } from "@/lib/money";

type StatusFilter = "all" | "draft" | "unlocked" | "pending_payment";

const formatCurrency = (amount: number) => formatCad(amount);

function statusChip(status: string, t: (key: string) => string): { cls: string; label: string } {
  if (status === "unlocked") return { cls: "chip-green", label: t("dashboard.quotesList.statusUnlocked") };
  if (status === "pending_payment") return { cls: "chip-yellow", label: t("dashboard.quotesList.statusPending") };
  return { cls: "chip-grey", label: t("dashboard.quotesList.statusDraft") };
}

export default function QuotesList() {
  const { t } = useLanguage();
const can = useCan();
  const FILTERS: StatusFilter[] = ["all", "draft", "unlocked", "pending_payment"];
  const FILTER_LABELS: Record<StatusFilter, string> = {
    all: t("dashboard.quotesList.statusAll"),
    draft: t("dashboard.quotesList.statusDraft"),
    unlocked: t("dashboard.quotesList.statusUnlocked"),
    pending_payment: t("dashboard.quotesList.statusPending"),
  };
  const { data: quotes, isLoading } = useListQuotes();
  const deleteQuote = useDeleteQuote();
  const duplicateQuote = useDuplicateQuote();
  const archiveQuote = useArchiveQuote();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const handleDelete = (id: string) => {
    if (!confirm(t("dashboard.quotesList.confirmDelete"))) return;
    deleteQuote.mutate({ id }, {
      onSuccess: () => {
        toast({ title: t("dashboard.quotesList.deletedToast") });
        queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() });
      },
      onError: () => toast({ title: t("dashboard.quotesList.deleteErrorToast"), variant: "destructive" }),
    });
  };

  const handleArchive = (id: string) => {
    archiveQuote.mutate({ id }, {
      onSuccess: () => {
        toast({ title: t("dashboard.quotesList.archivedToast") });
        queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() });
      },
      onError: () => toast({ title: t("dashboard.quotesList.archiveErrorToast"), variant: "destructive" }),
    });
  };

  const handleDuplicate = (id: string) => {
    setDuplicatingId(id);
    duplicateQuote.mutate({ id }, {
      onSuccess: (newQuote) => {
        queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() });
        toast({ title: t("dashboard.quotesList.duplicatedToast") });
        navigate(`/dashboard/quotes/${newQuote.id}`);
      },
      onError: () => toast({ title: t("dashboard.quotesList.duplicateErrorToast"), variant: "destructive" }),
      onSettled: () => setDuplicatingId(null),
    });
  };

  const filteredQuotes = (quotes ?? []).filter(q => {
    const matchesSearch =
      !searchTerm ||
      q.clientData?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.descrizioneGenerale?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="animate-in fade-in duration-500">
      <div className="page-head">
        <div>
          <h1>{t("dashboard.quotesList.title")}</h1>
          <p className="sub">{t("dashboard.quotesList.subtitle")}</p>
        </div>
        {can("quotes", "edit") && (
          <div className="head-actions">
            <Link href="/dashboard/new" className="btn btn-navy">
              <Plus className="h-4 w-4" />
              {t("dashboard.quotesList.createFirstQuote")}
            </Link>
          </div>
        )}
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="pills">
            {FILTERS.map(f => (
              <button
                key={f}
                type="button"
                className={cn("pill", statusFilter === f && "on")}
                onClick={() => setStatusFilter(f)}
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
          </div>
          <label className="search sm grow">
            <Search className="h-4 w-4" />
            <input
              type="search"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={t("dashboard.quotesList.searchPlaceholder")}
              aria-label={t("dashboard.quotesList.searchPlaceholder")}
            />
          </label>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-full rounded-[var(--radius-sm)]" />)}
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="text-center py-14 px-5">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-20" />
            <h3 className="text-base font-medium text-foreground mb-1">{t("dashboard.quotesList.noQuotesFound")}</h3>
            {searchTerm || statusFilter !== "all" ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t("dashboard.quotesList.noResultsForFilters")}</p>
                <button type="button" className="cta-link mx-auto" onClick={() => { setSearchTerm(""); setStatusFilter("all"); }}>
                  {t("dashboard.quotesList.clearFilters")}
                </button>
              </div>
            ) : can("quotes", "edit") ? (
              <Link href="/dashboard/new" className="btn btn-navy btn-sm">
                {t("dashboard.quotesList.createFirstQuote")}
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("dashboard.quotesList.colQuote")}</th>
                  <th>{t("dashboard.quotesList.colClient")}</th>
                  <th>{t("dashboard.quotesList.colStatus")}</th>
                  <th>{t("dashboard.quotesList.colDate")}</th>
                  <th style={{ textAlign: "right" }}>{t("dashboard.quotesList.colValue")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotes.map(quote => {
                  const chip = statusChip(quote.status, t);
                  return (
                    <tr key={quote.id} {...rowLink(() => navigate(`/dashboard/quotes/${quote.id}`))}>
                      <td>
                        <span className="cell-flex">
                          <span className="cell-ic"><FileText className="h-4 w-4" /></span>
                          <span>
                            <span className="t-strong">{quote.descrizioneGenerale || t("dashboard.quotesList.noDescription")}</span>
                            <span className="t-sub">
                              {quote.lineItemCount} {quote.lineItemCount === 1 ? t("dashboard.quotesList.lineItem") : t("dashboard.quotesList.lineItems")}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td>{quote.clientData?.nome || t("dashboard.quotesList.clientNotSpecified")}</td>
                      <td><span className={cn("chip", chip.cls)}>{chip.label}</span></td>
                      <td>{new Date(quote.createdAt).toLocaleDateString("en-CA")}</td>
                      <td className="t-amt" style={{ textAlign: "right" }}>
                        {quote.status === "draft" ? "—" : formatCurrency(quote.totale)}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button type="button" className="h-7 w-7 grid place-items-center rounded-md hover:bg-[var(--soft)] text-[var(--faint)]" aria-label={t("dashboard.quotesList.options")}>
                                {duplicatingId === quote.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <MoreVertical className="h-3.5 w-3.5" />}
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/dashboard/quotes/${quote.id}`} className="cursor-pointer w-full flex items-center text-sm">
                                  <Eye className="mr-2 h-3.5 w-3.5" /> {t("dashboard.quotesList.view")}
                                </Link>
                              </DropdownMenuItem>
                              {can("quotes", "edit") && (
                                <DropdownMenuItem
                                  onClick={() => handleDuplicate(quote.id)}
                                  disabled={duplicatingId === quote.id}
                                  className="cursor-pointer text-sm"
                                >
                                  <Copy className="mr-2 h-3.5 w-3.5" /> {t("dashboard.quotesList.duplicate")}
                                </DropdownMenuItem>
                              )}
                              {can("quotes", "full") && (
                                <DropdownMenuItem
                                  onClick={() => handleArchive(quote.id)}
                                  className="cursor-pointer text-sm"
                                >
                                  <Archive className="mr-2 h-3.5 w-3.5" /> {t("dashboard.quotesList.archive")}
                                </DropdownMenuItem>
                              )}
                              {can("quotes", "full") && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(quote.id)}
                                    className="text-destructive focus:text-destructive cursor-pointer text-sm"
                                  >
                                    <Trash2 className="mr-2 h-3.5 w-3.5" /> {t("dashboard.quotesList.delete")}
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <ChevronRight className="chev" style={{ color: "var(--faint)" }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && filteredQuotes.length > 0 && (
          <div className="card-foot">
            <span className="foot-note">
              {t("dashboard.quotesList.footShowing").replace("{shown}", String(filteredQuotes.length)).replace("{total}", String(quotes?.length ?? 0))}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
