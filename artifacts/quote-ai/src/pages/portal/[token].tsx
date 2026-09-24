import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertTriangle, Mail, ShieldCheck, LayoutDashboard, FileText, FileSignature, Receipt, Camera, MessageSquare, Download, CreditCard, Clock, ExternalLink, CheckCircle2, LogOut, MapPin, Send, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Logo } from "@/components/logo";
import { portalApi, getPortalSession, setPortalSession, type PortalOverviewDto, type PortalJobDto, type PortalMessageDto } from "@/lib/portal-api";

type Section = "home" | "quotes" | "contracts" | "invoices" | "photos" | "messages";
const SECTIONS: Section[] = ["home", "quotes", "contracts", "invoices", "photos", "messages"];
const SECTION_ICONS: Record<Section, typeof LayoutDashboard> = { home: LayoutDashboard, quotes: FileText, contracts: FileSignature, invoices: Receipt, photos: Camera, messages: MessageSquare };

/**
 * Phase 76: the client portal. No account: the link identifies the client,
 * an emailed code proves the mailbox, and the session lives in this browser.
 * One page, six sections — everything the company has sent this client.
 */
export default function PortalPage() {
  const { token } = useParams<{ token: string }>();
  const { t, setLang } = useLanguage();
  const queryClient = useQueryClient();
  const [sessionVersion, setSessionVersion] = useState(0);
  const header = useQuery({ queryKey: ["portal", token, "header", sessionVersion], queryFn: () => portalApi.header(token!), enabled: !!token, retry: false });
  const authenticated = !!header.data?.authenticated && !!getPortalSession(token!);
  const overview = useQuery({ queryKey: ["portal", token, "overview"], queryFn: () => portalApi.overview(token!), enabled: !!token && authenticated, retry: false });

  useDocumentTitle(header.data ? `${t("portal.title")} · ${header.data.company.name}` : null);
  useEffect(() => {
    if (header.data?.client.language) setLang(header.data.client.language);
  }, [header.data?.client.language, setLang]);

  // A 401 on the overview means the stored session died (expired / revoked): back to the gate.
  useEffect(() => {
    const err = overview.error as (Error & { status?: number }) | null;
    if (err?.status === 401) {
      setPortalSession(token!, null);
      setSessionVersion((v) => v + 1);
    }
  }, [overview.error, token]);

  if (header.isLoading) {
    return <div className="doc-shell flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--navy)" }} /></div>;
  }
  if (header.error || !header.data) {
    return (
      <div className="doc-shell flex items-center justify-center p-6">
        <div className="card max-w-md w-full p-8 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
          <AlertTriangle className="h-10 w-10 mx-auto mb-4" style={{ color: "var(--yellow-dark)" }} />
          <h1 className="text-lg font-semibold" style={{ color: "var(--navy)" }}>{t("portal.notFoundTitle")}</h1>
          <p className="text-sm mt-2" style={{ color: "var(--muted-mk)" }}>{t("portal.notFoundDesc")}</p>
        </div>
      </div>
    );
  }

  const { company, client } = header.data;

  return (
    <div className="doc-shell pb-16">
      <header className="doc-head">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            {company.logoUrl ? <img src={company.logoUrl} alt="" className="h-8 w-8 rounded-lg object-contain shrink-0" style={{ border: "1px solid var(--line)" }} /> : null}
            <div className="min-w-0">
              <div className="text-xs truncate" style={{ color: "var(--muted-mk)" }}>{t("portal.title")}</div>
              <div className="text-sm font-semibold truncate" style={{ color: "var(--navy)" }}>{company.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {authenticated && (
              <button
                type="button"
                className="text-xs inline-flex items-center gap-1 font-medium"
                style={{ color: "var(--muted-mk)" }}
                onClick={async () => {
                  try { await portalApi.logout(token!); } catch { /* the local session is dropped regardless */ }
                  setPortalSession(token!, null);
                  queryClient.removeQueries({ queryKey: ["portal", token] });
                  setSessionVersion((v) => v + 1);
                }}
              >
                <LogOut className="h-3.5 w-3.5" /> {t("portal.signOut")}
              </button>
            )}
            <Logo className="h-6" />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {!authenticated ? (
          <Gate token={token!} clientName={client.name} emailMasked={client.emailMasked} companyName={company.name} onVerified={() => setSessionVersion((v) => v + 1)} />
        ) : overview.isLoading || !overview.data ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--navy)" }} /></div>
        ) : (
          <Portal token={token!} data={overview.data} />
        )}
        <p className="text-center text-xs" style={{ color: "var(--faint)" }}>
          {t("portal.questions")} {company.email && <a className="underline" href={`mailto:${company.email}`}>{company.email}</a>}{company.phone && <> · {company.phone}</>}
        </p>
      </main>
    </div>
  );
}

