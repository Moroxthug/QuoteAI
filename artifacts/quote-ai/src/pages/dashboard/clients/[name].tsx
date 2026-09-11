import { useParams, Link } from "wouter";
import { useListClientQuotes, getListClientQuotesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, DollarSign, FileText, Mail, Phone, MapPin, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { enCA } from "date-fns/locale";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(v);

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const clientId = params.id ?? "";

  const { data: quotes, isLoading } = useListClientQuotes(
    clientId,
    { query: { queryKey: getListClientQuotesQueryKey(clientId), enabled: !!clientId } }
  );

  const totalValue = quotes?.reduce((sum, q) => sum + q.totale, 0) ?? 0;
  const unlockedCount = quotes?.filter(q => q.status === "unlocked").length ?? 0;
  const unlockedValue = quotes?.filter(q => q.status === "unlocked").reduce((sum, q) => sum + q.totale, 0) ?? 0;

  const latestQuote = quotes?.[0];
  const clientName = latestQuote?.clientData?.nome ?? "";
  const email = latestQuote?.clientData?.email;
  const phone = latestQuote?.clientData?.phone;
  const city = latestQuote?.clientData?.city;
  const province = latestQuote?.clientData?.province;
  const indirizzo = latestQuote?.clientData?.indirizzo;
  const partitaIva = latestQuote?.clientData?.partitaIva;
  const businessNumber = latestQuote?.clientData?.businessNumber;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/clients" className="text-muted-foreground hover:text-gray-900 transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-3 min-w-0">
          {isLoading ? (
            <Skeleton className="h-9 w-9 rounded-full" />
          ) : (
            <div className="h-9 w-9 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-violet-700 uppercase">
                {clientName.slice(0, 2) || "??"}
              </span>
            </div>
          )}
          <div className="min-w-0">
            {isLoading ? (
              <Skeleton className="h-7 w-48" />
            ) : (
              <>
                <h1 className="text-2xl font-bold tracking-tight leading-tight truncate">
                  {clientName || "Client"}
                </h1>
                {(email || phone || city || indirizzo) && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                    {email && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />{email}
                      </span>
                    )}
                    {phone && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />{phone}
                      </span>
                    )}
                    {city ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />{city}{province ? ` (${province})` : ""}
                      </span>
                    ) : indirizzo ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />{indirizzo}
                      </span>
                    ) : null}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quotes</span>
              <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center">
                <FileText className="h-4 w-4 text-violet-500" />
              </div>
            </div>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{quotes?.length ?? 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Accepted</span>
              <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
            </div>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{unlockedCount}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total value</span>
              <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-blue-500" />
              </div>
            </div>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Unlocked</span>
              <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-amber-500" />
              </div>
            </div>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-bold">{formatCurrency(unlockedValue)}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fiscal details strip */}
      {!isLoading && (partitaIva || businessNumber || (indirizzo && !city)) && (
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-6">
            {partitaIva && (
              <div className="text-sm">
                <div className="text-xs text-muted-foreground mb-0.5">GST/HST No.</div>
                <div className="font-medium">{partitaIva}</div>
              </div>
            )}
            {businessNumber && (
              <div className="text-sm">
                <div className="text-xs text-muted-foreground mb-0.5">Business Number</div>
                <div className="font-medium">{businessNumber}</div>
              </div>
            )}
            {indirizzo && (
              <div className="text-sm">
                <div className="text-xs text-muted-foreground mb-0.5">Address</div>
                <div className="font-medium">{indirizzo}{city ? `, ${city}` : ""}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quotes list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Quotes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y">
              {[1, 2, 3].map((i) => (
                <div key={i} className="px-5 py-4">
                  <Skeleton className="h-4 w-48 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ))}
            </div>
          ) : !quotes || quotes.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No quotes found for this client.
            </div>
          ) : (
            <div className="divide-y">
              {quotes.map((q) => (
                <Link
                  key={q.id}
                  href={`/dashboard/quotes/${q.id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">
                      {q.titoloPreventivoRiga2 || q.descrizioneGenerale || "Quote"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(q.createdAt), "dd MMM yyyy", { locale: enCA })}
                      {q.numeroPreventivoData && (
                        <span className="ml-2 text-gray-400">— {q.numeroPreventivoData}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      q.status === "unlocked" ? "bg-violet-100 text-violet-700" :
                      q.status === "pending_payment" ? "bg-amber-100 text-amber-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {q.status === "unlocked" ? "Unlocked" : q.status === "pending_payment" ? "Pending" : "Draft"}
                    </span>
                    <span className="font-semibold text-sm">{formatCurrency(q.totale)}</span>
                    <ChevronRight className="h-4 w-4 text-gray-300" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
