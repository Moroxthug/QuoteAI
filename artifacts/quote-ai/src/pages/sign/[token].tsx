import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { FileSignature, ShieldCheck, Download, CheckCircle2, Loader2, AlertTriangle, XCircle, ChevronDown, LayoutDashboard } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { signApi } from "@/lib/contracts-api";
import { SignaturePad, type SignatureValue } from "@/components/signature-pad";
import { Logo } from "@/components/logo";
import { StickyActionBar } from "@/components/mobile/sticky-action-bar";
import { BottomSheet } from "@/components/mobile/bottom-sheet";

type Step = "review" | "otp" | "sign" | "done" | "declined";
type Sheet = "otp" | "sign" | "decline" | null;

/**
 * Public signing page. No login: the token in the URL identifies the signer.
 * Flow: read the contract → request a code → verify → draw/type signature
 * with consent → done (signed copy emailed, PDF downloadable here too).
 *
 * Phase 111: the contract is the page; the one action (Review & sign, then
 * Continue / Sign) is docked within thumb reach, and each step — the code,
 * the signature, declining — opens as a sheet over the contract instead of a
 * form appended below thirty screens of it. Drawing in a sheet also keeps the
 * page from scrolling under the finger.
 */
export default function SignPage() {
  const { token } = useParams<{ token: string }>();
  const { t, setLang } = useLanguage();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["sign", token], queryFn: () => signApi.get(token!), enabled: !!token, retry: false });

  const [step, setStep] = useState<Step>("review");
  const [sheet, setSheet] = useState<Sheet>(null);
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
  const [declineReason, setDeclineReason] = useState("");
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
      if (rect.bottom - window.innerHeight < 120) setScrolledToEnd(true);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [data]);

  const requestOtp = async () => {
    setOtpSending(true);
    setOtpError(null);
    try {
      await signApi.otp(token!);
      setOtpSent(true);
      setStep("otp");
      setSheet("otp");
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
      setSheet("sign");
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
      setSheet(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      const err = e as Error & { code?: string };
      setSubmitError(err.code === "verify_first" ? t("sign.verifyFirst") : err.message);
      if (err.code === "verify_first") { setStep("review"); setSheet(null); }
    } finally {
      setSubmitting(false);
    }
  };

  const decline = async () => {
    setSubmitting(true);
    try {
      await signApi.decline(token!, declineReason.trim());
      setStep("declined");
      setSheet(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  /** The docked primary: ask for a code, go back to the code, or sign. */
  const primary = () => {
    if (step === "sign") setSheet("sign");
    else if (step === "otp" && otpSent) setSheet("otp");
    else void requestOtp();
  };

  if (isLoading) {
    return (
      <div className="doc-shell flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--navy)" }} />
      </div>
    );
  }

  if (error || !data) {
    const code = (error as Error & { code?: string } | null)?.code;
    return (
      <div className="doc-shell flex items-center justify-center p-6">
        <div className="card max-w-md w-full p-8 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
          <AlertTriangle className="h-10 w-10 mx-auto mb-4" style={{ color: "var(--yellow-dark)" }} />
          <h1 className="text-lg font-semibold" style={{ color: "var(--navy)" }}>{code === "expired" ? t("sign.expiredTitle") : code === "closed" ? t("sign.closedTitle") : t("sign.notFoundTitle")}</h1>
          <p className="text-sm mt-2" style={{ color: "var(--muted-mk)" }}>{code === "expired" ? t("sign.expiredDesc") : code === "closed" ? t("sign.closedDesc") : t("sign.notFoundDesc")}</p>
        </div>
      </div>
    );
  }

  const { contract, signer } = data;
  const formatCad = (n: number) => new Intl.NumberFormat(contract.language === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" }).format(n);
  const open = step === "review" || step === "otp" || step === "sign";

  return (
    <div className="doc-shell pb-16 doc-docked sign-page">
      {/* Top bar */}
      <header className="doc-head">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs truncate" style={{ color: "var(--muted-mk)" }}>{t("sign.from")} <strong style={{ color: "var(--ink)" }}>{contract.companyName}</strong></div>
            <div className="text-sm font-semibold truncate" style={{ color: "var(--navy)" }}>{contract.title} · {contract.contractNumber}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-bold hidden sm:block" style={{ color: "var(--navy)" }}>{formatCad(contract.total)}</span>
            <Logo className="h-6" />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {step === "done" && (
          <div className="doc-banner ok p-6">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--green-dark)" }} />
            <h1 className="text-lg font-bold">{contract.status === "signed" ? t("sign.doneTitle") : t("sign.doneWaitingTitle")}</h1>
            <p className="text-sm mt-1">{contract.status === "signed" ? t("sign.doneDesc") : t("sign.doneWaitingDesc")}</p>
            <a href={signApi.pdfUrl(token!)} className="inline-flex items-center gap-2 mt-4 text-sm font-medium underline">
              <Download className="h-4 w-4" /> {t("sign.downloadCopy")}
            </a>
          </div>
        )}
        {step === "declined" && (
          <div className="doc-banner info p-6">
            <XCircle className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--faint)" }} />
            <h1 className="text-lg font-bold">{t("sign.declinedTitle")}</h1>
            <p className="text-sm mt-1">{t("sign.declinedDesc").replace("{company}", contract.companyName)}</p>
          </div>
        )}

        {open && (
          <div className="rounded-2xl p-4 flex items-start gap-3" style={{ border: "1px solid var(--line)", background: "var(--soft)" }}>
            <ShieldCheck className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "var(--navy)" }} />
            <div className="text-sm" style={{ color: "var(--navy)" }}>
              <div className="font-semibold">{t("sign.introTitle").replace("{name}", contract.customerName)}</div>
              <div className="mt-0.5" style={{ color: "var(--muted-mk)" }}>{step === "sign" ? t("sign.verifiedHint") : t("sign.introDesc")}</div>
            </div>
          </div>
        )}

        {/* Document */}
        <div ref={docRef} className="card p-4 sm:p-10 k-doc-public" style={{ boxShadow: "var(--shadow-card)" }}>
          <style dangerouslySetInnerHTML={{ __html: data.css }} />
          <div dangerouslySetInnerHTML={{ __html: data.html }} />
        </div>

        {contract.portalUrl && (
          <a href={contract.portalUrl} className="card p-4 flex items-center gap-3 text-sm no-underline" style={{ boxShadow: "var(--shadow-card)" }}>
            <LayoutDashboard className="h-5 w-5 shrink-0" style={{ color: "var(--navy)" }} />
            <span className="grow" style={{ color: "var(--ink)" }}><b style={{ color: "var(--navy)" }}>{t("portalLink.title").replace("{company}", contract.companyName)}</b><span className="block text-xs" style={{ color: "var(--muted-mk)" }}>{t("portalLink.desc")}</span></span>
            <span className="btn btn-sm btn-outline-navy">{t("portalLink.open")}</span>
          </a>
        )}

        {open && (
          <p className="text-center text-xs" style={{ color: "var(--faint)" }}>
            {t("sign.questions")} {contract.companyEmail && <a className="underline" href={`mailto:${contract.companyEmail}`}>{contract.companyEmail}</a>}{contract.companyPhone && <> · {contract.companyPhone}</>}
          </p>
        )}

        {/* The one action, docked on a phone and pinned to the bottom of the window on a computer. */}
        {open && (
          <div className="sign-dock">
            <StickyActionBar label={t("sign.signTitle")}>
              <span className="sign-dock-hint hide-phone">
                {scrolledToEnd ? t("sign.readyHint") : <><ChevronDown className="h-3.5 w-3.5" /> {t("sign.scrollHint")}</>}
              </span>
              <button type="button" className="btn btn-outline-navy secondary" onClick={() => { setSubmitError(null); setSheet("decline"); }}>{t("sign.decline")}</button>
              <button type="button" onClick={primary} disabled={otpSending} className="btn btn-navy" data-primary-action>
                {otpSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileSignature className="h-5 w-5" />} {step === "sign" ? t("sign.signButton") : otpSent ? t("sign.continue") : t("sign.reviewAndSign")}
              </button>
            </StickyActionBar>
            {otpError && sheet === null && <p className="sign-dock-error" role="alert">{otpError}</p>}
          </div>
        )}
      </main>

      {/* Step 1: the emailed code */}
      <BottomSheet
        open={sheet === "otp"}
        onOpenChange={(o) => setSheet(o ? "otp" : null)}
        title={t("sign.otpTitle")}
        description={t("sign.otpDesc").replace("{email}", signer.emailMasked)}
        size="sm"
        footer={
          <>
            <button type="button" onClick={requestOtp} disabled={otpSending} className="btn btn-outline-navy secondary">{otpSending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t("sign.resendCode")}</button>
            <button type="button" onClick={verify} disabled={code.length !== 6 || verifying} className="btn btn-navy" data-verify>
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t("sign.verify")}
            </button>
          </>
        }
      >
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          enterKeyHint="go"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => { if (e.key === "Enter" && code.length === 6) void verify(); }}
          placeholder="000000"
          aria-label={t("a11y.otpCode")}
          aria-invalid={otpError ? true : undefined}
          className="otp-input"
          autoFocus
        />
        {otpError && <p className="text-sm m-0" role="alert" style={{ color: "var(--red)" }}>{otpError}</p>}
      </BottomSheet>

      {/* Step 2: the signature */}
      <BottomSheet
        open={sheet === "sign"}
        onOpenChange={(o) => { if (!submitting) setSheet(o ? "sign" : null); }}
        title={t("sign.signTitle")}
        description={t("sign.signDesc")}
        noAutoFocus
        footer={
          <button type="button" onClick={complete} disabled={!signature || !consent || name.trim().length < 2 || submitting} className="btn btn-navy w-full">
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileSignature className="h-5 w-5" />} {t("sign.signButton")} · {formatCad(contract.total)}
          </button>
        }
      >
        <div className="field">
          <label htmlFor="sign-full-name">{t("sign.fullName")}</label>
          <input id="sign-full-name" autoComplete="name" autoCapitalize="words" enterKeyHint="next" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <SignaturePad value={signature} onChange={setSignature} defaultName={name} />
        <label className="flex items-start gap-3 rounded-lg p-3 text-sm cursor-pointer" style={{ border: "1px solid var(--line)", color: "var(--ink)" }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" />
          <span>{t("sign.consent")}</span>
        </label>
        {submitError && <p className="text-sm m-0" role="alert" style={{ color: "var(--red)" }}>{submitError}</p>}
      </BottomSheet>

      {/* Declining */}
      <BottomSheet
        open={sheet === "decline"}
        onOpenChange={(o) => setSheet(o ? "decline" : null)}
        title={t("sign.declineTitle")}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-outline-navy secondary" onClick={() => setSheet(null)}>{t("sign.cancel")}</button>
            <button type="button" className="btn" style={{ background: "var(--red)", color: "#fff" }} onClick={decline} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t("sign.declineConfirm")}</button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="sign-decline-reason">{t("sign.declineReason")}</label>
          <Textarea id="sign-decline-reason" value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} rows={3} placeholder={t("sign.declinePlaceholder")} />
        </div>
        {submitError && <p className="text-sm m-0" role="alert" style={{ color: "var(--red)" }}>{submitError}</p>}
      </BottomSheet>
    </div>
  );
}