// ── The code gate ───────────────────────────────────────────────────────────

function Gate({ token, clientName, emailMasked, companyName, onVerified }: { token: string; clientName: string; emailMasked: string | null; companyName: string; onVerified: () => void }) {
  const { t } = useLanguage();
  const [step, setStep] = useState<"intro" | "otp">("intro");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const request = useMutation({
    mutationFn: () => portalApi.otp(token),
    onSuccess: () => { setStep("otp"); setError(null); },
    onError: (e: Error & { code?: string }) => setError(e.code === "no_email" ? t("portal.noEmail") : t("portal.otpError")),
  });
  const verify = useMutation({
    mutationFn: () => portalApi.verify(token, code.trim()),
    onSuccess: (r) => { setPortalSession(token, r.session); onVerified(); },
    onError: (e: Error & { code?: string }) => setError(e.code === "invalid_code" ? t("sign.invalidCode") : e.code === "code_expired" ? t("sign.codeExpired") : e.code === "too_many_attempts" ? t("sign.tooManyAttempts") : e.message),
  });

  return (
    <div className="card max-w-lg mx-auto p-6 sm:p-8 space-y-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-start gap-3">
        <ShieldCheck className="h-6 w-6 mt-0.5 shrink-0" style={{ color: "var(--navy)" }} />
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--navy)" }}>{t("portal.gateTitle").replace("{name}", clientName)}</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-mk)" }}>{t("portal.gateDesc").replace("{company}", companyName)}</p>
        </div>
      </div>
      {!emailMasked ? (
        <p className="text-sm" style={{ color: "var(--red)" }}>{t("portal.noEmail")}</p>
      ) : step === "intro" ? (
        <>
          <p className="text-sm" style={{ color: "var(--ink)" }}>{t("portal.gateEmailHint").replace("{email}", emailMasked)}</p>
          {error && <p className="text-sm" style={{ color: "var(--red)" }}>{error}</p>}
          <button type="button" className="btn btn-navy w-full" onClick={() => request.mutate()} disabled={request.isPending}>
            {request.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} {t("portal.sendCode")}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm" style={{ color: "var(--ink)" }}>{t("sign.otpDesc").replace("{email}", emailMasked)}</p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => { if (e.key === "Enter" && code.length === 6) verify.mutate(); }}
            placeholder="000000"
            aria-label={t("a11y.otpCode")}
            aria-invalid={error ? true : undefined}
            className="text-center text-2xl tracking-[0.5em] font-bold h-14 w-full rounded-xl"
            style={{ border: "1px solid var(--line)", color: "var(--ink)" }}
          />
          {error && <p className="text-sm" style={{ color: "var(--red)" }}>{error}</p>}
          <div className="flex flex-col sm:flex-row gap-2">
            <button type="button" onClick={() => verify.mutate()} disabled={code.length !== 6 || verify.isPending} className="btn btn-navy flex-1">
              {verify.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("portal.open")}
            </button>
            <button type="button" onClick={() => request.mutate()} disabled={request.isPending} className="btn btn-outline-navy">{t("sign.resendCode")}</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── The portal proper ───────────────────────────────────────────────────────

function Portal({ token, data }: { token: string; data: PortalOverviewDto }) {
  const { t, lang } = useLanguage();
  const [section, setSection] = useState<Section>("home");
  const fmt = useMemo(() => new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" }), [lang]);
  const cents = (c: number) => fmt.format(c / 100);
  const day = (s: string | null) => (s ? new Date(s).toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", { dateStyle: "medium" }) : "—");

  const openInvoices = data.invoices.filter((i) => i.type !== "credit_note" && i.status !== "paid" && i.balanceCents > 0);
  const owing = openInvoices.reduce((s, i) => s + i.balanceCents, 0);
  const toSign = data.contracts.filter((c) => c.canSign);
  const toAccept = data.quotes.filter((q) => q.status === "unlocked");
  const unreadMessages = data.messages.filter((m) => m.sender === "contractor" && !m.readAt).length;
  const photoCount = data.jobs.reduce((s, j) => s + j.photos.length, 0);
  const counts: Partial<Record<Section, number>> = { quotes: toAccept.length, contracts: toSign.length, invoices: openInvoices.length, photos: photoCount, messages: unreadMessages };

  return (
    <>
      <div className="pills scroll">
        {SECTIONS.map((k) => {
          const Icon = SECTION_ICONS[k];
          const count = counts[k];
          return (
            <button key={k} type="button" onClick={() => setSection(k)} className={cn("pill inline-flex items-center gap-1.5", section === k && "on")}>
              <Icon className="h-4 w-4" /> {t(`portal.section.${k}`)}{count ? <span className="cnt ml-1 rounded-full px-1.5 text-[11px]" style={{ background: section === k ? "rgba(255,255,255,.2)" : "var(--soft-2)" }}>{count}</span> : null}
            </button>
          );
        })}
      </div>

      {section === "home" && (
        <div className="stack">
          {(owing > 0 || toSign.length > 0 || toAccept.length > 0) && (
            <section className="card p-5" style={{ borderColor: "var(--yellow-t)", background: "var(--yellow-t)" }}>
              <p className="eyebrow" style={{ color: "var(--yellow-dark)" }}>{t("portal.attention")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {owing > 0 && <button type="button" className="btn btn-sm btn-navy" onClick={() => setSection("invoices")}><Receipt className="h-4 w-4" /> {t("portal.attention.owing").replace("{amount}", cents(owing))}</button>}
                {toSign.length > 0 && <button type="button" className="btn btn-sm btn-outline-navy" style={{ background: "#fff" }} onClick={() => setSection("contracts")}><FileSignature className="h-4 w-4" /> {t(toSign.length === 1 ? "portal.attention.sign" : "portal.attention.signMany").replace("{n}", String(toSign.length))}</button>}
                {toAccept.length > 0 && <button type="button" className="btn btn-sm btn-outline-navy" style={{ background: "#fff" }} onClick={() => setSection("quotes")}><FileText className="h-4 w-4" /> {t(toAccept.length === 1 ? "portal.attention.quote" : "portal.attention.quoteMany").replace("{n}", String(toAccept.length))}</button>}
              </div>
            </section>
          )}
          {data.jobs.length === 0 ? (
            <section className="card"><div className="card-empty">{t("portal.noJobs")}</div></section>
          ) : (
            data.jobs.map((job) => <JobCard key={job.id} job={job} day={day} onPhotos={() => setSection("photos")} />)
          )}
        </div>
      )}

      {section === "quotes" && (
        <section className="card">
          <div className="card-head"><div><h2>{t("portal.section.quotes")}</h2><p className="sub">{t("portal.quotes.sub")}</p></div></div>
          {data.quotes.length === 0 ? <div className="card-empty">{t("portal.quotes.empty")}</div> : data.quotes.map((q) => (
            <div key={q.id} className="item-row">
              <div className="grow">
                <span className="ttl">{q.title || t("publicQuote.quoteFallback")}{q.number ? ` · ${q.number}` : ""}</span>
                <span className="sub">{day(q.createdAt)} · {fmt.format(q.total)}</span>
              </div>
              <span className={cn("chip", q.status === "accepted" ? "chip-green" : "chip-yellow")}>{q.status === "accepted" ? t("portal.quote.accepted") : t("portal.quote.awaiting")}</span>
              <a href={q.url} className="btn btn-sm btn-outline-navy"><ExternalLink className="h-4 w-4" /> {q.status === "accepted" ? t("portal.view") : t("portal.quote.review")}</a>
            </div>
          ))}
        </section>
      )}

      {section === "contracts" && <ContractsSection token={token} data={data} day={day} fmt={fmt} />}
      {section === "invoices" && <InvoicesSection token={token} data={data} day={day} cents={cents} />}

      {section === "photos" && (
        <div className="stack">
          {photoCount === 0 ? (
            <section className="card"><div className="card-empty">{t("portal.photos.empty")}</div></section>
          ) : (
            data.jobs.filter((j) => j.photos.length > 0).map((job) => (
              <section key={job.id} className="card">
                <div className="card-head"><div><h2>{job.name}</h2><p className="sub">{t("portal.photos.count").replace("{n}", String(job.photos.length))}</p></div></div>
                <div className="act-body grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {job.photos.map((ph) => (
                    <figure key={ph.id} className="m-0">
                      <PortalImage token={token} photoId={ph.id} alt={ph.caption} />
                      <figcaption className="text-xs mt-1 truncate" style={{ color: "var(--faint)" }}>{ph.caption || day(ph.createdAt)}</figcaption>
                    </figure>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      )}

      {section === "messages" && <MessagesSection token={token} data={data} />}
    </>
  );
}

function JobCard({ job, day, onPhotos }: { job: PortalJobDto; day: (s: string | null) => string; onPhotos: () => void }) {
  const { t } = useLanguage();
  const statusChip = job.status === "completed" ? "chip-green" : job.status === "active" ? "chip-teal" : job.status === "suspended" ? "chip-yellow" : "chip-grey";
  return (
    <section className="card">
      <div className="card-head">
        <div className="min-w-0">
          <h2 className="truncate">{job.name}</h2>
          {job.address && <p className="sub inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {job.address}</p>}
        </div>
        <span className={cn("chip", statusChip)}>{t(`portal.job.status.${job.status}`)}</span>
      </div>
      <div className="act-body space-y-4">
        <div>
          <div className="flex items-center justify-between text-sm font-semibold" style={{ color: "var(--navy)" }}>
            <span>{t("portal.job.progress")}</span><span>{job.progressPercent}%</span>
          </div>
          <div className="pbar mt-1" style={{ width: "100%" }}><i style={{ width: `${job.progressPercent}%` }} /></div>
          {(job.plannedStart || job.plannedEnd) && <p className="text-xs mt-1" style={{ color: "var(--faint)" }}>{day(job.plannedStart)} → {day(job.plannedEnd)}</p>}
        </div>
        {job.milestones.length > 0 && (
          <ol className="space-y-1.5 m-0 p-0 list-none">
            {job.milestones.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-sm" style={{ color: "var(--ink)" }}>
                {m.status === "completed" ? <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "var(--green)" }} /> : m.status === "in_progress" ? <Clock className="h-4 w-4 shrink-0" style={{ color: "var(--teal)" }} /> : <Circle className="h-4 w-4 shrink-0" style={{ color: "var(--line)" }} />}
                <span className={cn("grow truncate", m.status === "completed" && "opacity-70")}>{m.title}</span>
                <span className="text-xs shrink-0" style={{ color: "var(--faint)" }}>{m.status === "completed" ? day(m.actualEnd ?? m.plannedEnd) : m.plannedEnd ? day(m.plannedEnd) : ""}</span>
              </li>
            ))}
          </ol>
        )}
        {job.photos.length > 0 && (
          <button type="button" className="text-link inline-flex items-center gap-1" onClick={onPhotos}><Camera className="h-4 w-4" /> {t("portal.photos.count").replace("{n}", String(job.photos.length))}</button>
        )}
      </div>
    </section>
  );
}

function ContractsSection({ token, data, day, fmt }: { token: string; data: PortalOverviewDto; day: (s: string | null) => string; fmt: Intl.NumberFormat }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const sign = useMutation({
    mutationFn: (id: string) => portalApi.signLink(token, id),
    onSuccess: (r) => { window.location.href = r.url; },
    onError: () => toast({ title: t("portal.actionError"), variant: "destructive" }),
  });
  const chip = (s: string) => (s === "signed" ? "chip-green" : s === "sent" || s === "viewed" ? "chip-yellow" : "chip-grey");
  return (
    <section className="card">
      <div className="card-head"><div><h2>{t("portal.section.contracts")}</h2><p className="sub">{t("portal.contracts.sub")}</p></div></div>
      {data.contracts.length === 0 ? <div className="card-empty">{t("portal.contracts.empty")}</div> : data.contracts.map((c) => (
        <div key={c.id} className="item-row flex-wrap">
          <div className="grow">
            <span className="ttl">{c.title} · {c.contractNumber}</span>
            <span className="sub">{fmt.format(c.total)}{c.signedAt ? ` · ${t("portal.contract.signedOn")} ${day(c.signedAt)}` : c.sentAt ? ` · ${t("portal.contract.sentOn")} ${day(c.sentAt)}` : ""}</span>
          </div>
          <span className={cn("chip", chip(c.status))}>{t(`portal.contract.status.${c.status}`)}</span>
          {c.canSign && (
            <button type="button" className="btn btn-sm btn-navy" onClick={() => sign.mutate(c.id)} disabled={sign.isPending}>
              {sign.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} {t("portal.contract.sign")}
            </button>
          )}
          <DownloadButton token={token} path={portalApi.contractPdfPath(token, c.id)} filename={`${c.contractNumber}.pdf`} />
        </div>
      ))}
    </section>
  );
}

function InvoicesSection({ token, data, day, cents }: { token: string; data: PortalOverviewDto; day: (s: string | null) => string; cents: (c: number) => string }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<string | null>(null);
  const pay = useMutation({
    mutationFn: (id: string) => portalApi.payLink(token, id),
    onSuccess: (r) => { window.location.href = r.url; },
    onError: () => toast({ title: t("publicInvoice.payError"), variant: "destructive" }),
  });
  const markSent = useMutation({
    mutationFn: (id: string) => portalApi.markSent(token, id),
    onSuccess: () => { setConfirming(null); queryClient.invalidateQueries({ queryKey: ["portal", token, "overview"] }); },
    onError: () => toast({ title: t("publicInvoice.markSentError"), variant: "destructive" }),
  });
  const chip = (s: string) => (s === "paid" ? "chip-green" : s === "overdue" ? "chip-red" : s === "pending_confirmation" ? "chip-teal" : "chip-yellow");
  const open = data.invoices.filter((i) => i.status !== "paid");
  const paid = data.invoices.filter((i) => i.status === "paid");
  const row = (inv: PortalOverviewDto["invoices"][number]) => {
    const credit = inv.type === "credit_note";
    const canAct = !credit && inv.status !== "paid" && inv.status !== "pending_confirmation" && inv.balanceCents > 0;
    return (
      <div key={inv.id} className="item-row flex-wrap" style={inv.status === "overdue" ? { background: "var(--red-t)" } : undefined}>
        <div className="grow">
          <span className="ttl">{credit ? t("invoices.type.credit_note") : t("publicInvoice.invoice")} {inv.number}{inv.title ? ` · ${inv.title}` : ""}</span>
          <span className="sub">{inv.status === "paid" ? `${t("publicInvoice.paidOn")} ${day(inv.paidAt)}` : `${t("publicInvoice.dueBy")} ${day(inv.dueDate)}`}{inv.paidCents > 0 && inv.status !== "paid" ? ` · ${t("publicInvoice.alreadyPaid")} ${cents(inv.paidCents)}` : ""}</span>
        </div>
        <b style={{ color: "var(--navy)" }}>{cents(credit || inv.status === "paid" ? inv.totalCents : inv.balanceCents)}</b>
        <span className={cn("chip", chip(inv.status))}>{t(`portal.invoice.status.${inv.status}`)}</span>
        {canAct && inv.canPayByCard && (
          <button type="button" className="btn btn-sm btn-navy" onClick={() => pay.mutate(inv.id)} disabled={pay.isPending}>
            {pay.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} {t("publicInvoice.payByCard")}
          </button>
        )}
        {canAct && inv.etransferEmail && confirming !== inv.id && (
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setConfirming(inv.id)}><Clock className="h-4 w-4" /> {t("publicInvoice.iSentIt")}</button>
        )}
        <DownloadButton token={token} path={portalApi.invoicePdfPath(token, inv.id)} filename={`${inv.number}.pdf`} />
        {inv.url && <a href={inv.url} className="btn btn-sm btn-outline-navy" aria-label={t("portal.view")}><ExternalLink className="h-4 w-4" /></a>}
        {confirming === inv.id && (
          <div className="w-full mt-2 rounded-lg p-3 space-y-2 text-sm" style={{ background: "var(--soft)", border: "1px solid var(--line)" }}>
            <p style={{ color: "var(--ink)" }}>{t("portal.invoice.etransferTo").replace("{email}", inv.etransferEmail ?? "")} {t("publicInvoice.markSentConfirm")}</p>
            <div className="flex gap-2">
              <button type="button" className="btn btn-outline-navy btn-sm" onClick={() => setConfirming(null)}>{t("jobs.cancel")}</button>
              <button type="button" className="btn btn-navy btn-sm" onClick={() => markSent.mutate(inv.id)} disabled={markSent.isPending}>{markSent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t("publicInvoice.confirmSent")}</button>
            </div>
          </div>
        )}
      </div>
    );
  };
  return (
    <div className="stack">
      <section className="card">
        <div className="card-head"><div><h2>{t("portal.invoices.open")}</h2><p className="sub">{t("portal.invoices.sub")}</p></div></div>
        {open.length === 0 ? <div className="card-empty">{t("portal.invoices.emptyOpen")}</div> : open.map(row)}
      </section>
      {paid.length > 0 && (
        <section className="card">
          <div className="card-head"><div><h2>{t("portal.invoices.paid")}</h2></div></div>
          {paid.map(row)}
        </section>
      )}
    </div>
  );
}

function MessagesSection({ token, data }: { token: string; data: PortalOverviewDto }) {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [jobId, setJobId] = useState<string>(data.jobs.length === 1 ? data.jobs[0]!.id : "");
  const send = useMutation({
    mutationFn: () => portalApi.sendMessage(token, { body: body.trim(), jobId: jobId || null }),
    onSuccess: () => { setBody(""); queryClient.invalidateQueries({ queryKey: ["portal", token, "overview"] }); toast({ title: t("portal.messages.sent") }); },
    onError: () => toast({ title: t("portal.actionError"), variant: "destructive" }),
  });
  const when = (s: string) => new Date(s).toLocaleString(lang === "fr" ? "fr-CA" : "en-CA", { dateStyle: "medium", timeStyle: "short" });
  return (
    <section className="card">
      <div className="card-head"><div><h2>{t("portal.section.messages")}</h2><p className="sub">{t("portal.messages.sub").replace("{company}", data.company.name)}</p></div></div>
      <div className="act-body space-y-4">
        {data.messages.length === 0 ? (
          <p className="foot-note m-0">{t("portal.messages.empty")}</p>
        ) : (
          <ol className="space-y-3 m-0 p-0 list-none" aria-live="polite">
            {data.messages.map((m: PortalMessageDto) => (
              <li key={m.id} className={cn("flex", m.sender === "client" ? "justify-end" : "justify-start")}>
                <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm" style={m.sender === "client" ? { background: "var(--navy)", color: "#fff" } : { background: "var(--soft)", color: "var(--ink)" }}>
                  <div className="text-[11px] font-semibold mb-1 opacity-80">{m.sender === "client" ? t("portal.messages.you") : m.senderName || data.company.name}{m.jobName ? ` · ${m.jobName}` : ""} · {when(m.createdAt)}</div>
                  <div className="whitespace-pre-wrap">{m.body}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
        <div className="space-y-2">
          {data.jobs.length > 1 && (
            <div className="field">
              <label htmlFor="portal-msg-job">{t("portal.messages.about")}</label>
              <select id="portal-msg-job" value={jobId} onChange={(e) => setJobId(e.target.value)}>
                <option value="">{t("portal.messages.general")}</option>
                {data.jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="portal-msg-body">{t("portal.messages.compose")}</label>
            <textarea id="portal-msg-body" rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} placeholder={t("portal.messages.placeholder")} />
          </div>
          <div className="flex justify-end">
            <button type="button" className="btn btn-navy" onClick={() => send.mutate()} disabled={!body.trim() || send.isPending}>
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t("portal.messages.send")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Session-authenticated binary fetches ────────────────────────────────────

function DownloadButton({ token, path, filename }: { token: string; path: string; filename: string }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const blob = await portalApi.fetchBlob(token, path);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      toast({ title: t("portal.actionError"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" className="btn btn-sm btn-outline-navy" onClick={download} disabled={busy} aria-label={t("publicInvoice.downloadPdf")}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} <span className="hidden sm:inline">PDF</span>
    </button>
  );
}

function PortalImage({ token, photoId, alt }: { token: string; photoId: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    // Phase 96: the grid shows thumbnails; the original is one tap away.
    portalApi.fetchBlob(token, portalApi.photoPath(token, photoId, "thumb"))
      .then((blob) => { if (cancelled) return; url = URL.createObjectURL(blob); setSrc(url); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [token, photoId]);
  return (
    <div className="aspect-square rounded-xl overflow-hidden flex items-center justify-center" style={{ background: "var(--soft-2)" }}>
      {src ? <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" /> : failed ? <Camera className="h-6 w-6" style={{ color: "var(--faint)" }} /> : <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--faint)" }} />}
    </div>
  );
}
