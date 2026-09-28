import { useListQuotes, useDeleteQuote, useDuplicateQuote, archiveQuote, restoreQuote, getListQuotesQueryKey, type QuoteSummary } from "@workspace/api-client-react";
import { rowLink } from "@/lib/row-link";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ListSkeleton } from "@/components/skeletons";
import { EmptyState, ErrorState } from "@/components/states";
import { useOptimisticMutation, patch } from "@/lib/optimistic";
import { usePrefetchOnPress } from "@/hooks/use-prefetch-on-press";
import { useProgressiveList } from "@/hooks/use-progressive-list";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ListRow } from "@/components/mobile/list-row";
import { BottomSheet } from "@/components/mobile/bottom-sheet";
import { Search, MoreVertical, FileText, Trash2, Eye, Copy, Loader2, Plus, ChevronRight, Archive, ListFilter, X, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatCad, moneyLocale } from "@/lib/money";
import { quoteStatusChip } from "@/components/quotes/quote-status";

type StatusFilter = "all" | "draft" | "unlocked" | "sent" | "accepted" | "pending_payment";

const formatCurrency = (amount: number) => formatCad(amount);

function matchesFilter(q: QuoteSummary, f: StatusFilter): boolean {
  if (f === "all") return true;
  if (f === "sent") return q.status === "unlocked" && !!q.sentAt;
  if (f === "unlocked") return q.status === "unlocked" && !q.sentAt;
  return q.status === f;
}

