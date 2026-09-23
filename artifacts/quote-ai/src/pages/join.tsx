import { useState } from "react";
import { Link, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, KeyRound, Loader2, XCircle } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useAuth } from "@/hooks/use-auth";
import { Logo } from "@/components/logo";
import { peopleApi } from "@/lib/people-api";

/**
 * Phase 91: /join — the employee's first stop with an access code. Type the
 * code, see which company and role it is for, then create an account (or sign
 * in) and come back here to join; the next stop is setting up their profile.
 * The code rides in ?code= so it survives the sign-up round trip (email
 * verification returns to this page).
 */
export default function JoinPage() {
  const { t } = useLanguage();
  useDocumentTitle(t("join.title"));
  const queryClient = useQueryClient();
  const initial = new URLSearchParams(useSearch()).get("code") ?? "";
  const [typed, setTyped] = useState(initial);
  const [code, setCode] = useState(initial);
  const { isLoaded, isSignedIn, user } = useAuth();
  const preview = useQuery({ queryKey: ["join-code", code], queryFn: () => peopleApi.previewCode(code), enabled: code.replace(/[^0-9a-z]/gi, "").length === 10, retry: false });
  const redeem = useMutation({
    mutationFn: () => peopleApi.redeemCode(code),
    // A full load: the acting company changed (a cookie), and nothing cached belongs to the old one.
    onSuccess: () => { queryClient.clear(); window.location.href = "/dashboard/me?welcome=1"; },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = typed.trim();
    setCode(clean);
    const u = new URL(window.location.href);
    u.searchParams.set("code", clean);
    window.history.replaceState(null, "", u.toString());
  };
  const returnTo = encodeURIComponent(`/join?code=${encodeURIComponent(preview.data?.code ?? code)}`);
  const err = (preview.error ?? redeem.error) as (Error & { code?: string }) | null;

  return (
    <main id="main" className="doc-shell flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-8 space-y-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <Logo style={{ height: 28, margin: "0 auto" }} />
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold" style={{ color: "var(--navy)" }}>{t("join.title")}</h1>
          <p className="text-sm m-0" style={{ color: "var(--muted-mk)" }}>{t("join.subtitle")}</p>
        </div>

        {!preview.data && (
          <form onSubmit={submit} className="space-y-3">
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="join-code">{t("join.codeLabel")}</label>
              <input
                id="join-code"
                value={typed}
                onChange={(e) => setTyped(e.target.value.toUpperCase())}
                placeholder="XXXXX-XXXXX"
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
                style={{ fontSize: 20, letterSpacing: ".12em", textAlign: "center", fontWeight: 700 }}
                autoFocus
              />
            </div>
            <button type="submit" className="btn btn-navy w-full" disabled={typed.replace(/[^0-9a-z]/gi, "").length !== 10 || preview.isFetching}>
              {preview.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} {t("join.check")}
            </button>
          </form>
        )}

        {err && (
          <div className="flex items-start gap-2 text-sm" role="alert" style={{ color: "var(--red)" }}>
            <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{err.code && t(`join.error.${err.code}`) !== `join.error.${err.code}` ? t(`join.error.${err.code}`) : err.message}</span>
          </div>
        )}

        {preview.data && (
          <div className="space-y-4 text-center">
            {preview.data.logoUrl && <img src={preview.data.logoUrl} alt="" style={{ maxHeight: 48, margin: "0 auto" }} />}
            <p className="m-0" style={{ color: "var(--ink)" }}>
              {t("join.forCompany").replace("{company}", preview.data.companyName || "—").replace("{role}", t(`join.role.${preview.data.role}`))}
            </p>
            {!isLoaded ? (
              <Loader2 className="h-5 w-5 animate-spin mx-auto" style={{ color: "var(--navy)" }} />
            ) : !isSignedIn ? (
              <div className="space-y-2">
                <p className="text-xs m-0" style={{ color: "var(--faint)" }}>{t("join.needAccount")}</p>
                <div className="flex gap-2 justify-center">
                  <Link href={`/sign-up?next=${returnTo}`} className="btn btn-navy btn-sm">{t("join.createAccount")}</Link>
                  <Link href={`/sign-in?next=${returnTo}`} className="btn btn-outline-navy btn-sm">{t("join.signIn")}</Link>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs m-0" style={{ color: "var(--faint)" }}>{t("join.signedInAs").replace("{email}", user?.email ?? "")}</p>
                <button type="button" className="btn btn-navy" disabled={redeem.isPending} onClick={() => redeem.mutate()}>
                  {redeem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} {t("join.join")}
                </button>
              </div>
            )}
            <button type="button" className="text-xs" style={{ color: "var(--faint)" }} onClick={() => { setCode(""); setTyped(""); }}>{t("join.otherCode")}</button>
          </div>
        )}
      </div>
    </main>
  );
}
