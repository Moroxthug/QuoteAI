import { useMemo } from "react";
import { useParams, Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useListClientQuotes, getListClientQuotesQueryKey, useGetBusinessProfile } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ListSkeleton } from "@/components/skeletons";
import { ArrowLeft, Mail, Phone, MapPin, MessageSquareText, Users } from "lucide-react";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";
import { cn } from "@/lib/utils";
import { hasFeature } from "@/lib/plans";
import { formatCadWhole } from "@/lib/money";
import { jobsApi } from "@/lib/jobs-api";
import { invoicesApi } from "@/lib/invoices-api";
import { clientPortalApi } from "@/lib/portal-api";
import { ListRow } from "@/components/mobile/list-row";
import { ScrollTabs } from "@/components/mobile/scroll-tabs";
import { StatStrip } from "@/components/mobile/stat-strip";
import { useMobileHeader } from "@/components/mobile/mobile-page-header";
import { quoteStatusChip } from "@/components/quotes/quote-status";
import { JobStatusBadge } from "@/components/jobs/badges";
import { ClientThreadCard } from "@/components/clients/client-thread";
import { ClientPortalCard } from "@/components/clients/client-portal-card";
import { InvoiceListRow } from "@/components/invoices/invoice-list-row";

const mapsUrl = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
type Tab = "quotes" | "jobs" | "invoices" | "messages";

/**
 * Phase 107 — the client first: name, where they are, and one tap to call,
 * text, email or find them; four numbers as a strip; then what you have with
 * them as tabs (quotes, jobs, invoices, messages and the portal).
 */
