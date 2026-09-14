import { useParams, Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-100 p-8 text-center space-y-5">
        <Logo style={{ height: 28, margin: "0 auto" }} />

        {isLoading && <Loader2 className="h-6 w-6 animate-spin mx-auto text-violet-500" />}

        {!isLoading && err && (
          <div className="space-y-2">
            <XCircle className="h-10 w-10 text-rose-500 mx-auto" />
            <p className="text-slate-700 font-medium">{err.message || "This invite link isn't valid."}</p>
          </div>
        )}

        {!isLoading && preview && !accept.isSuccess && (
          <div className="space-y-4">
            <h1 className="text-xl font-bold text-slate-900">Join {preview.companyName || "your team"} on QuoteAI</h1>
            <p className="text-sm text-slate-500">You've been invited as <strong>{preview.role}</strong>, using <strong>{preview.email}</strong>.</p>

            {!isLoaded ? (
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-violet-500" />
            ) : !isSignedIn ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-400">Sign in or create an account with that email to accept.</p>
                <div className="flex gap-2 justify-center">
                  <Link href={`/sign-in?next=${returnTo}`}><Button variant="outline">Sign in</Button></Link>
                  <Link href={`/sign-up?next=${returnTo}`}><Button>Create account</Button></Link>
                </div>
              </div>
            ) : user?.email?.toLowerCase() !== preview.email.toLowerCase() ? (
              <p className="text-sm text-rose-600">You're signed in as {user?.email}. Sign in with {preview.email} instead to accept this invite.</p>
            ) : (
              <Button className="gap-2" disabled={accept.isPending} onClick={() => accept.mutate()}>
                {accept.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Accept invite
              </Button>
            )}
            {accept.isError && <p className="text-sm text-rose-600">{(accept.error as Error).message}</p>}
          </div>
        )}

        {accept.isSuccess && (
          <div className="space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <p className="text-slate-700 font-medium">You're in! You now have access to {preview?.companyName}'s account.</p>
            <Link href="/dashboard"><Button>Go to dashboard</Button></Link>
          </div>
        )}
      </div>
    </div>
  );
}
