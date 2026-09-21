import { useLanguage } from "@/i18n/LanguageContext";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useParams, Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { teamInviteApi } from "@/lib/team-members-api";
import { Logo } from "@/components/logo";

/**
 * Public landing page for a team-member invite link (emailed from
 * /dashboard/team → Members). The invitee must sign in or sign up with the
 * invited email address before the invite can be accepted.
 */

const fmt = (s: string, vars: Record<string, string | undefined>) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

export default function TeamInvitePage() {
  const { t } = useLanguage();
  const { token } = useParams<{ token: string }>();
  const { isLoaded, isSignedIn, user } = useAuth();
  const { data: preview, isLoading, error } = useQuery({ queryKey: ["team-invite", token], queryFn: () => teamInviteApi.preview(token), retry: false });
  useDocumentTitle(preview ? t("invite.title").replace("{company}", preview.companyName || t("invite.yourTeam")) : null);
  const accept = useMutation({ mutationFn: () => teamInviteApi.accept(token) });

  const err = error as (Error & { code?: string }) | null;
  const returnTo = encodeURIComponent(`/team-invite/${token}`);

  return (
    <div className="doc-shell flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-8 text-center space-y-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <Logo style={{ height: 28, margin: "0 auto" }} />

        {isLoading && <Loader2 className="h-6 w-6 animate-spin mx-auto" style={{ color: "var(--navy)" }} />}

        {!isLoading && err && (
          <div className="space-y-2">
            <XCircle className="h-10 w-10 mx-auto" style={{ color: "var(--red)" }} />
            <p className="font-medium" style={{ color: "var(--ink)" }}>{err.message || t("invite.invalid")}</p>
          </div>
        )}

        {!isLoading && preview && !accept.isSuccess && (
          <div className="space-y-4">
            <h1 className="text-xl font-bold" style={{ color: "var(--navy)" }}>{fmt(t("invite.title"), { company: preview.companyName || t("invite.yourTeam") })}</h1>
            <p className="text-sm" style={{ color: "var(--muted-mk)" }}>{t("invite.invitedAs")} <strong>{preview.role}</strong>{t("invite.using")} <strong>{preview.email}</strong>.</p>

            {!isLoaded ? (
              <Loader2 className="h-5 w-5 animate-spin mx-auto" style={{ color: "var(--navy)" }} />
            ) : !isSignedIn ? (
              <div className="space-y-2">
                <p className="text-xs" style={{ color: "var(--faint)" }}>{t("invite.signInHint")}</p>
                <div className="flex gap-2 justify-center">
                  <Link href={`/sign-in?next=${returnTo}`} className="btn btn-outline-navy btn-sm">{t("invite.signIn")}</Link>
                  <Link href={`/sign-up?next=${returnTo}`} className="btn btn-navy btn-sm">{t("invite.createAccount")}</Link>
                </div>
              </div>
            ) : user?.email?.toLowerCase() !== preview.email.toLowerCase() ? (
              <p className="text-sm" style={{ color: "var(--red)" }}>{fmt(t("invite.wrongAccount"), { current: user?.email, expected: preview.email })}</p>
            ) : (
              <button className="btn btn-navy" disabled={accept.isPending} onClick={() => accept.mutate()}>
                {accept.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("invite.accept")}
              </button>
            )}
            {accept.isError && <p className="text-sm" style={{ color: "var(--red)" }}>{(accept.error as Error).message}</p>}
          </div>
        )}

        {accept.isSuccess && (
          <div className="space-y-3">
            <CheckCircle2 className="h-10 w-10 mx-auto" style={{ color: "var(--green-dark)" }} />
            <p className="font-medium" style={{ color: "var(--ink)" }}>{fmt(t("invite.done"), { company: preview?.companyName })}</p>
            <Link href="/dashboard" className="btn btn-navy">{t("invite.goToDashboard")}</Link>
          </div>
        )}
      </div>
    </div>
  );
}
