import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Send, Trash2, Check, X, ExternalLink, Receipt, Wallet, Flag, ListTodo, Mail, Banknote, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { assistantApi, type AssistantMessageDto, type ProposalDto, type ProposalKind } from "@/lib/assistant-api";
import { formatCents } from "@/lib/jobs-api";

const KIND_ICON: Record<ProposalKind, typeof Receipt> = { cost_entry: Wallet, milestone_update: Flag, task: ListTodo, invoice: Receipt, send_invoice: Mail, record_payment: Banknote };

/**
 * Chat with the job assistant. `projectId` scopes the conversation to a job;
 * null = the company-wide conversation. Writes only happen through proposal
 * cards the user confirms here.
 */
export function AssistantPanel({ projectId, className, compact }: { projectId: string | null; className?: string; compact?: boolean }) {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null); // optimistic user bubble while the turn runs
  const listRef = useRef<HTMLDivElement>(null);

  const key = ["assistant", projectId ?? "company"];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => assistantApi.conversation(projectId), retry: false });
  const gated = (error as (Error & { code?: string }) | null)?.code === "PLAN_REQUIRED";

  const invalidateData = () => {
    queryClient.invalidateQueries({ queryKey: ["job"] });
    queryClient.invalidateQueries({ queryKey: ["jobs"] });
    queryClient.invalidateQueries({ queryKey: ["job-analytics"] });
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    queryClient.invalidateQueries({ queryKey: ["invoice"] });
    queryClient.invalidateQueries({ queryKey: ["company-analytics"] });
  };

  const send = useMutation({
    mutationFn: (content: string) => assistantApi.send(data!.conversation.id, content, lang),
    onMutate: (content) => { setPending(content); setDraft(""); },
    onSuccess: (turn) => {
      queryClient.setQueryData(key, (prev: typeof data) => (prev ? { ...prev, messages: [...prev.messages, ...turn.messages], proposals: [...prev.proposals, ...turn.proposals] } : prev));
    },
    onError: (e: Error) => toast({ title: t("assistant.error"), description: e.message, variant: "destructive" }),
    onSettled: () => setPending(null),
  });

  const patchProposal = (p: ProposalDto) => queryClient.setQueryData(key, (prev: typeof data) => (prev ? { ...prev, proposals: prev.proposals.map((x) => (x.id === p.id ? p : x)) } : prev));
  const confirm = useMutation({
    mutationFn: (id: string) => assistantApi.confirm(id),
    onSuccess: ({ proposal }) => { patchProposal(proposal); invalidateData(); toast({ title: t("assistant.applied"), description: proposal.summary }); },
    onError: (e: Error) => { toast({ title: t("assistant.applyFailed"), description: e.message, variant: "destructive" }); queryClient.invalidateQueries({ queryKey: key }); },
  });
  const dismiss = useMutation({ mutationFn: (id: string) => assistantApi.dismiss(id), onSuccess: ({ proposal }) => patchProposal(proposal) });
  const clear = useMutation({ mutationFn: () => assistantApi.clear(data!.conversation.id), onSuccess: () => queryClient.invalidateQueries({ queryKey: key }) });

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [data?.messages.length, pending, send.isPending]);

  const visible = useMemo(() => (data?.messages ?? []).filter((m) => m.role === "user" || (m.role === "assistant" && m.content.trim())), [data]);
  const proposalsByMessage = useMemo(() => {
    const map = new Map<string, ProposalDto[]>();
    for (const p of data?.proposals ?? []) { const k = p.messageId ?? "orphan"; map.set(k, [...(map.get(k) ?? []), p]); }
    return map;
  }, [data]);
  // Proposal cards are attached to the tool-calling assistant turn, which is usually hidden; show them under the next visible assistant message.
  const cardsFor = (idx: number): ProposalDto[] => {
    const all = data?.messages ?? [];
    const msg = visible[idx]!;
    const pos = all.findIndex((m) => m.id === msg.id);
    const prevVisiblePos = idx > 0 ? all.findIndex((m) => m.id === visible[idx - 1]!.id) : -1;
    const out: ProposalDto[] = [];
    for (let i = prevVisiblePos + 1; i <= pos; i++) out.push(...(proposalsByMessage.get(all[i]!.id) ?? []));
    return out;
  };

  const submit = () => { const c = draft.trim(); if (c && data && !send.isPending) send.mutate(c); };
  const suggestions = (projectId ? ["s1", "s2", "s3", "s4"] : ["c1", "c2", "c3", "c4"]).map((k) => t(`assistant.suggest.${k}`));

  if (gated) {
    return (
      <div className={cn("rounded-2xl border border-violet-200 dark:border-violet-800/40 bg-violet-50 dark:bg-violet-500/15 p-8 text-center", className)}>
        <Sparkles className="h-10 w-10 text-violet-300 mx-auto mb-3" />
        <h3 className="font-bold text-slate-900">{t("assistant.gatedTitle")}</h3>
        <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">{t("assistant.gatedDesc")}</p>
        <Link href="/dashboard/billing" className="inline-block mt-4 text-sm font-semibold text-violet-700 hover:underline">{t("assistant.upgrade")}</Link>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col rounded-2xl border border-slate-200 bg-card overflow-hidden", compact ? "h-[560px]" : "h-[calc(100dvh-220px)] min-h-[520px]", className)}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Sparkles className="h-4 w-4 text-violet-600" /> {t("assistant.title")}</div>
        {data && data.messages.length > 0 && (
          <button className="text-xs text-slate-400 hover:text-slate-700 inline-flex items-center gap-1" onClick={() => clear.mutate()} disabled={clear.isPending}><Trash2 className="h-3.5 w-3.5" /> {t("assistant.clear")}</button>
        )}
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isLoading && <div className="space-y-3"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-10 w-1/2 ml-auto" /></div>}
        {data && visible.length === 0 && !pending && (
          <div className="text-center py-6">
            <Sparkles className="h-8 w-8 text-violet-200 mx-auto mb-2" />
            <p className="text-sm text-slate-600 max-w-sm mx-auto">{projectId ? t("assistant.emptyJob") : t("assistant.emptyCompany")}</p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {suggestions.map((s) => <button key={s} onClick={() => send.mutate(s)} className="text-xs rounded-full border border-slate-200 px-3 py-1.5 text-slate-700 hover:border-violet-300 hover:bg-violet-50">{s}</button>)}
            </div>
          </div>
        )}
        {visible.map((m, idx) => (
          <div key={m.id}>
            {m.role === "assistant" && cardsFor(idx).map((p) => <ProposalCard key={p.id} proposal={p} onConfirm={() => confirm.mutate(p.id)} onDismiss={() => dismiss.mutate(p.id)} busy={confirm.isPending && confirm.variables === p.id} />)}
            <Bubble message={m} />
          </div>
        ))}
        {pending && <Bubble message={{ id: "pending", role: "user", content: pending, toolCalls: null, toolCallId: null, toolName: null, createdAt: "" }} />}
        {send.isPending && (
          <div className="flex items-center gap-2 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("assistant.thinking")}</div>
        )}
      </div>

      <div className="border-t border-slate-100 p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder={t("assistant.placeholder")}
            rows={1}
            className="min-h-[40px] max-h-32 resize-none text-sm"
            disabled={!data || send.isPending}
          />
          <Button size="icon" onClick={submit} disabled={!draft.trim() || !data || send.isPending} aria-label={t("assistant.send")}><Send className="h-4 w-4" /></Button>
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5">{t("assistant.disclaimer")}</p>
      </div>
    </div>
  );
}

