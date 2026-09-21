import { useParams, Link } from "wouter";
import { useListClientQuotes, getListClientQuotesQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ArrowRight, FileText, Mail, Phone, MapPin } from "lucide-react";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

const formatCurrency = (v: number, lang: string) =>
  new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(v);

function quoteChip(status: string, t: (k: string) => string): { cls: string; label: string } {
  if (status === "accepted") return { cls: "chip-green", label: t("clients.detail.quoteAccepted") };
  if (status === "unlocked") return { cls: "chip-green", label: t("dashboard.quotesList.statusUnlocked") };
  if (status === "pending_payment") return { cls: "chip-yellow", label: t("dashboard.quotesList.statusPending") };
  return { cls: "chip-grey", label: t("dashboard.quotesList.statusDraft") };
}

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const clientId = params.id ?? "";
  const { t, lang } = useLanguage();

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

  const stats = [
    { label: t("clients.col.quotes"), value: String(quotes?.length ?? 0) },
    { label: t("clients.detail.accepted"), value: String(unlockedCount), cls: "ok" },
    { label: t("clients.detail.totalValue"), value: formatCurrency(totalValue, lang) },
    { label: t("clients.detail.unlockedValue"), value: formatCurrency(unlockedValue, lang), cls: "teal" },
  ];

  return (
    <div className="animate-in fade-in duration-500">
      <Link href="/dashboard/clients" className="back-link"><ArrowLeft /> {t("clients.detail.back")}</Link>
      <div className="page-head">
        <div className="min-w-0">
          {isLoading ? (
            <Skeleton className="h-8 w-56 rounded-md" />
          ) : (
            <div className="title-row">
              <span className="avat" style={{ width: 40, height: 40, fontSize: 14 }}>{clientName.slice(0, 2) || "??"}</span>
              <h1 className="truncate">{clientName || t("clients.col.client")}</h1>
            </div>
          )}
          {!isLoading && (email || phone || city || indirizzo) && (
            <div className="meta">
              {email && <span><Mail />{email}</span>}
              {phone && <span><Phone />{phone}</span>}
              {city ? (
                <span><MapPin />{city}{province ? ` (${province})` : ""}</span>
              ) : indirizzo ? (
                <span><MapPin />{indirizzo}</span>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <section className="stat-grid">
        {stats.map((s) => (
          <div key={s.label} className="card stat-card">
            <p className="lbl">{s.label}</p>
            {isLoading ? <Skeleton className="h-8 w-20 mt-2" /> : <p className={cn("val", s.cls)}>{s.value}</p>}
          </div>
        ))}
      </section>

      {/* Fiscal details */}
      {!isLoading && (partitaIva || businessNumber || (indirizzo && !city)) && (
        <div className="card">
          {partitaIva && <div className="kv"><span>{t("clients.detail.gstNumber")}</span><b>{partitaIva}</b></div>}
          {businessNumber && <div className="kv"><span>{t("clients.detail.businessNumber")}</span><b>{businessNumber}</b></div>}
          {indirizzo && <div className="kv"><span>{t("clients.detail.address")}</span><b>{indirizzo}{city ? `, ${city}` : ""}</b></div>}
        </div>
      )}

      {/* Quotes list */}
      <div className="card">
        <div className="card-head">
          <div>
            <h2>{t("clients.col.quotes")}</h2>
            {!isLoading && <p className="sub">{quotes?.length ?? 0} in total</p>}
          </div>
        </div>
        {isLoading ? (
          <div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="q-row">
                <Skeleton className="h-9 w-9 rounded-[10px]" />
                <div className="q-body"><Skeleton className="h-4 w-48 mb-2" /><Skeleton className="h-3 w-32" /></div>
              </div>
            ))}
          </div>
        ) : !quotes || quotes.length === 0 ? (
          <div className="card-empty">{t("clients.detail.noQuotes")}</div>
        ) : (
          <div>
            {quotes.map((q) => {
              const chip = quoteChip(q.status, t);
              return (
                <Link key={q.id} href={`/dashboard/quotes/${q.id}`} className="q-row">
                  <span className="q-ic"><FileText className="h-4 w-4" /></span>
                  <div className="q-body">
                    <p className="q-title">{q.titoloPreventivoRiga2 || q.descrizioneGenerale || t("clients.detail.quote")}</p>
                    <div className="q-meta">
                      <span className={cn("chip", chip.cls)}>{chip.label}</span>
                      <span className="q-date">
                        {format(new Date(q.createdAt), "dd MMM yyyy", { locale: lang === "fr" ? frCA : enCA })}
                        {q.numeroPreventivoData ? ` — ${q.numeroPreventivoData}` : ""}
                      </span>
                    </div>
                  </div>
                  <span className="q-amt">{formatCurrency(q.totale, lang)}</span>
                  <ArrowRight className="chev" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
