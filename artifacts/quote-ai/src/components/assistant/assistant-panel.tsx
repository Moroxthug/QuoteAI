import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Send, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { assistantApi, type AssistantMessageDto, type ProposalDto } from "@/lib/assistant-api";
import { MicButton } from "@/components/mic-button";
import { ProposalCard, Markdownish } from "@/components/assistant/proposal-card";

/**
 * Chat with the job assistant. `projectId` scopes the conversation to a job;
 * null = the company-wide conversation. Writes only happen through proposal
 * cards the user confirms here.
 */
export function AssistantPanel({ projectId, className }: { projectId: string | null; className?: string }) {
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

  const lastAt = data?.messages.length ? data.messages[data.messages.length - 1]!.createdAt : null;
  const threadLabel = projectId ? t("assistant.threadJob") : t("assistant.threadCompany");
  const threadTime = lastAt ? new Date(lastAt).toLocaleDateString() : t("assistant.threadNew");

  if (gated) {
    return (
      <div className={cn("rounded-[var(--radius)] border border-navy-200 bg-navy-50 p-8 text-center", className)}>
        <Sparkles className="h-10 w-10 text-navy-300 mx-auto mb-3" />
        <h3 className="font-bold text-slate-900">{t("assistant.gatedTitle")}</h3>
        <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">{t("assistant.gatedDesc")}</p>
        <Link href="/dashboard/billing" className="inline-block mt-4 text-sm font-semibold text-navy-700 hover:underline">{t("assistant.upgrade")}</Link>
      </div>
    );
  }

  return (
    <div className={cn("chat-grid", className)}>
      <div className="card th-list">
        <div className="card-head"><div><h2>{t("assistant.threadsTitle")}</h2></div></div>
        <button type="button" className="th-row on">
          <b>{threadLabel}</b>
          <span>{threadTime}</span>
        </button>
      </div>

      <div className="card">
        <div className="chat-head">
          <div className="chat-head-main">
            <span className="chat-av"><Sparkles className="h-4 w-4" /></span>
            <div><b>{t("assistant.title")}</b><small>{t("assistant.online")}</small></div>
          </div>
          {data && data.messages.length > 0 && (
            <button type="button" className="chat-clear" onClick={() => clear.mutate()} disabled={clear.isPending}><Trash2 className="h-3.5 w-3.5" /> {t("assistant.clear")}</button>
          )}
        </div>

        <div ref={listRef} className="chat-body">
          {isLoading && (
            <>
              <div className="bubble ai typing"><i /><i /><i /></div>
            </>
          )}
          {data && visible.length === 0 && !pending && (
            <div className="bubble ai">{projectId ? t("assistant.emptyJob") : t("assistant.emptyCompany")}</div>
          )}
          {visible.map((m, idx) => (
            <div key={m.id} className="contents">
              {m.role === "assistant" && cardsFor(idx).map((p) => <ProposalCard key={p.id} proposal={p} onConfirm={() => confirm.mutate(p.id)} onDismiss={() => dismiss.mutate(p.id)} busy={confirm.isPending && confirm.variables === p.id} />)}
              <Bubble message={m} />
            </div>
          ))}
          {pending && <Bubble message={{ id: "pending", role: "user", content: pending, toolCalls: null, toolCallId: null, toolName: null, createdAt: "" }} />}
          {send.isPending && <div className="bubble ai typing"><i /><i /><i /></div>}
        </div>

        {data && visible.length === 0 && !pending && (
          <div className="chat-sug">
            {suggestions.map((s) => <button key={s} type="button" className="pill" onClick={() => send.mutate(s)}>{s}</button>)}
          </div>
        )}

        <div className="chat-in">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder={t("assistant.placeholder")}
            aria-label={t("assistant.placeholder")}
            disabled={!data || send.isPending}
          />
          <MicButton onTranscribed={(text) => setDraft((d) => (d ? `${d} ${text}` : text))} disabled={!data || send.isPending} />
          <button type="button" className="comp-send" onClick={submit} disabled={!draft.trim() || !data || send.isPending} aria-label={t("assistant.send")}>
            <Send className="chev" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ message }: { message: AssistantMessageDto }) {
  const mine = message.role === "user";
  return (
    <div className={cn("bubble", mine ? "user" : "ai")}>
      {mine ? message.content : <Markdownish text={message.content} />}
    </div>
  );
}
