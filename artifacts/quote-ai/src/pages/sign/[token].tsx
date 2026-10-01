import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { signApi } from "@/lib/contracts-api";
import { SignaturePad, type SignatureValue } from "@/components/signature-pad";
import { ClientHeader, Glyph, StatusPill, initialsOf, useClientTheme, money } from "@/components/client/kit";

type Step = "review" | "otp" | "sign" | "done" | "declined";

/**
 * Public signing page. No login: the token in the URL identifies the signer.
 * Flow: read the contract, get a code by email, verify it, draw or type a signature
 * with consent, done (signed copy emailed, PDF downloadable here too).
 *
 * Pocket 125.10: built from the ClientSign board: three numbered cards on the page
 * (review, verify, sign) instead of sheets, a progress strip, and the board's done screen.
 */
export default function SignPage() {
  const { token } = useParams<{ token: string }>();
  const { t, lang, setLang } = useLanguage();
  useClientTheme();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["sign", token], queryFn: () => signApi.get(token!), enabled: !!token, retry: false });

  const [step, setStep] = useState<Step>("review");
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [signature, setSignature] = useState<SignatureValue>(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [folded, setFolded] = useState(true);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);

  useDocumentTitle(data ? `${data.contract.title} · ${data.contract.companyName}` : null);
  // The page follows the contract's language, not the visitor's stored preference.
  useEffect(() => {
    if (data?.contract.language) setLang(data.contract.language);
  }, [data?.contract.language, setLang]);

  useEffect(() => {
    if (!data) return;
    setName(data.signer.name || data.contract.customerName);
    if (data.contract.status === "signed" || data.signer.status === "signed") setStep("done");
    else if (data.signer.status === "declined") setStep("declined");
    else if (data.signer.otpVerified) setStep("sign");
  }, [data]);

  // Track that the customer scrolled through the document before signing.
  useEffect(() => {
    const onScroll = () => {
      const el = docRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (!folded && rect.bottom - window.innerHeight < 120) setScrolledToEnd(true);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [data, folded]);

  const requestOtp = async () => {
    setOtpSending(true);
    setOtpError(null);
    try {
      await signApi.otp(token!);
      setOtpSent(true);
      setStep("otp");
    } catch (e) {
      setOtpError(e instanceof Error ? e.message : t("sign.otpError"));
    } finally {
      setOtpSending(false);
    }
  };

  const verify = async () => {
    setVerifying(true);
    setOtpError(null);
    try {
      await signApi.verify(token!, code.trim());
      setStep("sign");
    } catch (e) {
      const err = e as Error & { code?: string };
      setOtpError(err.code === "invalid_code" ? t("sign.invalidCode") : err.code === "code_expired" ? t("sign.codeExpired") : err.code === "too_many_attempts" ? t("sign.tooManyAttempts") : err.message);
    } finally {
      setVerifying(false);
    }
  };

  const complete = async () => {
    if (!signature) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await signApi.complete(token!, { name: name.trim(), signatureType: signature.type, signatureData: signature.data, consent: true });
      await refetch();
      setStep("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      const err = e as Error & { code?: string };
      setSubmitError(err.code === "verify_first" ? t("sign.verifyFirst") : err.message);
      if (err.code === "verify_first") setStep("review");
    } finally {
      setSubmitting(false);
    }
  };

  const decline = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await signApi.decline(token!, declineReason.trim());
      setStep("declined");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="cp-page" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--muted)" }} />
      </div>
    );
  }

  if (error || !data) {
    const errCode = (error as Error & { code?: string } | null)?.code;
    return (
      <div className="cp-page" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 24px" }}>
        <AlertTriangle className="h-10 w-10 mb-4" style={{ color: "var(--warn)" }} />
        <h1 style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.03em" }}>{errCode === "expired" ? t("sign.expiredTitle") : errCode === "closed" ? t("sign.closedTitle") : t("sign.notFoundTitle")}</h1>
        <p className="cp-sub" style={{ marginTop: 6, maxWidth: 320 }}>{errCode === "expired" ? t("sign.expiredDesc") : errCode === "closed" ? t("sign.closedDesc") : t("sign.notFoundDesc")}</p>
      </div>
    );
  }

  const { contract, signer } = data;
  const total = money(contract.total, lang);
  const open = step === "review" || step === "otp" || step === "sign";
  const verified = step === "sign";
  const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat(lang === "fr" ? "fr-CA" : "en-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "");

  // The progress strip: Review, Verify, Sign.
  const current = verified ? 2 : otpSent || !folded ? 1 : 0;
  const stepLabels = [t("cp.sign.stepReview"), t("cp.sign.stepVerify"), t("cp.sign.stepSign")];

  const need = !verified ? t("cp.sign.needVerify") : !signature || name.trim().length < 2 ? t("cp.sign.needSignature") : !consent ? t("cp.sign.needConsent") : null;
  const canSign = verified && !!signature && name.trim().length >= 2 && consent && !submitting;

  const header = <ClientHeader company={contract.companyName} from={t("sign.from")} />;

  if (step === "done" || step === "declined") {
    const isDone = step === "done";
    const fullySigned = contract.status === "signed";
    return (
      <main id="main" className="cp-page">
        <div className="cp-col cp-pad">
          {header}
          <section className="cp-rise" style={{ padding: "44px 20px 0", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <span style={{ width: 84, height: 84, borderRadius: "50%", background: isDone ? "var(--ok-soft)" : "var(--sunk)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Glyph name={isDone ? "check" : "warn"} tone={isDone ? "sage" : "slate"} size={44} />
            </span>
            <h1 className="cp-h1" style={{ marginTop: 20 }}>{isDone ? (fullySigned ? t("sign.doneTitle") : t("sign.doneWaitingTitle")) : t("sign.declinedTitle")}</h1>
            <p style={{ marginTop: 8, fontSize: 14.5, lineHeight: 1.5, color: "var(--muted)", maxWidth: 300 }}>
              {isDone ? (fullySigned ? t("sign.doneDesc") : t("sign.doneWaitingDesc")) : t("sign.declinedDesc").replace("{company}", contract.companyName)}
            </p>
          </section>
          {isDone && (
            <section className="cp-rise" style={{ padding: "26px 16px 0", animationDelay: "80ms" }}>
              <div className="cp-card" style={{ overflow: "hidden" }}>
                <div className="cp-lrow">
                  <span className="cp-lt"><small>{t("cp.sign.contract")}</small><b className="cp-mono" style={{ fontSize: 14.5 }}>{contract.contractNumber}</b></span>
                  <span className="cp-lr"><span className="cp-num" style={{ fontSize: 16, fontWeight: 600 }}>{total}</span><span style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("cp.sign.taxIncl")}</span></span>
                </div>
                <div className="cp-lrow">
                  <span className="cp-av" style={{ width: 34, height: 34, fontSize: 11.5, background: "var(--ok-soft)", color: "var(--ok)" }}>{initialsOf(contract.customerName)}</span>
                  <span className="cp-lt">
                    <b>{contract.customerName}</b>
                    <small style={{ whiteSpace: "normal", lineHeight: 1.35 }}>{when(signer.signedAt || contract.signedAt)}{(signer.signedAt || contract.signedAt) ? " · " : ""}{t("cp.sign.emailVerified")}</small>
                  </span>
                  <StatusPill tone="ok">{t("cp.sign.signed")}</StatusPill>
                </div>
                <div className="cp-lrow">
                  <span className="cp-av" style={{ width: 34, height: 34, fontSize: 11.5, background: "var(--warn-soft)", color: "var(--warn)" }}>{initialsOf(contract.companyName)}</span>
                  <span className="cp-lt">
                    <b>{contract.companyName}</b>
                    {contract.contractorSignedAt && <small>{when(contract.contractorSignedAt)}</small>}
                  </span>
                  {contract.contractorSignedAt ? <StatusPill tone="ok">{t("cp.sign.signed")}</StatusPill> : <StatusPill tone="mute" shape="clock">{t("cp.sign.waiting")}</StatusPill>}
                </div>
              </div>
            </section>
          )}
          <section className="cp-rise" style={{ padding: "20px 16px 0", animationDelay: "140ms", display: "flex", flexDirection: "column", gap: 10 }}>
            {isDone && (
              <a href={signApi.pdfUrl(token!)} className="cp-btn cp-btn-p cp-press">
                <Download width={18} height={18} aria-hidden="true" />{t("sign.downloadCopy")}
              </a>
            )}
            {contract.portalUrl && <a href={contract.portalUrl} className="cp-btn cp-btn-s cp-press">{t("cp.sign.portal")}</a>}
          </section>
        </div>
      </main>
    );
  }

  const boxes = [0, 1, 2, 3, 4, 5].map((i) => {
    const active = !verified && i === code.length;
    const style = verified ? { background: "var(--ok-soft)", color: "var(--ok)", boxShadow: "none" }
      : otpError ? { background: "var(--card)", boxShadow: "0 0 0 1.5px var(--bad)" }
      : active ? { background: "var(--card)", boxShadow: "0 0 0 2px var(--acc)" }
      : { background: "var(--card)", boxShadow: "0 0 0 1px var(--line2)" };
    return <span key={i} className="cp-num" style={{ height: 54, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 600, transition: "box-shadow .25s, background-color .25s", ...style }}>{code[i] ?? ""}</span>;
  });

  return (
    <main id="main" className="cp-page">
      <div className="cp-col cp-pad">
        {header}

        <section className="cp-rise" style={{ padding: "22px 20px 0", animationDelay: "40ms" }}>
          <span className="cp-mono" style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("cp.sign.contract")} {contract.contractNumber}</span>
          <h1 className="cp-h1" style={{ marginTop: 8 }}>{contract.title}</h1>
          <p className="cp-sub" style={{ marginTop: 8 }}>{contract.customerName}</p>
        </section>

        <section className="cp-rise" style={{ padding: "20px 16px 0", animationDelay: "70ms" }} aria-label={t("cp.sign.progress")}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
            {stepLabels.map((label, i) => {
              const done = i < current;
              const cur = i === current;
              return (
                <div key={label} style={{ display: "flex", flexDirection: "column", gap: 8 }} aria-current={cur ? "step" : undefined}>
                  <span style={{ display: "block", height: 4, borderRadius: 4, transition: "background-color .5s", background: done ? "var(--ok-dot)" : cur ? "var(--inv)" : "var(--sunk)" }} />
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 500, color: done ? "var(--ok)" : cur ? "var(--ink)" : "var(--faint)" }}>
                    <span className="cp-num" style={{ width: 18, height: 18, borderRadius: "50%", fontSize: 10.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: done ? "var(--ok-soft)" : cur ? "var(--inv)" : "var(--sunk)", color: done ? "var(--ok)" : cur ? "var(--on-inv)" : "var(--faint)" }}>{done ? "✓" : i + 1}</span>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* 1. Review */}
        <section className="cp-rise" style={{ padding: "24px 16px 0", animationDelay: "100ms" }}>
          <div className="cp-sh">
            <h2>{t("cp.sign.s1")}</h2>
            {!folded && scrolledToEnd && <StatusPill tone="ok">{t("cp.sign.read")}</StatusPill>}
          </div>
          <div className="cp-card" style={{ overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", borderBottom: "1px solid var(--line)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "13px 16px" }}>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("cp.sign.totalTax")}</span>
                <span className="cp-num" style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em" }}>{total}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "13px 16px", borderLeft: "1px solid var(--line)" }}>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("cp.sign.contract")}</span>
                <span className="cp-num" style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em" }}>{contract.contractNumber}</span>
              </div>
            </div>
            <div ref={docRef} className="cp-fold" data-folded={folded ? "true" : "false"}>
              <style dangerouslySetInnerHTML={{ __html: data.css }} />
              <div className="cp-paper k-doc-public" dangerouslySetInnerHTML={{ __html: data.html }} />
              {folded && <div className="cp-fold-fade" aria-hidden="true" />}
            </div>
            <div style={{ padding: "12px 16px 16px" }}>
              <button type="button" className="cp-btn cp-btn-md cp-btn-s cp-btn-w cp-press" onClick={() => setFolded((f) => !f)} aria-expanded={!folded}>
                {folded ? t("cp.sign.more") : t("cp.sign.less")}
                <ChevronDown width={14} height={14} aria-hidden="true" style={{ transition: "transform .35s", transform: folded ? "none" : "rotate(180deg)" }} />
              </button>
            </div>
          </div>
        </section>

        {/* 2. Verify */}
        <section className="cp-rise" style={{ padding: "24px 16px 0", animationDelay: "130ms" }}>
          <div className="cp-sh">
            <h2>{t("cp.sign.s2")}</h2>
            {verified && <StatusPill tone="ok">{t("cp.sign.verified")}</StatusPill>}
          </div>
          <div className="cp-card" style={{ padding: 18 }}>
            {!otpSent && !verified ? (
              <>
                <p style={{ fontSize: 14.5, lineHeight: 1.5, color: "var(--t2)" }}>
                  {t("cp.sign.sendCodeDesc")} <b style={{ color: "var(--ink)", fontWeight: 600 }}>{signer.emailMasked}</b>
                </p>
                {otpError && <p className="cp-err" role="alert" style={{ margin: "10px 2px 0" }}>{otpError}</p>}
                <button type="button" onClick={requestOtp} disabled={otpSending} data-primary-action className="cp-btn cp-btn-md cp-btn-p cp-btn-w cp-press" style={{ marginTop: 14 }}>
                  {otpSending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t("cp.sign.sendCode")}
                </button>
              </>
            ) : verified ? (
              <p style={{ fontSize: 14.5, lineHeight: 1.5, color: "var(--t2)" }}>{t("sign.verifiedHint")}</p>
            ) : (
              <>
                <p style={{ fontSize: 14.5, lineHeight: 1.5, color: "var(--t2)" }}>
                  {t("cp.sign.codeSent")} <b style={{ color: "var(--ink)", fontWeight: 600 }}>{signer.emailMasked}</b>
                </p>
                <div style={{ position: "relative", marginTop: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8 }} aria-hidden="true">{boxes}</div>
                  <label htmlFor="code-in" className="cp-vh">{t("a11y.otpCode")}</label>
                  <input
                    id="code-in"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    enterKeyHint="go"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => { if (e.key === "Enter" && code.length === 6) void verify(); }}
                    aria-invalid={otpError ? true : undefined}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, border: 0, fontSize: 16 }}
                  />
                </div>
                {otpError && <p className="cp-err" role="alert" style={{ margin: "10px 2px 0" }}>{otpError}</p>}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 14 }}>
                  <button type="button" onClick={requestOtp} disabled={otpSending} className="cp-press" style={{ height: 44, padding: "0 2px", border: 0, background: "transparent", color: "var(--muted)", fontSize: 13.5 }}>{t("sign.resendCode")}</button>
                  <button type="button" onClick={verify} disabled={code.length !== 6 || verifying} data-verify data-primary-action className="cp-btn cp-btn-md cp-btn-s cp-press" style={{ padding: "0 18px" }}>
                    {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t("sign.verify")}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        {/* 3. Sign */}
        <section className="cp-rise" style={{ padding: "24px 16px 0", animationDelay: "160ms" }}>
          <div className="cp-sh"><h2>{t("cp.sign.s3")}</h2></div>
          <div className="cp-card" style={{ padding: 16, opacity: verified ? 1 : 0.55 }} aria-disabled={!verified}>
            <fieldset disabled={!verified} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
              <div className="cp-field">
                <label htmlFor="sign-full-name">{t("sign.fullName")}</label>
                <input id="sign-full-name" autoComplete="name" autoCapitalize="words" enterKeyHint="next" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="cp-sigwrap" style={{ marginTop: 12 }}>
                <SignaturePad value={signature} onChange={setSignature} defaultName={name} />
              </div>
              <button type="button" role="checkbox" aria-checked={consent} onClick={() => setConsent((c) => !c)} id="consent" className="cp-press" style={{ width: "100%", marginTop: 12, border: 0, background: "transparent", padding: "10px 0", display: "flex", gap: 12, alignItems: "flex-start", textAlign: "left" }}>
                <span style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "background-color .25s, box-shadow .25s", background: consent ? "var(--inv)" : "transparent", boxShadow: consent ? "none" : "inset 0 0 0 1.6px var(--line2)" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: "var(--on-inv)", opacity: consent ? 1 : 0, transition: "opacity .2s" }}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                </span>
                <span style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--t2)" }}>{t("sign.consent")}</span>
              </button>
              {submitError && <p className="cp-err" role="alert" style={{ margin: "6px 2px 0" }}>{submitError}</p>}
              <button type="button" onClick={complete} disabled={!canSign} data-primary-action={verified ? "" : undefined} className="cp-btn cp-btn-lg cp-btn-p cp-btn-w cp-press" style={{ marginTop: 12 }}>
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null}{t("sign.signButton")} · <span className="cp-num">{total}</span>
              </button>
              <p style={{ margin: "10px 0 0", textAlign: "center", fontSize: 12.5, color: "var(--faint)" }}>{need ?? t("cp.sign.ready")}</p>
            </fieldset>
          </div>
        </section>

        <section className="cp-rise" style={{ padding: "18px 16px 0", animationDelay: "190ms" }}>
          {!declining ? (
            <button type="button" className="cp-press" onClick={() => { setSubmitError(null); setDeclining(true); }} style={{ width: "100%", height: 44, border: 0, background: "transparent", color: "var(--muted)", fontSize: 13.5 }}>{t("sign.declineTitle")}</button>
          ) : (
            <div className="cp-card cp-rise" style={{ padding: 16 }}>
              <div className="cp-field">
                <label htmlFor="sign-decline-reason">{t("sign.declineReason")}</label>
                <textarea id="sign-decline-reason" rows={3} value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder={t("sign.declinePlaceholder")} />
              </div>
              {submitError && <p className="cp-err" role="alert" style={{ margin: "8px 2px 0" }}>{submitError}</p>}
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button type="button" className="cp-btn cp-btn-md cp-btn-s cp-press" style={{ flexGrow: 1 }} onClick={() => setDeclining(false)}>{t("sign.cancel")}</button>
                <button type="button" className="cp-btn cp-btn-md cp-btn-d cp-press" style={{ flexGrow: 1 }} onClick={decline} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t("sign.declineConfirm")}
                </button>
              </div>
            </div>
          )}
        </section>

        {contract.portalUrl && (
          <section style={{ padding: "12px 16px 0" }}>
            <a href={contract.portalUrl} className="cp-card cp-lrow cp-press" style={{ textDecoration: "none" }}>
              <Glyph name="doc" tone="indigo" />
              <span className="cp-lt">
                <b>{t("portalLink.title").replace("{company}", contract.companyName)}</b>
                <small>{t("portalLink.desc")}</small>
              </span>
              <span className="cp-vh">{t("portalLink.open")}</span>
              <ChevronRight width={18} height={18} aria-hidden="true" style={{ color: "var(--faint)", flexShrink: 0 }} />
            </a>
          </section>
        )}

        <p style={{ margin: "18px 16px 0", textAlign: "center", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>
          {t("sign.questions")} {contract.companyEmail && <a href={`mailto:${contract.companyEmail}`} style={{ color: "var(--ink)", fontWeight: 500 }}>{contract.companyEmail}</a>}{contract.companyPhone && <> · <span className="cp-num">{contract.companyPhone}</span></>}
        </p>
      </div>
    </main>
  );
}
