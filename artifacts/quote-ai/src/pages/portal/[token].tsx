import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertTriangle, Download, Camera, Send, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { LangSwitch, Glyph, StatusPill, initialsOf, useClientTheme, type StatusTone } from "@/components/client/kit";
import { portalApi, getPortalSession, setPortalSession, type PortalOverviewDto, type PortalJobDto, type PortalMessageDto } from "@/lib/portal-api";

type Section = "home" | "quotes" | "contracts" | "invoices" | "photos" | "messages";
const SECTIONS: Section[] = ["home", "quotes", "contracts", "invoices", "photos", "messages"];

/**
 * Phase 76: the client portal. No account: the link identifies the client,
 * an emailed code proves the mailbox, and the session lives in this browser.
 * One page, six sections: everything the company has sent this client.
 *
 * Pocket 125.10: built from the Portal board: "Your project with", a tab strip with counts,
 * Home (needs your attention, progress with milestones, latest photos, last message),
 * lists with a status pill per row, photo grids and the message thread.
 */
export default function PortalPage() {
  const { token } = useParams<{ token: string }>();
  const { t, setLang } = useLanguage();
  useClientTheme();
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
    return <div className="cp-page" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--muted)" }} /></div>;
  }
  if (header.error || !header.data) {
    return (
      <div className="cp-page" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 24px" }}>
        <AlertTriangle className="h-10 w-10 mb-4" style={{ color: "var(--warn)" }} />
        <h1 style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.03em" }}>{t("portal.notFoundTitle")}</h1>
        <p className="cp-sub" style={{ marginTop: 6, maxWidth: 320 }}>{t("portal.notFoundDesc")}</p>
      </div>
    );
  }

  const { company, client } = header.data;

  return (
    <main id="main" className="cp-page">
      <div className="cp-col cp-pad">
        <header className="cp-rise" style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
          <span className="cp-mark" aria-hidden="true">{company.logoUrl ? <img src={company.logoUrl} alt="" /> : initialsOf(company.name)}</span>
          <span className="cp-head-t">
            <span>{t("cp.portal.portalOf")}</span>
            {authenticated ? <h1 style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{company.name}</h1> : <b>{company.name}</b>}
          </span>
          <LangSwitch />
        </header>

        {!authenticated ? (
          <Gate token={token!} clientName={client.name} emailMasked={client.emailMasked} companyName={company.name} onVerified={() => setSessionVersion((v) => v + 1)} />
        ) : overview.isLoading || !overview.data ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}><Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--muted)" }} /></div>
        ) : (
          <Portal token={token!} data={overview.data} />
        )}

        <p style={{ margin: "26px 16px 0", textAlign: "center", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>
          {t("portal.questions")} {company.email && <a href={`mailto:${company.email}`} style={{ color: "var(--ink)", fontWeight: 500 }}>{company.email}</a>}{company.phone && <> · <span className="cp-num">{company.phone}</span></>}
        </p>
        {authenticated && (
          <p style={{ textAlign: "center", margin: "4px 0 0" }}>
            <button
              type="button"
              className="cp-link"
              onClick={async () => {
                try { await portalApi.logout(token!); } catch { /* the local session is dropped regardless */ }
                setPortalSession(token!, null);
                queryClient.removeQueries({ queryKey: ["portal", token] });
                setSessionVersion((v) => v + 1);
              }}
            >
              {t("portal.signOut")}
            </button>
          </p>
        )}
      </div>
    </main>
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
    <section className="cp-rise" style={{ padding: "10px 16px 0" }}>
      <div className="cp-card" style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <Glyph name="shield" tone="sage" size={30} />
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.03em" }}>{t("portal.gateTitle").replace("{name}", clientName)}</h2>
            <p className="cp-sub" style={{ marginTop: 6 }}>{t("portal.gateDesc").replace("{company}", companyName)}</p>
          </div>
        </div>
        {!emailMasked ? (
          <p className="cp-err" style={{ marginTop: 14 }}>{t("portal.noEmail")}</p>
        ) : step === "intro" ? (
          <>
            <p style={{ marginTop: 14, fontSize: 14.5, lineHeight: 1.5, color: "var(--t2)" }}>{t("portal.gateEmailHint").replace("{email}", emailMasked)}</p>
            {error && <p className="cp-err" role="alert" style={{ marginTop: 10 }}>{error}</p>}
            <button type="button" className="cp-btn cp-btn-lg cp-btn-p cp-btn-w cp-press" style={{ marginTop: 14 }} onClick={() => request.mutate()} disabled={request.isPending}>
              {request.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t("portal.sendCode")}
            </button>
          </>
        ) : (
          <>
            <p style={{ marginTop: 14, fontSize: 14.5, lineHeight: 1.5, color: "var(--t2)" }}>{t("sign.otpDesc").replace("{email}", emailMasked)}</p>
            <div style={{ position: "relative", marginTop: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8 }} aria-hidden="true">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className="cp-num" style={{ height: 54, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 600, background: "var(--card)", boxShadow: error ? "0 0 0 1.5px var(--bad)" : i === code.length ? "0 0 0 2px var(--acc)" : "0 0 0 1px var(--line2)" }}>{code[i] ?? ""}</span>
                ))}
              </div>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => { if (e.key === "Enter" && code.length === 6) verify.mutate(); }}
                pattern="[0-9]*"
                enterKeyHint="go"
                autoFocus
                aria-label={t("a11y.otpCode")}
                aria-invalid={error ? true : undefined}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, border: 0, fontSize: 16 }}
              />
            </div>
            {error && <p className="cp-err" role="alert" style={{ marginTop: 10 }}>{error}</p>}
            <button type="button" onClick={() => verify.mutate()} disabled={code.length !== 6 || verify.isPending} className="cp-btn cp-btn-lg cp-btn-p cp-btn-w cp-press" style={{ marginTop: 14 }}>
              {verify.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t("portal.open")}
            </button>
            <p style={{ textAlign: "center", marginTop: 4 }}>
              <button type="button" onClick={() => request.mutate()} disabled={request.isPending} className="cp-link">{t("sign.resendCode")}</button>
            </p>
          </>
        )}
      </div>
    </section>
  );
}

