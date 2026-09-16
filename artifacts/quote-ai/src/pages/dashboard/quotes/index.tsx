import { useListQuotes, useDeleteQuote, useDuplicateQuote, getListQuotesQueryKey } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, MoreVertical, FileText, Trash2, Eye, Copy, ChevronDown, Loader2, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type StatusFilter = "all" | "draft" | "unlocked" | "pending_payment";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(amount);

function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  if (status === "unlocked")
    return <Badge className="bg-[var(--qa-purple-t)] text-[var(--qa-purple)] hover:bg-[var(--qa-purple-t)] border-0 text-[11px] px-1.5 py-0">{t("dashboard.quotesList.statusUnlocked")}</Badge>;
  if (status === "pending_payment")
    return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0 text-[11px] px-1.5 py-0">{t("dashboard.quotesList.statusPending")}</Badge>;
  return <Badge variant="outline" className="text-slate-500 text-[11px] px-1.5 py-0">{t("dashboard.quotesList.statusDraft")}</Badge>;
}

export default function QuotesList() {
  const { t, lang } = useLanguage();
  const STATUS_LABELS: Record<StatusFilter, string> = {
    all: t("dashboard.quotesList.statusAll"),
    draft: t("dashboard.quotesList.statusDraft"),
    unlocked: t("dashboard.quotesList.statusUnlocked"),
    pending_payment: t("dashboard.quotesList.statusPending"),
  };
  const { data: quotes, isLoading } = useListQuotes();
  const deleteQuote = useDeleteQuote();
  const duplicateQuote = useDuplicateQuote();
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

  const counts = quotes
    ? {
        all: quotes.length,
        draft: quotes.filter(q => q.status === "draft").length,
        unlocked: quotes.filter(q => q.status === "unlocked").length,
        pending_payment: quotes.filter(q => q.status === "pending_payment").length,
      }
    : null;

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            <FileText className="h-8 w-8 text-navy-600" />
            {t("dashboard.quotesList.title")}
          </h1>
          <p className="text-slate-500 mt-1">{t("dashboard.quotesList.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-[220px]">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t("dashboard.quotesList.searchPlaceholder")}
              className="pl-8 h-8 text-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          {/* Status filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0 h-8 text-xs">
                <span>{STATUS_LABELS[statusFilter]}</span>
                {counts && statusFilter !== "all" && (
                  <Badge className="h-4 min-w-4 px-1 text-[10px] bg-[var(--qa-purple-t)] text-[var(--qa-purple)] border-0 ml-0.5">
                    {counts[statusFilter]}
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              {(Object.keys(STATUS_LABELS) as StatusFilter[]).map(s => (
                <DropdownMenuItem
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className="flex items-center justify-between text-sm"
                >
                  <span className={statusFilter === s ? "font-semibold" : ""}>{STATUS_LABELS[s]}</span>
                  {counts && (
                    <span className="text-xs text-muted-foreground">{counts[s]}</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button asChild size="sm" className="gap-2 shrink-0">
            <Link href="/dashboard/new"><Plus className="h-4 w-4" /> {t("dashboard.quotesList.createFirstQuote")}</Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <Card key={i}>
              <CardContent className="p-3">
                <div className="flex justify-between items-center">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-7 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed rounded-[var(--radius)] bg-muted/20">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-20" />
          <h3 className="text-base font-medium text-foreground mb-1">{t("dashboard.quotesList.noQuotesFound")}</h3>
          {searchTerm || statusFilter !== "all" ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t("dashboard.quotesList.noResultsForFilters")}</p>
              <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(""); setStatusFilter("all"); }}>
                {t("dashboard.quotesList.clearFilters")}
              </Button>
            </div>
          ) : (
            <Button asChild size="sm" className="mt-3">
              <Link href="/dashboard/new">{t("dashboard.quotesList.createFirstQuote")}</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredQuotes.map((quote, i) => (
            <Card
              key={quote.id}
              className="hover-elevate transition-all overflow-hidden animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3 py-2.5 gap-3">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 hidden sm:flex">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/dashboard/quotes/${quote.id}`}
                        className="font-semibold text-sm hover:text-primary hover:underline focus:outline-none line-clamp-1"
                      >
                        {quote.clientData?.nome || t("dashboard.quotesList.clientNotSpecified")}
                      </Link>
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {quote.descrizioneGenerale || t("dashboard.quotesList.noDescription")}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <StatusBadge status={quote.status} />
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(quote.createdAt), "dd MMM yyyy", { locale: lang === "fr" ? frCA : enCA })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto border-t sm:border-0 pt-2 sm:pt-0 shrink-0">
                    <div className="font-bold text-sm tabular-nums">{formatCurrency(quote.totale)}</div>

                    <div className="flex items-center gap-1">
                      <Button variant="secondary" size="sm" className="h-7 text-xs" asChild>
                        <Link href={`/dashboard/quotes/${quote.id}`}>
                          <Eye className="h-3.5 w-3.5 mr-1" /> {t("dashboard.quotesList.open")}
                        </Link>
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            {duplicatingId === quote.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <MoreVertical className="h-3.5 w-3.5" />}
                            <span className="sr-only">{t("dashboard.quotesList.options")}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/quotes/${quote.id}`} className="cursor-pointer w-full flex items-center text-sm">
                              <Eye className="mr-2 h-3.5 w-3.5" /> {t("dashboard.quotesList.view")}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDuplicate(quote.id)}
                            disabled={duplicatingId === quote.id}
                            className="cursor-pointer text-sm"
                          >
                            <Copy className="mr-2 h-3.5 w-3.5" /> {t("dashboard.quotesList.duplicate")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(quote.id)}
                            className="text-destructive focus:text-destructive cursor-pointer text-sm"
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> {t("dashboard.quotesList.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
