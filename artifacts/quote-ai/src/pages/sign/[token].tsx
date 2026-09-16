import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { FileSignature, ShieldCheck, Download, CheckCircle2, Loader2, AlertTriangle, Mail, XCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { signApi } from "@/lib/contracts-api";
import { SignaturePad, type SignatureValue } from "@/components/signature-pad";
import { Logo } from "@/components/logo";

type Step = "review" | "otp" | "sign" | "done" | "declined";

/**
 * Public signing page. No login: the token in the URL identifies the signer.
 * Flow: read the contract → request a code → verify → draw/type signature
 * with consent → done (signed copy emailed, PDF downloadable here too).
 */
export default function SignPage() {
  const { token } = useParams<{ token: string }>();
  const { t, setLang } = useLanguage();
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
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);

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
    try {
      await signApi.decline(token!, declineReason.trim());
      setStep("declined");
      setDeclineOpen(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-navy-600" />
      </div>
    );
  }

  if (error || !data) {
    const code = (error as Error & { code?: string } | null)?.code;
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl bg-white border border-slate-200 p-8 text-center shadow-sm">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-slate-900">{code === "expired" ? t("sign.expiredTitle") : code === "closed" ? t("sign.closedTitle") : t("sign.notFoundTitle")}</h1>
          <p className="text-sm text-slate-500 mt-2">{code === "expired" ? t("sign.expiredDesc") : code === "closed" ? t("sign.closedDesc") : t("sign.notFoundDesc")}</p>
        </div>
      </div>
    );
  }

  const { contract, signer } = data;
  const formatCad = (n: number) => new Intl.NumberFormat(contract.language === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" }).format(n);

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-slate-500 truncate">{t("sign.from")} <strong className="text-slate-800">{contract.companyName}</strong></div>
            <div className="text-sm font-semibold text-slate-900 truncate">{contract.title} · {contract.contractNumber}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-bold text-slate-900 hidden sm:block">{formatCad(contract.total)}</span>
            <Logo className="h-6" />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {step === "done" && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto mb-3" />
            <h1 className="text-lg font-bold text-emerald-900">{contract.status === "signed" ? t("sign.doneTitle") : t("sign.doneWaitingTitle")}</h1>
            <p className="text-sm text-emerald-800 mt-1">{contract.status === "signed" ? t("sign.doneDesc") : t("sign.doneWaitingDesc")}</p>
            <a href={signApi.pdfUrl(token!)} className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-emerald-800 underline">
              <Download className="h-4 w-4" /> {t("sign.downloadCopy")}
            </a>
          </div>
        )}
        {step === "declined" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <XCircle className="h-10 w-10 text-slate-400 mx-auto mb-3" />
            <h1 className="text-lg font-bold text-slate-900">{t("sign.declinedTitle")}</h1>
            <p className="text-sm text-slate-500 mt-1">{t("sign.declinedDesc").replace("{company}", contract.companyName)}</p>
          </div>
        )}

        {step === "review" && (
          <div className="rounded-2xl border border-navy-200 bg-navy-50 p-4 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-navy-600 mt-0.5 shrink-0" />
            <div className="text-sm text-navy-900">
              <div className="font-semibold">{t("sign.introTitle").replace("{name}", contract.customerName)}</div>
              <div className="text-navy-800/80 mt-0.5">{t("sign.introDesc")}</div>
            </div>
          </div>
        )}

        {/* Document */}
        <div ref={docRef} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-10 shadow-sm">
          <style dangerouslySetInnerHTML={{ __html: data.css }} />
          <div dangerouslySetInnerHTML={{ __html: data.html }} />
        </div>

        {/* Signing panel */}
        {(step === "otp" || step === "sign") && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4" id="sign-panel">
            {step === "otp" ? (
              <>
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-navy-600 mt-0.5" />
                  <div>
                    <h2 className="font-semibold text-slate-900">{t("sign.otpTitle")}</h2>
                    <p className="text-sm text-slate-500">{t("sign.otpDesc").replace("{email}", signer.emailMasked)}</p>
                  </div>
                </div>
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="text-center text-2xl tracking-[0.5em] font-bold h-14"
                />
                {otpError && <p className="text-sm text-red-600">{otpError}</p>}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button onClick={verify} disabled={code.length !== 6 || verifying} className="flex-1 h-11">
                    {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : t("sign.verify")}
                  </Button>
                  <Button variant="ghost" onClick={requestOtp} disabled={otpSending} className="h-11">{t("sign.resendCode")}</Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <FileSignature className="h-5 w-5 text-navy-600 mt-0.5" />
                  <div>
                    <h2 className="font-semibold text-slate-900">{t("sign.signTitle")}</h2>
                    <p className="text-sm text-slate-500">{t("sign.signDesc")}</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("sign.fullName")}</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
                </div>
                <SignaturePad value={signature} onChange={setSignature} defaultName={name} />
                <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4" />
                  <span>{t("sign.consent")}</span>
                </label>
                {submitError && <p className="text-sm text-red-600">{submitError}</p>}
                <Button onClick={complete} disabled={!signature || !consent || name.trim().length < 2 || submitting} className="w-full h-12 text-base gap-2">
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileSignature className="h-5 w-5" />} {t("sign.signButton")}
                </Button>
              </>
            )}
          </div>
        )}

        {declineOpen && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="font-semibold text-slate-900">{t("sign.declineTitle")}</h2>
            <Textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} rows={3} placeholder={t("sign.declinePlaceholder")} />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setDeclineOpen(false)}>{t("sign.cancel")}</Button>
              <Button variant="destructive" onClick={decline} disabled={submitting}>{t("sign.declineConfirm")}</Button>
            </div>
          </div>
        )}

        {(step === "review" || step === "otp" || step === "sign") && (
          <p className="text-center text-xs text-slate-400">
            {t("sign.questions")} {contract.companyEmail && <a className="underline" href={`mailto:${contract.companyEmail}`}>{contract.companyEmail}</a>}{contract.companyPhone && <> · {contract.companyPhone}</>}
          </p>
        )}
      </main>

      {/* Sticky action bar */}
      {step === "review" && (
        <div className="fixed bottom-0 inset-x-0 z-20 bg-white/95 backdrop-blur border-t border-slate-200 p-3 sm:p-4">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="flex-1 text-xs text-slate-500 hidden sm:block">
              {scrolledToEnd ? t("sign.readyHint") : <span className="inline-flex items-center gap-1"><ChevronDown className="h-3.5 w-3.5" /> {t("sign.scrollHint")}</span>}
            </div>
            <Button variant="ghost" className="text-slate-500" onClick={() => setDeclineOpen(true)}>{t("sign.decline")}</Button>
            <Button onClick={requestOtp} disabled={otpSending} className={cn("h-12 sm:h-11 px-6 text-base gap-2", !scrolledToEnd && "opacity-90")}>
              {otpSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileSignature className="h-5 w-5" />} {otpSent ? t("sign.continue") : t("sign.reviewAndSign")}
            </Button>
          </div>
          {otpError && <p className="text-center text-xs text-red-600 mt-1">{otpError}</p>}
        </div>
      )}
    </div>
  );
}