export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const clientId = params.id ?? "";
  const { t, lang } = useLanguage();
  const can = useCan();
  const locale = lang === "fr" ? frCA : enCA;
  const search = useSearch();
  const [, navigate] = useLocation();
  const tabParam = new URLSearchParams(search).get("tab") as Tab | null;

  const { data: quotes, isLoading } = useListClientQuotes(
    clientId,
    { query: { queryKey: getListClientQuotesQueryKey(clientId), enabled: !!clientId } }
  );
  const { data: profile } = useGetBusinessProfile();
  const hasJobs = profile ? hasFeature(profile as never, "jobs") : false;
  const hasInvoices = profile ? hasFeature(profile as never, "invoicing") : false;
  // The page URL carries the md5 of the client's quotes grouping; jobs and invoices carry the client row's id.
  const portal = useQuery({ queryKey: ["client-portal", clientId], queryFn: () => clientPortalApi.status(clientId), enabled: !!clientId && can("jobs", "view"), retry: false });
  const jobsQ = useQuery({ queryKey: ["jobs"], queryFn: jobsApi.list, enabled: hasJobs, retry: false });
  const invoicesQ = useQuery({ queryKey: ["invoices"], queryFn: invoicesApi.list, enabled: hasInvoices, retry: false });

  const quoteIds = useMemo(() => new Set((quotes ?? []).map((q) => q.id)), [quotes]);
  const uuid = portal.data?.clientId ?? null;
  const jobs = useMemo(
    () => (jobsQ.data?.items ?? []).filter((j) => (uuid && j.clientId === uuid) || (j.quoteId && quoteIds.has(j.quoteId))),
    [jobsQ.data, uuid, quoteIds],
  );
  const jobIds = useMemo(() => new Set(jobs.map((j) => j.id)), [jobs]);
  const invoices = useMemo(
    () => (invoicesQ.data?.items ?? []).filter((i) => (uuid && i.clientId === uuid) || (i.projectId && jobIds.has(i.projectId))),
    [invoicesQ.data, uuid, jobIds],
  );

  const totalValue = quotes?.reduce((sum, q) => sum + q.totale, 0) ?? 0;
  const won = quotes?.filter((q) => q.status === "accepted" || q.status === "unlocked") ?? [];
  const wonValue = won.reduce((sum, q) => sum + q.totale, 0);
  const owedCents = invoices.reduce((sum, i) => sum + (["sent", "viewed", "pending_confirmation", "partially_paid", "overdue"].includes(i.status) ? i.balanceCents : 0), 0);

  const latestQuote = quotes?.[0];
  const clientName = latestQuote?.clientData?.nome ?? "";
  const email = latestQuote?.clientData?.email;
  const phone = latestQuote?.clientData?.phone;
  const city = latestQuote?.clientData?.city;
  const province = latestQuote?.clientData?.province;
  const indirizzo = latestQuote?.clientData?.indirizzo;
  const partitaIva = latestQuote?.clientData?.partitaIva;
  const businessNumber = latestQuote?.clientData?.businessNumber;
  const place = city ? `${city}${province ? ` (${province})` : ""}` : "";
  const address = [indirizzo, city, province].filter(Boolean).join(", ");
  const firstQuote = quotes && quotes.length > 0 ? quotes[quotes.length - 1] : undefined;

  useMobileHeader(useMemo(() => (clientName ? { title: clientName } : null), [clientName]));

  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: "quotes", label: t("clients.col.quotes"), count: quotes?.length ?? 0 },
    ...(hasJobs && !jobsQ.isError ? [{ id: "jobs" as const, label: t("clients.m.jobs"), count: jobs.length }] : []),
    ...(hasInvoices && !invoicesQ.isError ? [{ id: "invoices" as const, label: t("clients.m.invoices"), count: invoices.length }] : []),
    { id: "messages", label: t("clients.m.messages") },
  ];
  const tab: Tab = tabs.some((x) => x.id === tabParam) ? tabParam! : "quotes";
  const setTab = (id: string) => navigate(`/dashboard/clients/${clientId}${id === "quotes" ? "" : `?tab=${id}`}`, { replace: true });

  const contact = [
    phone && { key: "call", href: `tel:${phone.replace(/[^\d+]/g, "")}`, icon: Phone, label: t("clients.m.call") },
    phone && { key: "text", href: `sms:${phone.replace(/[^\d+]/g, "")}`, icon: MessageSquareText, label: t("clients.m.text") },
    email && { key: "email", href: `mailto:${email}`, icon: Mail, label: t("clients.m.email") },
    address && { key: "map", href: mapsUrl(address), icon: MapPin, label: t("clients.m.map"), external: true },
  ].filter((x): x is { key: string; href: string; icon: typeof Phone; label: string; external?: boolean } => !!x);

  return (
    <div className="animate-in fade-in duration-500">
      <Link href="/dashboard/clients" className="back-link hide-phone"><ArrowLeft /> {t("clients.detail.back")}</Link>

      <section className="card q-hero c-hero">
        <div className="q-hero-main">
          {isLoading ? (
            <div className="skel-wait" aria-busy="true"><Skeleton className="skel-line skel-sub" style={{ width: 120 }} aria-hidden="true" /><Skeleton className="skel-line skel-h1" style={{ width: 240 }} aria-hidden="true" /><Skeleton className="skel-line skel-title" style={{ width: 160, marginTop: 10 }} aria-hidden="true" /></div>
          ) : (
            <>
              <div className="q-hero-eyebrow">
                <Users aria-hidden="true" />
                {place && <span>{place}</span>}
                {firstQuote && <span>{t("clients.m.since").replace("{date}", format(new Date(firstQuote.createdAt), "MMM yyyy", { locale }))}</span>}
              </div>
              <div className="c-hero-name">
                <span className="avat" aria-hidden="true">{clientName.slice(0, 2) || "??"}</span>
                <h1>{clientName || t("clients.col.client")}</h1>
              </div>
              {(email || phone) && <p className="q-hero-sub c-hero-sub">{[phone, email].filter(Boolean).join(" · ")}</p>}
            </>
          )}
          {contact.length > 0 && (
            <div className="c-acts" role="group" aria-label={t("clients.m.contact")}>
              {contact.map((c) => (
                <a key={c.key} href={c.href} className="c-act" {...(c.external ? { target: "_blank", rel: "noreferrer" } : {})}>
                  <c.icon aria-hidden="true" />
                  <span>{c.label}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      <StatStrip
        label={t("clients.m.numbers")}
        items={[
          { label: t("clients.col.quotes"), value: isLoading ? "—" : String(quotes?.length ?? 0), sub: won.length ? t("clients.m.wonCount").replace("{n}", String(won.length)) : undefined },
          { label: t("clients.detail.totalValue"), value: formatCadWhole(totalValue) },
          { label: t("clients.m.won"), value: formatCadWhole(wonValue), tone: wonValue > 0 ? "ok" : undefined },
          hasInvoices
            ? { label: t("clients.m.owed"), value: formatCadWhole(owedCents / 100), tone: owedCents > 0 ? "warn" : undefined }
            : { label: t("clients.m.jobs"), value: String(jobs.length) },
        ]}
      />

      {!isLoading && (partitaIva || businessNumber || (indirizzo && !city)) && (
        <div className="card">
          {partitaIva && <div className="kv"><span>{t("clients.detail.gstNumber")}</span><b>{partitaIva}</b></div>}
          {businessNumber && <div className="kv"><span>{t("clients.detail.businessNumber")}</span><b>{businessNumber}</b></div>}
          {indirizzo && <div className="kv"><span>{t("clients.detail.address")}</span><b>{indirizzo}{city ? `, ${city}` : ""}</b></div>}
        </div>
      )}

      <ScrollTabs tabs={tabs} value={tab} onChange={setTab} sticky label={t("clients.m.sections")} />

      {tab === "messages" ? (
        clientId && (
          <div className="c-msgs">
            <ClientThreadCard clientId={clientId} />
            <ClientPortalCard clientId={clientId} />
          </div>
        )
      ) : (
        <div className="card">
          {tab === "quotes" && (
            isLoading ? (
              <ListSkeleton rows={4} />
            ) : !quotes || quotes.length === 0 ? (
              <div className="card-empty">{t("clients.detail.noQuotes")}</div>
            ) : (
              <ul className="lrows" aria-label={t("clients.col.quotes")}>
                {quotes.map((q) => {
                  const chip = quoteStatusChip(q as never, t);
                  return (
                    <li key={q.id}>
                      <ListRow
                        href={`/dashboard/quotes/${q.id}`}
                        title={q.titoloPreventivoRiga2 || q.descrizioneGenerale || t("clients.detail.quote")}
                        meta={[format(new Date(q.createdAt), "d MMM yyyy", { locale }), q.numeroPreventivoData]}
                        amount={q.status === "draft" ? "—" : formatCadWhole(q.totale)}
                        end={<span className={cn("chip", chip.cls)}>{chip.label}</span>}
                      />
                    </li>
                  );
                })}
              </ul>
            )
          )}
          {tab === "jobs" && (
            jobsQ.isLoading ? <ListSkeleton rows={3} />
            : jobs.length === 0 ? <div className="card-empty">{t("clients.m.noJobs")}</div>
            : (
              <ul className="lrows jlist" aria-label={t("clients.m.jobs")}>
                {jobs.map((j) => (
                  <li key={j.id}>
                    <ListRow
                      href={j.setupStatus === "pending_review" ? `/dashboard/jobs/${j.id}/setup` : `/dashboard/jobs/${j.id}`}
                      title={j.name}
                      meta={[j.address, j.nextMilestone?.title]}
                      below={
                        <span className="jlist-prog">
                          <span className="pbar" aria-hidden="true"><i style={{ width: `${j.progressPercent}%` }} /></span>
                          <span>{j.progressPercent}%</span>
                        </span>
                      }
                      amount={formatCadWhole(j.totalValueCents / 100)}
                      end={<JobStatusBadge status={j.status} pendingReview={j.setupStatus === "pending_review"} />}
                    />
                  </li>
                ))}
              </ul>
            )
          )}
          {tab === "invoices" && (
            invoicesQ.isLoading ? <ListSkeleton rows={3} />
            : invoices.length === 0 ? <div className="card-empty">{t("clients.m.noInvoices")}</div>
            : (
              <ul className="lrows" aria-label={t("clients.m.invoices")}>
                {invoices.map((inv) => <li key={inv.id}><InvoiceListRow inv={inv} locale={locale} showClient={false} /></li>)}
              </ul>
            )
          )}
        </div>
      )}
    </div>
  );
}