function Bubble({ message }: { message: AssistantMessageDto }) {
  const mine = message.role === "user";
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed", mine ? "bg-violet-600 text-white rounded-br-md" : "bg-slate-100 text-slate-800 rounded-bl-md")}>
        {mine ? <span className="whitespace-pre-wrap">{message.content}</span> : <Markdownish text={message.content} />}
      </div>
    </div>
  );
}

/** Tiny renderer: paragraphs, "- " bullets, **bold**. Enough for the assistant's prose without pulling a markdown lib. */
function Markdownish({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let list: string[] = [];
  const flush = () => { if (list.length) { blocks.push(<ul key={blocks.length} className="list-disc pl-4 space-y-0.5">{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); list = []; } };
  for (const raw of lines) {
    const line = raw.trim();
    const m = /^(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (m) { list.push(m[1]!); continue; }
    flush();
    if (line) blocks.push(<p key={blocks.length}>{inline(line.replace(/^#+\s*/, ""))}</p>);
  }
  flush();
  return <div className="space-y-1.5">{blocks}</div>;
}

function inline(s: string): ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>));
}

function ProposalCard({ proposal, onConfirm, onDismiss, busy }: { proposal: ProposalDto; onConfirm: () => void; onDismiss: () => void; busy: boolean }) {
  const { t } = useLanguage();
  const Icon = KIND_ICON[proposal.kind] ?? Receipt;
  const p = proposal.payload;
  const details: string[] = [];
  if (proposal.kind === "cost_entry") details.push(`${formatCents(Number(p.subtotalCents))} + ${t("assistant.tax")} ${formatCents(Number(p.taxCents))} = ${formatCents(Number(p.totalCents))}`, String(p.date ?? ""), String(p.description ?? ""));
  if (proposal.kind === "record_payment") details.push(`${formatCents(Number(p.amountCents))} · ${t(`invoices.method.${String(p.method)}`)} · ${String(p.date ?? "")}`);
  if (proposal.kind === "milestone_update" && p.releasesPaymentTerm) details.push(`${t("assistant.releases")} ${String(p.releasesPaymentTerm)}`);
  if (proposal.kind === "send_invoice" && p.message) details.push(`"${String(p.message)}"`);
  const tab = proposal.kind === "cost_entry" ? "costs" : proposal.kind === "milestone_update" || proposal.kind === "task" ? "schedule" : "invoices";
  const link = proposal.resultEntityType === "invoice" && proposal.resultEntityId ? `/dashboard/invoices/${proposal.resultEntityId}` : proposal.projectId ? `/dashboard/jobs/${proposal.projectId}?tab=${tab}` : null;
  const status = proposal.status;
  return (
    <div className={cn("mb-2 max-w-[85%] rounded-xl border p-3 text-sm", status === "pending" ? "border-violet-200 bg-violet-50/60" : status === "confirmed" ? "border-emerald-200 bg-emerald-50/50" : status === "failed" ? "border-rose-200 bg-rose-50/50" : "border-slate-200 bg-slate-50 opacity-70")}>
      <div className="flex items-start gap-2">
        <span className="h-7 w-7 rounded-lg bg-card border border-slate-200 flex items-center justify-center shrink-0"><Icon className="h-3.5 w-3.5 text-violet-600" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">{t(`assistant.kind.${proposal.kind}`)}</div>
          <div className="font-medium text-slate-900">{proposal.summary}</div>
          {details.filter(Boolean).map((d, i) => <div key={i} className="text-xs text-slate-500 mt-0.5">{d}</div>)}
          {status === "failed" && proposal.error && <div className="text-xs text-rose-700 mt-1 inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {proposal.error}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2.5">
        {status === "pending" && (
          <>
            <Button size="sm" className="h-8 gap-1.5" onClick={onConfirm} disabled={busy}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} {t("assistant.confirm")}</Button>
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-slate-500" onClick={onDismiss} disabled={busy}><X className="h-3.5 w-3.5" /> {t("assistant.dismiss")}</Button>
          </>
        )}
        {status === "confirmed" && (
          <>
            <span className="text-xs font-medium text-emerald-700 inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> {t("assistant.confirmed")}</span>
            {link && <Link href={link} className="text-xs text-violet-700 hover:underline inline-flex items-center gap-1"><ExternalLink className="h-3 w-3" /> {t("assistant.open")}</Link>}
          </>
        )}
        {status === "dismissed" && <span className="text-xs text-slate-500">{t("assistant.dismissed")}</span>}
        {status === "failed" && <span className="text-xs text-rose-600">{t("assistant.failed")}</span>}
      </div>
    </div>
  );
}