export default function QuotesList() {
  const { t, lang } = useLanguage();
  const can = useCan();
  const phone = useMediaQuery("(max-width: 640px)");
  const FILTERS: StatusFilter[] = ["all", "draft", "unlocked", "sent", "accepted", "pending_payment"];
  const FILTER_LABELS: Record<StatusFilter, string> = {
    all: t("dashboard.quotesList.statusAll"),
    draft: t("dashboard.quotesList.statusDraft"),
    unlocked: t("dashboard.quotesList.statusUnlocked"),
    sent: t("quotes.m.statusSent"),
    accepted: t("quotes.m.statusAccepted"),
    pending_payment: t("dashboard.quotesList.statusPending"),
  };
  const { data: quotes, isLoading, error, refetch } = useListQuotes();
  const deleteQuote = useDeleteQuote();
  const duplicateQuote = useDuplicateQuote();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
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

  // Phase 115: archiving takes the row out at once; Undo restores it (POST /api/quotes/:id/restore).
  const archive = useOptimisticMutation({
    mutationFn: ({ quote, restore }: { quote: QuoteSummary; restore?: boolean }) => (restore ? restoreQuote(quote.id) : archiveQuote(quote.id)),
    patch: ({ quote, restore }) => [
      patch<QuoteSummary[]>(getListQuotesQueryKey(), (list) =>
        restore
          ? (list.some((q) => q.id === quote.id) ? list : [...list, quote].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
          : list.filter((q) => q.id !== quote.id),
      ),
    ],
    invalidate: () => [["archive"]],
    onError: (_e, { restore }) => toast({ title: t(restore ? "archive.restoreErrorToast" : "dashboard.quotesList.archiveErrorToast"), variant: "destructive" }),
    undo: ({ quote, restore }) => (restore ? null : { title: t("dashboard.quotesList.archivedToast"), inverse: { quote, restore: true } }),
  });
  const handleArchive = (quote: QuoteSummary) => archive.mutate({ quote });
  const press = usePrefetchOnPress();

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

  const needle = searchTerm.trim().toLowerCase();
  const filteredQuotes = (quotes ?? []).filter(q => {
    const matchesSearch =
      !needle ||
      q.clientData?.nome?.toLowerCase().includes(needle) ||
      q.title?.toLowerCase().includes(needle) ||
      q.descrizioneGenerale?.toLowerCase().includes(needle);
    return matchesSearch && matchesFilter(q, statusFilter);
  });
  // Phase 115: a long list draws its first 50 rows now, the rest when idle.
  const shownQuotes = useProgressiveList(filteredQuotes);
  const countFor = (f: StatusFilter) => (quotes ?? []).filter((q) => matchesFilter(q, f)).length;
  const shortDate = (iso: string) => new Date(iso).toLocaleDateString(moneyLocale(lang), { day: "numeric", month: "short", year: new Date(iso).getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
  const heading = (q: QuoteSummary) => q.title?.trim() || q.descrizioneGenerale || t("dashboard.quotesList.noDescription");

  const search = (
    <label className="search sm grow">
      <Search className="h-4 w-4" />
      <input
        type="search"
        enterKeyHint="search"
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        placeholder={t("dashboard.quotesList.searchPlaceholder")}
        aria-label={t("dashboard.quotesList.searchPlaceholder")}
      />
    </label>
  );

  return (
    <div className="animate-in fade-in duration-500 qlist">
      <div className="page-head">
        <div>
          <h1>{t("dashboard.quotesList.title")}</h1>
          <p className="sub">{t("dashboard.quotesList.subtitle")}</p>
        </div>
        {/* On a phone the + in the top bar is the New quote button (Phase 101). */}
        {can("quotes", "edit") && (
          <div className="head-actions hide-phone">
            <Link href="/dashboard/new" className="btn btn-navy">
              <Plus className="h-4 w-4" />
              {t("dashboard.quotesList.createFirstQuote")}
            </Link>
          </div>
        )}
      </div>

      <div className="card">
        {phone ? (
          // Phase 105: the search stays at the top while the list scrolls; the
          // status filter is a sheet, and the one that's on shows as a chip.
          <div className="toolbar qlist-bar">
            {search}
            <button
              type="button"
              className={cn("more-btn", statusFilter !== "all" && "on")}
              onClick={() => setFilterOpen(true)}
              aria-label={t("quotes.m.filter")}
              aria-haspopup="dialog"
            >
              <ListFilter />
            </button>
            {statusFilter !== "all" && (
              <div className="qlist-active">
                <button type="button" className="chip chip-navy-soft" onClick={() => setStatusFilter("all")} aria-label={t("quotes.m.clearFilter").replace("{filter}", FILTER_LABELS[statusFilter])}>
                  {FILTER_LABELS[statusFilter]} <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="toolbar">
            <div className="pills">
              {FILTERS.map(f => (
                <button
                  key={f}
                  type="button"
                  className={cn("pill", statusFilter === f && "on")}
                  aria-pressed={statusFilter === f}
                  onClick={() => setStatusFilter(f)}
                >
                  {FILTER_LABELS[f]}
                </button>
              ))}
            </div>
            {search}
          </div>
        )}

        {isLoading ? (
          <ListSkeleton rows={6} lead={phone ? false : "icon"} />
        ) : error && !quotes ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : filteredQuotes.length === 0 ? (
          searchTerm || statusFilter !== "all" ? (
            <EmptyState
              art="search"
              title={t("states.search.empty")}
              action={<button type="button" className="btn btn-sm btn-outline-navy" onClick={() => { setSearchTerm(""); setStatusFilter("all"); }}>{t("dashboard.quotesList.clearFilters")}</button>}
            />
          ) : (
            <EmptyState
              art="quotes"
              title={t("states.quotes.empty")}
              action={can("quotes", "edit") ? <Link href="/dashboard/new" className="btn btn-navy btn-sm">{t("dashboard.nav.newQuote")}</Link> : undefined}
            />
          )
        ) : phone ? (
          <ul className="lrows" aria-label={t("dashboard.quotesList.title")}>
            {shownQuotes.map(quote => {
              const chip = quoteStatusChip(quote, t);
              return (
                <li key={quote.id}>
                  <ListRow
                    href={`/dashboard/quotes/${quote.id}`}
                    title={quote.clientData?.nome || t("dashboard.quotesList.clientNotSpecified")}
                    meta={[heading(quote), shortDate(quote.createdAt)]}
                    amount={quote.status === "draft" ? "—" : formatCurrency(quote.totale)}
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
                  <th>{t("dashboard.quotesList.colQuote")}</th>
                  <th>{t("dashboard.quotesList.colClient")}</th>
                  <th>{t("dashboard.quotesList.colStatus")}</th>
                  <th>{t("dashboard.quotesList.colDate")}</th>
                  <th style={{ textAlign: "right" }}>{t("dashboard.quotesList.colValue")}</th>
                  <th><span className="sr-only">{t("dashboard.quotesList.options")}</span></th>
                </tr>
              </thead>
              <tbody>
                {shownQuotes.map(quote => {
                  const chip = quoteStatusChip(quote, t);
                  return (
                    <tr key={quote.id} {...rowLink(() => navigate(`/dashboard/quotes/${quote.id}`))} {...press(`/dashboard/quotes/${quote.id}`)}>
                      <td>
                        <span className="cell-flex">
                          <span className="cell-ic"><FileText className="h-4 w-4" /></span>
                          <span>
                            <span className="t-strong">{heading(quote)}</span>
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
                                  onClick={() => handleArchive(quote)}
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

      <BottomSheet open={filterOpen} onOpenChange={setFilterOpen} title={t("quotes.m.filter")} flush>
        <div className="asheet-list" role="radiogroup" aria-label={t("dashboard.quotesList.colStatus")}>
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={statusFilter === f}
              className="asheet-item"
              onClick={() => { setStatusFilter(f); setFilterOpen(false); }}
            >
              <span>{FILTER_LABELS[f]}</span>
              <span className="asheet-hint">{countFor(f)}</span>
              {statusFilter === f ? <Check /> : <span style={{ width: 19 }} />}
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}
