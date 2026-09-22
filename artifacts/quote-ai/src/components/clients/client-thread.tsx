import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { clientPortalApi, type PortalMessageDto } from "@/lib/portal-api";

/**
 * Phase 76: the company ↔ client message thread. One thread per client; when
 * rendered on a job page every new message is tagged with that job, and the
 * list shows which job each older message was about. Opening the card marks
 * the client's replies read (server side, on the GET).
 */
export function ClientThreadCard({ clientId, jobId, jobName }: { clientId: string; jobId?: string; jobName?: string }) {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["client-thread", clientId], queryFn: () => clientPortalApi.thread(clientId) });
  const send = useMutation({
    mutationFn: () => clientPortalApi.send(clientId, { body: body.trim(), jobId: jobId ?? null }),
    onSuccess: (r) => {
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["client-thread", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client-portal", clientId] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast({ title: r.emailed ? t("thread.sentEmailed") : t("thread.sentNotEmailed") });
    },
    onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }),
  });
  const when = (s: string) => new Date(s).toLocaleString(lang === "fr" ? "fr-CA" : "en-CA", { dateStyle: "medium", timeStyle: "short" });
  const messages = data?.messages ?? [];

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="inline-flex items-center gap-2"><MessageSquare className="h-4 w-4" /> {t("thread.title")}</h2>
          <p className="sub">{data?.client ? t("thread.sub").replace("{name}", data.client.name).replace("{email}", data.client.email ?? "—") : ""}</p>
        </div>
        {!jobId && data?.client && <Link href={`/dashboard/clients/${clientId}`} className="text-link">{t("thread.openClient")}</Link>}
      </div>
      <div className="act-body space-y-4">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--faint)" }} />
        ) : messages.length === 0 ? (
          <p className="foot-note m-0">{t("thread.empty")}</p>
        ) : (
          <ol className="space-y-3 m-0 p-0 list-none max-h-[420px] overflow-y-auto pr-1">
            {messages.map((m: PortalMessageDto) => (
              <li key={m.id} className={cn("flex", m.sender === "contractor" ? "justify-end" : "justify-start")}>
                <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm" style={m.sender === "contractor" ? { background: "var(--navy)", color: "#fff" } : { background: "var(--soft)", color: "var(--ink)" }}>
                  <div className="text-[11px] font-semibold mb-1 opacity-80">
                    {m.sender === "contractor" ? (m.senderName || t("thread.you")) : m.senderName}{m.jobName && m.jobId !== jobId ? ` · ${m.jobName}` : ""} · {when(m.createdAt)}
                  </div>
                  <div className="whitespace-pre-wrap">{m.body}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
        <div className="space-y-2">
          <div className="field">
            <label htmlFor={`thread-body-${clientId}`}>{jobName ? t("thread.composeAbout").replace("{job}", jobName) : t("thread.compose")}</label>
            <textarea id={`thread-body-${clientId}`} rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} placeholder={t("thread.placeholder")} />
          </div>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="foot-note">{data?.client?.email ? t("thread.emailHint") : t("thread.noEmailHint")}</span>
            <button type="button" className="btn btn-sm btn-navy" onClick={() => send.mutate()} disabled={!body.trim() || send.isPending}>
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t("thread.send")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
