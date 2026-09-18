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
export default function TeamInvitePage() {
  const { token } = useParams<{ token: string }>();
  const { isLoaded, isSignedIn, user } = useAuth();
  const { data: preview, isLoading, error } = useQuery({ queryKey: ["team-invite", token], queryFn: () => teamInviteApi.preview(token), retry: false });
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
            <p className="font-medium" style={{ color: "var(--ink)" }}>{err.message || "This invite link isn't valid."}</p>
          </div>
        )}

        {!isLoading && preview && !accept.isSuccess && (
          <div className="space-y-4">
            <h1 className="text-xl font-bold" style={{ color: "var(--navy)" }}>Join {preview.companyName || "your team"} on QuoteAI</h1>
            <p className="text-sm" style={{ color: "var(--muted-mk)" }}>You've been invited as <strong>{preview.role}</strong>, using <strong>{preview.email}</strong>.</p>

            {!isLoaded ? (
              <Loader2 className="h-5 w-5 animate-spin mx-auto" style={{ color: "var(--navy)" }} />
            ) : !isSignedIn ? (
              <div className="space-y-2">
                <p className="text-xs" style={{ color: "var(--faint)" }}>Sign in or create an account with that email to accept.</p>
                <div className="flex gap-2 justify-center">
                  <Link href={`/sign-in?next=${returnTo}`} className="btn btn-outline-navy btn-sm">Sign in</Link>
                  <Link href={`/sign-up?next=${returnTo}`} className="btn btn-navy btn-sm">Create account</Link>
                </div>
              </div>
            ) : user?.email?.toLowerCase() !== preview.email.toLowerCase() ? (
              <p className="text-sm" style={{ color: "var(--red)" }}>You're signed in as {user?.email}. Sign in with {preview.email} instead to accept this invite.</p>
            ) : (
              <button className="btn btn-navy" disabled={accept.isPending} onClick={() => accept.mutate()}>
                {accept.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Accept invite
              </button>
            )}
            {accept.isError && <p className="text-sm" style={{ color: "var(--red)" }}>{(accept.error as Error).message}</p>}
          </div>
        )}

        {accept.isSuccess && (
          <div className="space-y-3">
            <CheckCircle2 className="h-10 w-10 mx-auto" style={{ color: "var(--green-dark)" }} />
            <p className="font-medium" style={{ color: "var(--ink)" }}>You're in! You now have access to {preview?.companyName}'s account.</p>
            <Link href="/dashboard" className="btn btn-navy">Go to dashboard</Link>
          </div>
        )}
      </div>
    </div>
  );
}