// ── The portal proper ───────────────────────────────────────────────────────

function Portal({ token, data }: { token: string; data: PortalOverviewDto }) {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const [section, setSection] = useState<Section>("home");
  const locale = lang === "fr" ? "fr-CA" : "en-CA";
  const fmt = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency: "CAD" }), [locale]);
  const cents = (c: number) => fmt.format(c / 100);
  const asDate = (s: string) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00` : s);
  const day = (s: string | null) => (s ? asDate(s).toLocaleDateString(locale, { dateStyle: "medium" }) : "—");

  const openInvoices = data.invoices.filter((i) => i.type !== "credit_note" && i.status !== "paid" && i.status !== "void" && i.balanceCents > 0);
  const toSign = data.contracts.filter((c) => c.canSign);
  const toAccept = data.quotes.filter((q) => q.status === "unlocked");
  const unreadMessages = data.messages.filter((m) => m.sender === "contractor" && !m.readAt).length;
  const photoCount = data.jobs.reduce((s, j) => s + j.photos.length, 0);
  const counts: Partial<Record<Section, number>> = { quotes: toAccept.length, contracts: toSign.length, invoices: openInvoices.length, photos: photoCount, messages: unreadMessages };
  const job0 = data.jobs[0];

  const signLink = useMutation({
    mutationFn: (id: string) => portalApi.signLink(token, id),
    onSuccess: (r) => { window.location.href = r.url; },
    onError: () => toast({ title: t("portal.actionError"), variant: "destructive" }),
  });

  return (
    <>
      <section className="cp-rise" style={{ padding: "10px 20px 16px", animationDelay: "40ms" }}>
        <h2 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1.15 }}>{t("cp.portal.hi").replace("{name}", data.client.name)}</h2>
        {job0 && <p className="cp-sub" style={{ marginTop: 5 }}>{job0.name}{job0.address ? ` · ${job0.address}` : ""}</p>}
      </section>

      <nav className="cp-tabs cp-rise" role="tablist" aria-label={t("portal.title")} data-portal-tabs style={{ animationDelay: "70ms" }}>
        {SECTIONS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={section === k} className={`cp-tab${section === k ? " on" : ""}`} onClick={() => setSection(k)}>
            {t(`portal.section.${k}`)}
            {!!counts[k] && <span className="cp-num cp-badge">{counts[k]}</span>}
          </button>
        ))}
      </nav>

      {section === "home" && (
        <>
          {(openInvoices.length > 0 || toSign.length > 0 || toAccept.length > 0) && (
            <section className="cp-rise" style={{ padding: "20px 16px 0" }}>
              <div className="cp-sh"><h2>{t("portal.attention")}</h2><span className="cp-lnk cp-num">{openInvoices.length + toSign.length + toAccept.length}</span></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {openInvoices.map((inv) => (
                  <AttnCard key={inv.id} glyph="receipt" tone="amber"
                    title={`${t("publicInvoice.invoice")} ${inv.number}`}
                    status={inv.status === "overdue" ? { tone: "bad", shape: "alert", label: t("portal.invoice.status.overdue") } : { tone: "info", label: t(`portal.invoice.status.${inv.status}`) }}
                    sub={`${t("publicInvoice.dueBy")} ${day(inv.dueDate)}${inv.title ? ` · ${inv.title}` : ""}`}
                    amount={cents(inv.balanceCents)}
                    cta={inv.url ? <a href={inv.url} className="cp-btn cp-btn-sm cp-btn-p cp-press" style={{ padding: "0 16px" }}>{t("cp.portal.pay")}</a> : <button type="button" className="cp-btn cp-btn-sm cp-btn-p cp-press" style={{ padding: "0 16px" }} onClick={() => setSection("invoices")}>{t("cp.portal.pay")}</button>}
                  />
                ))}
                {toSign.map((c) => (
                  <AttnCard key={c.id} glyph="pen" tone="violet"
                    title={`${t("cp.portal.contract")} ${c.contractNumber}`}
                    status={{ tone: "acc", label: t("cp.portal.toSign") }}
                    sub={c.title}
                    amount={fmt.format(c.total)}
                    cta={<button type="button" className="cp-btn cp-btn-sm cp-btn-s cp-press" style={{ padding: "0 16px" }} onClick={() => signLink.mutate(c.id)} disabled={signLink.isPending}>{signLink.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t("cp.portal.review")}</button>}
                  />
                ))}
                {toAccept.map((q) => (
                  <AttnCard key={q.id} glyph="doc" tone="indigo"
                    title={`${t("publicQuote.quoteFallback")}${q.number ? ` ${q.number}` : ""}`}
                    status={{ tone: "info", label: t("portal.quote.awaiting") }}
                    sub={q.title || t("publicQuote.quoteFallback")}
                    amount={fmt.format(q.total)}
                    cta={<a href={q.url} className="cp-btn cp-btn-sm cp-btn-s cp-press" style={{ padding: "0 16px" }}>{t("cp.portal.review")}</a>}
                  />
                ))}
              </div>
            </section>
          )}

          {data.jobs.length === 0 ? (
            <section className="cp-section"><div className="cp-card" style={{ padding: 18, textAlign: "center" }}><p className="cp-sub">{t("portal.noJobs")}</p></div></section>
          ) : (
            data.jobs.map((job) => <JobProgress key={job.id} job={job} day={day} />)
          )}

          {photoCount > 0 && (
            <section className="cp-rise cp-section" style={{ animationDelay: "110ms" }}>
              <div className="cp-sh"><h2>{t("cp.portal.latestPhotos")}</h2><button type="button" className="cp-lnk cp-press" onClick={() => setSection("photos")} style={{ border: 0, background: "transparent", height: 32, padding: 0 }}>{t("cp.portal.seeAll")}</button></div>
              <div className="cp-grid3">
                {data.jobs.flatMap((j) => j.photos).slice(0, 6).map((ph) => (
                  <button key={ph.id} type="button" className="cp-photo cp-press" aria-label={ph.caption || t("cp.portal.photo")} onClick={() => setSection("photos")}>
                    <PortalImage token={token} photoId={ph.id} alt={ph.caption} />
                  </button>
                ))}
              </div>
            </section>
          )}

          {data.messages.length > 0 && (() => {
            const last = data.messages[data.messages.length - 1]!;
            return (
              <section className="cp-rise cp-section" style={{ animationDelay: "150ms" }}>
                <div className="cp-sh"><h2>{t("portal.section.messages")}</h2><button type="button" className="cp-lnk cp-press" onClick={() => setSection("messages")} style={{ border: 0, background: "transparent", height: 32, padding: 0 }}>{t("portal.open")}</button></div>
                <button type="button" className="cp-card cp-press" onClick={() => setSection("messages")} style={{ width: "100%", border: 0, textAlign: "left", padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start", color: "inherit" }}>
                  <span className="cp-av" style={{ width: 36, height: 36, background: "var(--warn-soft)", color: "var(--warn)" }}>{initialsOf(last.sender === "client" ? data.client.name : last.senderName || data.company.name)}</span>
                  <span style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <b style={{ fontSize: 14.5, fontWeight: 600 }}>{last.sender === "client" ? t("portal.messages.you") : last.senderName || data.company.name}</b>
                      <span className="cp-mono" style={{ fontSize: 11.5, color: "var(--faint)" }}>{new Date(last.createdAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</span>
                    </span>
                    <span style={{ fontSize: 13.5, color: "var(--t2)", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{last.body}</span>
                  </span>
                </button>
              </section>
            );
          })()}
        </>
      )}

      {section === "quotes" && (
        <section className="cp-rise" style={{ padding: "20px 16px 0" }}>
          <p className="cp-sub" style={{ margin: "0 4px 10px" }}>{t("portal.quotes.sub")}</p>
          {data.quotes.length === 0 ? <Empty text={t("portal.quotes.empty")} /> : (
            <div className="cp-card" style={{ overflow: "hidden" }}>
              {data.quotes.map((q) => (
                <a key={q.id} href={q.url} className="cp-lrow" style={{ paddingTop: 14, paddingBottom: 14 }}>
                  <Glyph name="doc" tone="indigo" />
                  <span className="cp-lt"><b>{q.title || t("publicQuote.quoteFallback")}</b><small><span className="cp-mono">{q.number}</span>{q.number ? " · " : ""}{day(q.createdAt)}</small></span>
                  <span className="cp-lr"><span className="cp-num" style={{ fontSize: 14.5, fontWeight: 600 }}>{fmt.format(q.total)}</span>
                    {q.status === "accepted" ? <StatusPill tone="ok">{t("portal.quote.accepted")}</StatusPill> : <StatusPill tone="info">{t("portal.quote.awaiting")}</StatusPill>}
                  </span>
                </a>
              ))}
            </div>
          )}
        </section>
      )}

      {section === "contracts" && <ContractsSection token={token} data={data} day={day} fmt={fmt} signLink={signLink} />}
      {section === "invoices" && <InvoicesSection token={token} data={data} day={day} cents={cents} />}

      {section === "photos" && (
        <>
          {photoCount === 0 ? (
            <section className="cp-section"><Empty text={t("portal.photos.empty")} /></section>
          ) : (
            data.jobs.filter((j) => j.photos.length > 0).map((job) => (
              <section key={job.id} className="cp-rise" style={{ padding: "20px 16px 0" }}>
                <div className="cp-sh"><h2>{job.name}</h2><span className="cp-lnk"><span className="cp-num">{job.photos.length}</span></span></div>
                <div className="cp-grid3">
                  {job.photos.map((ph) => (
                    <figure key={ph.id} className="cp-photo" style={{ margin: 0 }}>
                      <PortalImage token={token} photoId={ph.id} alt={ph.caption || day(ph.createdAt)} />
                    </figure>
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      )}

      {section === "messages" && <MessagesSection token={token} data={data} />}
    </>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="cp-card" style={{ padding: "28px 24px", textAlign: "center" }}><p className="cp-sub">{text}</p></div>;
}

function AttnCard({ glyph, tone, title, status, sub, amount, cta }: { glyph: string; tone: string; title: string; status: { tone: StatusTone; shape?: "alert"; label: string }; sub: string; amount: string; cta: React.ReactNode }) {
  return (
    <div className="cp-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Glyph name={glyph} tone={tone} size={30} />
        <span style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <b style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.015em" }}>{title}</b>
            <StatusPill tone={status.tone} shape={status.shape}>{status.label}</StatusPill>
          </span>
          <small style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.4 }}>{sub}</small>
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingLeft: 42 }}>
        <span className="cp-num" style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}>{amount}</span>
        {cta}
      </div>
    </div>
  );
}

function JobProgress({ job, day }: { job: PortalJobDto; day: (s: string | null) => string }) {
  const { t } = useLanguage();
  const now = job.milestones.find((m) => m.status === "in_progress");
  return (
    <section className="cp-rise cp-section" style={{ animationDelay: "60ms" }}>
      <div className="cp-sh"><h2>{t("portal.job.progress")}</h2><span className="cp-lnk">{t(`portal.job.status.${job.status}`)}</span></div>
      <div className="cp-card" style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <b style={{ fontSize: 15, fontWeight: 600 }}>{job.name}</b>
            {now && <small style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("cp.portal.now").replace("{phase}", now.title)}</small>}
            {(job.plannedStart || job.plannedEnd) && <small style={{ fontSize: 12.5, color: "var(--muted)" }}>{day(job.plannedStart)} → {day(job.plannedEnd)}</small>}
          </span>
          <span className="cp-num" style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.04em" }}>{job.progressPercent}%</span>
        </div>
        <span className="cp-bar" style={{ marginTop: 12, height: 6 }}><span style={{ width: `${job.progressPercent}%`, transition: "width 1s cubic-bezier(.16,1,.3,1)" }} /></span>
        {job.milestones.length > 0 && (
          <ol style={{ margin: "18px 0 0", padding: 0, listStyle: "none" }}>
            {job.milestones.map((m, i) => {
              const done = m.status === "completed";
              const cur = m.status === "in_progress";
              return (
                <li key={m.id} style={{ display: "flex", gap: 14, minHeight: 46 }}>
                  <span style={{ position: "relative", width: 22, flexShrink: 0, display: "flex", justifyContent: "center" }}>
                    {i < job.milestones.length - 1 && <span style={{ position: "absolute", top: 22, bottom: -2, width: 2, borderRadius: 2, background: done ? "var(--ok-dot)" : "var(--line2)" }} />}
                    <span style={{ position: "relative", width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: done ? "var(--ok-dot)" : "transparent", boxShadow: done ? "none" : cur ? "inset 0 0 0 2px var(--acc)" : "inset 0 0 0 1.6px var(--line2)" }}>
                      {done && <Check width={12} height={12} strokeWidth={3.2} aria-hidden="true" style={{ color: "var(--card)" }} />}
                      {cur && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--acc)" }} />}
                    </span>
                  </span>
                  <span style={{ flexGrow: 1, minWidth: 0, display: "flex", justifyContent: "space-between", gap: 10, paddingTop: 1 }}>
                    <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 14.5, color: done || cur ? "var(--ink)" : "var(--muted)", fontWeight: cur ? 500 : 400 }}>{m.title}</span>
                      {cur && <small style={{ fontSize: 12.5, color: "var(--acc-t)" }}>{t("portal.job.status.active")}</small>}
                    </span>
                    <span className="cp-mono" style={{ fontSize: 12.5, color: "var(--muted)", whiteSpace: "nowrap" }}>{done ? day(m.actualEnd ?? m.plannedEnd) : m.plannedEnd ? day(m.plannedEnd) : ""}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

function ContractsSection({ token, data, day, fmt, signLink }: { token: string; data: PortalOverviewDto; day: (s: string | null) => string; fmt: Intl.NumberFormat; signLink: { mutate: (id: string) => void; isPending: boolean } }) {
  const { t } = useLanguage();
  const tone = (s: string): StatusTone => (s === "signed" ? "ok" : s === "sent" || s === "viewed" ? "warn" : s === "declined" ? "bad" : "mute");
  return (
    <section className="cp-rise" style={{ padding: "20px 16px 0" }}>
      <p className="cp-sub" style={{ margin: "0 4px 10px" }}>{t("portal.contracts.sub")}</p>
      {data.contracts.length === 0 ? <Empty text={t("portal.contracts.empty")} /> : (
        <div className="cp-card" style={{ overflow: "hidden" }}>
          {data.contracts.map((c) => (
            <div key={c.id} className="cp-lrow" style={{ flexWrap: "wrap", paddingTop: 14, paddingBottom: 14 }}>
              <Glyph name="pen" tone="violet" />
              <span className="cp-lt"><b>{c.title}</b><small><span className="cp-mono">{c.contractNumber}</span> · {c.signedAt ? `${t("portal.contract.signedOn")} ${day(c.signedAt)}` : c.sentAt ? `${t("portal.contract.sentOn")} ${day(c.sentAt)}` : ""}</small></span>
              <span className="cp-lr"><span className="cp-num" style={{ fontSize: 14.5, fontWeight: 600 }}>{fmt.format(c.total)}</span><StatusPill tone={tone(c.status)}>{t(`portal.contract.status.${c.status}`)}</StatusPill></span>
              <div style={{ display: "flex", gap: 8, width: "100%", paddingLeft: 40 }}>
                <DownloadButton token={token} path={portalApi.contractPdfPath(token, c.id)} filename={`${c.contractNumber}.pdf`} />
                {c.canSign && (
                  <button type="button" className="cp-btn cp-btn-sm cp-btn-p cp-press" onClick={() => signLink.mutate(c.id)} disabled={signLink.isPending}>
                    {signLink.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t("portal.contract.sign")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
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
  const tone = (s: string): StatusTone => (s === "paid" ? "ok" : s === "overdue" ? "bad" : s === "pending_confirmation" ? "info" : s === "partially_paid" ? "warn" : "info");
  const real = data.invoices.filter((i) => i.type !== "credit_note" && i.status !== "void");
  const total = real.reduce((s, i) => s + i.totalCents, 0);
  const paidSum = real.reduce((s, i) => s + (i.status === "paid" ? i.totalCents : i.paidCents), 0);
  const open = data.invoices.filter((i) => i.status !== "paid" && i.status !== "void");
  const paid = data.invoices.filter((i) => i.status === "paid");
  const row = (inv: PortalOverviewDto["invoices"][number]) => {
    const credit = inv.type === "credit_note";
    const canAct = !credit && inv.status !== "paid" && inv.status !== "pending_confirmation" && inv.status !== "void" && inv.balanceCents > 0;
    const Row = inv.url ? "a" : "div";
    return (
      <div key={inv.id}>
        <Row {...(inv.url ? { href: inv.url } : {})} className="cp-lrow" style={{ paddingTop: 14, paddingBottom: 14, background: inv.status === "overdue" ? "var(--bad-soft)" : undefined }}>
          <Glyph name="receipt" tone={inv.status === "paid" ? "sage" : "amber"} />
          <span className="cp-lt">
            <b>{credit ? t("invoices.type.credit_note") : inv.title || t("publicInvoice.invoice")}</b>
            <small><span className="cp-mono">{inv.number}</span> · {inv.status === "paid" ? `${t("publicInvoice.paidOn")} ${day(inv.paidAt)}` : `${t("publicInvoice.dueBy")} ${day(inv.dueDate)}`}{inv.paidCents > 0 && inv.status !== "paid" ? ` · ${t("publicInvoice.alreadyPaid")} ${cents(inv.paidCents)}` : ""}</small>
          </span>
          <span className="cp-lr"><span className="cp-num" style={{ fontSize: 14.5, fontWeight: 600 }}>{cents(credit || inv.status === "paid" ? inv.totalCents : inv.balanceCents)}</span><StatusPill tone={tone(inv.status)} shape={inv.status === "overdue" ? "alert" : inv.status === "pending_confirmation" ? "clock" : undefined}>{t(`portal.invoice.status.${inv.status}`)}</StatusPill></span>
        </Row>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 16px 12px 56px" }}>
          <DownloadButton token={token} path={portalApi.invoicePdfPath(token, inv.id)} filename={`${inv.number}.pdf`} />
          {canAct && inv.canPayByCard && (
            <button type="button" className="cp-btn cp-btn-sm cp-btn-p cp-press" onClick={() => pay.mutate(inv.id)} disabled={pay.isPending}>
              {pay.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t("publicInvoice.payByCard")}
            </button>
          )}
          {canAct && inv.etransferEmail && confirming !== inv.id && (
            <button type="button" className="cp-btn cp-btn-sm cp-btn-s cp-press" onClick={() => setConfirming(inv.id)}>{t("publicInvoice.iSentIt")}</button>
          )}
        </div>
        {confirming === inv.id && (
          <div className="cp-rise" style={{ margin: "0 16px 14px", background: "var(--soft)", borderRadius: 18, padding: 14, boxShadow: "0 0 0 1px var(--line)" }}>
            <p style={{ fontSize: 13.5, lineHeight: 1.45, color: "var(--t2)" }}>{t("portal.invoice.etransferTo").replace("{email}", inv.etransferEmail ?? "")} {t("publicInvoice.markSentConfirm")}</p>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button type="button" className="cp-btn cp-btn-md cp-press" onClick={() => setConfirming(null)} style={{ flexGrow: 1, background: "var(--card)", boxShadow: "0 0 0 1px var(--line2)", color: "var(--ink)" }}>{t("jobs.cancel")}</button>
              <button type="button" className="cp-btn cp-btn-md cp-btn-p cp-press" onClick={() => markSent.mutate(inv.id)} disabled={markSent.isPending} style={{ flexGrow: 2 }}>{markSent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t("publicInvoice.confirmSent")}</button>
            </div>
          </div>
        )}
      </div>
    );
  };
  return (
    <section className="cp-rise" style={{ padding: "20px 16px 0" }}>
      {real.length > 0 && (
        <div className="cp-card" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", padding: "14px 4px", marginBottom: 16 }}>
          {[[t("cp.portal.jobTotal"), cents(total)], [t("cp.portal.paidSoFar"), cents(paidSum)], [t("cp.portal.leftToPay"), cents(Math.max(0, total - paidSum))]].map(([label, value], i) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", gap: 3, padding: "0 12px", borderLeft: i ? "1px solid var(--line)" : undefined }}>
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{label}</span>
              <span className="cp-num" style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.03em" }}>{value}</span>
            </div>
          ))}
        </div>
      )}
      <div className="cp-sh"><h2>{t("portal.invoices.open")}</h2></div>
      {open.length === 0 ? <Empty text={t("portal.invoices.emptyOpen")} /> : <div className="cp-card" style={{ overflow: "hidden" }}>{open.map(row)}</div>}
      {paid.length > 0 && (
        <>
          <div className="cp-sh" style={{ marginTop: 24 }}><h2>{t("portal.invoices.paid")}</h2></div>
          <div className="cp-card" style={{ overflow: "hidden" }}>{paid.map(row)}</div>
        </>
      )}
    </section>
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
  const canSend = !!body.trim() && !send.isPending;
  return (
    <section className="cp-rise" style={{ padding: "16px 16px 0" }}>
      <p className="cp-sub" style={{ margin: "0 4px 12px" }}>{t("portal.messages.sub").replace("{company}", data.company.name)}</p>
      {data.messages.length === 0 ? (
        <p className="cp-sub" style={{ margin: "0 4px 12px" }}>{t("portal.messages.empty")}</p>
      ) : (
        <ol aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 10, margin: 0, padding: 0, listStyle: "none" }}>
          {data.messages.map((m: PortalMessageDto) => m.sender === "client" ? (
            <li key={m.id} style={{ alignSelf: "flex-end", maxWidth: "80%", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
              <div style={{ background: "var(--inv)", color: "var(--on-inv)", borderRadius: "18px 18px 6px 18px", padding: "10px 14px", fontSize: 14.5, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{m.body}</div>
              <span className="cp-mono" style={{ fontSize: 11.5, color: "var(--faint)", paddingRight: 4 }}>{when(m.createdAt)}{m.jobName ? ` · ${m.jobName}` : ""}</span>
            </li>
          ) : (
            <li key={m.id} style={{ display: "flex", gap: 8, alignItems: "flex-end", maxWidth: "86%" }}>
              <span className="cp-av" style={{ width: 28, height: 28, fontSize: 10.5, background: "var(--warn-soft)", color: "var(--warn)" }}>{initialsOf(m.senderName || data.company.name)}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                <span style={{ fontSize: 11.5, color: "var(--muted)", paddingLeft: 4 }}>{m.senderName || data.company.name} · <span className="cp-mono">{when(m.createdAt)}</span>{m.jobName ? ` · ${m.jobName}` : ""}</span>
                <div style={{ background: "var(--card)", boxShadow: "0 0 0 1px var(--ring)", borderRadius: "18px 18px 18px 6px", padding: "10px 14px", fontSize: 14.5, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{m.body}</div>
              </div>
            </li>
          ))}
        </ol>
      )}
      {data.jobs.length > 1 && (
        <div className="cp-field" style={{ marginTop: 16 }}>
          <label htmlFor="portal-msg-job">{t("portal.messages.about")}</label>
          <select id="portal-msg-job" value={jobId} onChange={(e) => setJobId(e.target.value)}>
            <option value="">{t("portal.messages.general")}</option>
            {data.jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
        </div>
      )}
      <div style={{ marginTop: 18, display: "flex", gap: 8, alignItems: "center", padding: "6px 6px 6px 16px", borderRadius: 26, background: "var(--card)", boxShadow: "0 0 0 1px var(--line2)" }}>
        <label htmlFor="portal-msg-body" className="cp-vh">{t("portal.messages.compose")}</label>
        <input
          id="portal-msg-body"
          enterKeyHint="send"
          autoCapitalize="sentences"
          value={body}
          maxLength={4000}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && canSend) send.mutate(); }}
          placeholder={t("portal.messages.placeholder")}
          style={{ flexGrow: 1, minWidth: 0, border: 0, outline: "none", background: "transparent", fontSize: 16, height: 40, color: "var(--ink)" }}
        />
        <button type="button" className="cp-press portal-send" onClick={() => send.mutate()} disabled={!canSend} aria-label={t("portal.messages.send")} style={{ width: 40, height: 40, borderRadius: "50%", border: 0, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: canSend ? "var(--inv)" : "var(--sunk)", color: canSend ? "var(--on-inv)" : "var(--faint)" }}>
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send width={17} height={17} aria-hidden="true" />}
        </button>
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
    <button type="button" className="cp-btn cp-btn-sm cp-btn-s cp-press" onClick={download} disabled={busy} aria-label={t("publicInvoice.downloadPdf")}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download width={14} height={14} aria-hidden="true" />} PDF
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
    <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {src ? <img src={src} alt={alt} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : failed ? <Camera className="h-6 w-6" style={{ color: "var(--faint)" }} aria-hidden="true" /> : <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--faint)" }} aria-hidden="true" />}
    </span>
  );
}
