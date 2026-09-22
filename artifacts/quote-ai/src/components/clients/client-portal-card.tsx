import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Loader2, Mail, UserRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";
import { clientPortalApi } from "@/lib/portal-api";

/**
 * Phase 76: the client's portal link — copy it, email the invitation, see
 * when they last opened it. Shown on the job page (Messages tab) and the
 * client page.
 */
export function ClientPortalCard({ clientId }: { clientId: string }) {
  const { t, lang } = useLanguage();
const can = useCan();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["client-portal", clientId], queryFn: () => clientPortalApi.status(clientId) });
  const invite = useMutation({
    mutationFn: () => clientPortalApi.invite(clientId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["client-portal", clientId] }); toast({ title: t("portalCard.invited") }); },
    onError: (e: Error & { code?: string }) => toast({ title: e.code === "NO_EMAIL" ? t("portalCard.noEmail") : e.code === "EMAIL_NOT_CONFIGURED" ? t("portalCard.emailNotConfigured") : t("jobs.error"), variant: "destructive" }),
  });
  const when = (s: string | null) => (s ? new Date(s).toLocaleString(lang === "fr" ? "fr-CA" : "en-CA", { dateStyle: "medium", timeStyle: "short" }) : null);

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="inline-flex items-center gap-2"><UserRound className="h-4 w-4" /> {t("portalCard.title")}</h2>
          <p className="sub">{t("portalCard.sub")}</p>
        </div>
      </div>
      <div className="act-body space-y-3">
        {!data ? (
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--faint)" }} />
        ) : !data.hasEmail || !data.url ? (
          <p className="foot-note m-0">{t("portalCard.noEmail")}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <code className="text-xs rounded px-2 py-1 truncate max-w-full" style={{ background: "var(--soft)", color: "var(--navy)" }}>{data.url}</code>
              <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => { navigator.clipboard.writeText(data.url!); toast({ title: t("invoices.copied") }); }}><Copy className="h-4 w-4" /> {t("portalCard.copy")}</button>
              <a href={data.url} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-navy" aria-label={t("portalCard.open")}><ExternalLink className="h-4 w-4" /></a>
              {can("jobs", "edit") && <button type="button" className="btn btn-sm btn-navy" onClick={() => invite.mutate()} disabled={invite.isPending}>
                {invite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} {data.invitedAt ? t("portalCard.resend") : t("portalCard.send")}
              </button>}
            </div>
            <p className="foot-note m-0">
              {data.invitedAt ? `${t("portalCard.invitedAt")} ${when(data.invitedAt)}` : t("portalCard.notInvited")}
              {" · "}
              {data.lastSeenAt ? `${t("portalCard.lastSeen")} ${when(data.lastSeenAt)}` : t("portalCard.neverOpened")}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
