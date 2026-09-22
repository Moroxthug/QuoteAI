import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Mic, Square, Camera, Loader2, Sparkles, RotateCcw, Send, ImageIcon, X } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { assistantApi, type ActionTurnDto, type ProposalDto } from "@/lib/assistant-api";
import { ProposalCard, Markdownish } from "@/components/assistant/proposal-card";

type Mode = "voice" | "photo";
type Phase = "idle" | "working" | "result";
type ApiError = Error & { code?: string; status?: number; requiredPlan?: string };

/**
 * Phase 78 — the two on-site buttons on the job page (Dictate / Photo) and
 * the sheet behind them: record or pick a photo → the assistant turns it into
 * proposal cards → confirm. Same cards as the Assistant tab, same server
 * turn, so the chat thread shows what happened on site.
 */
export function VoiceActions({ jobId }: { jobId: string }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<Mode | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!f) return;
    setPhoto(f);
    setMode("photo");
  };

  return (
    <>
      <button type="button" className="btn btn-sm btn-navy" onClick={() => setMode("voice")} title={t("voice.dictateHint")}>
        <Mic className="h-4 w-4" /> {t("voice.dictate")}
      </button>
      <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => fileRef.current?.click()} title={t("voice.photoHint")}>
        <Camera className="h-4 w-4" /> {t("voice.photo")}
      </button>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={onPick} data-testid="voice-photo-input" />
      {mode && <ActionSheet jobId={jobId} mode={mode} photo={photo} onClose={() => { setMode(null); setPhoto(null); }} />}
    </>
  );
}

function ActionSheet({ jobId, mode, photo, onClose }: { jobId: string; mode: Mode; photo: File | null; onClose: () => void }) {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>("idle");
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState("");
  const [turn, setTurn] = useState<ActionTurnDto | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!photo) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(photo);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    queryClient.invalidateQueries({ queryKey: ["jobs"] });
    queryClient.invalidateQueries({ queryKey: ["job-notes", jobId] });
    queryClient.invalidateQueries({ queryKey: ["job-photos", jobId] });
    queryClient.invalidateQueries({ queryKey: ["job-analytics"] });
    queryClient.invalidateQueries({ queryKey: ["assistant", jobId] });
  };

  const finish = (result: ActionTurnDto) => { setTurn(result); setPhase("result"); queryClient.invalidateQueries({ queryKey: ["assistant", jobId] }); if (result.photo) queryClient.invalidateQueries({ queryKey: ["job-photos", jobId] }); };
  const fail = (e: ApiError) => { setError(e); setPhase("idle"); };

  const run = useMutation({
    mutationFn: (input: { kind: "voice"; blob: Blob } | { kind: "text"; text: string } | { kind: "photo"; file: File; note: string }) => {
      if (input.kind === "voice") return assistantApi.voice(jobId, input.blob, lang);
      if (input.kind === "text") return assistantApi.action(jobId, input.text, lang);
      return assistantApi.photo(jobId, input.file, { note: input.note, language: lang });
    },
    onMutate: () => { setError(null); setPhase("working"); },
    onSuccess: finish,
    onError: fail,
  });

  const onRecorded = useCallback((blob: Blob) => { run.mutate({ kind: "voice", blob }); }, [run]);
  const { isRecording, startRecording, stopRecording } = useVoiceInput({
    onTranscribed: () => {},
    onRecorded,
    onError: (message) => { setPhase("idle"); toast({ title: t("mic.errorTitle"), description: message, variant: "destructive" }); },
  });

  const toggleRecording = () => {
    if (isRecording) { stopRecording(); return; }
    setError(null);
    void startRecording();
  };

  const patch = (p: ProposalDto) => setTurn((prev) => (prev ? { ...prev, proposals: prev.proposals.map((x) => (x.id === p.id ? p : x)) } : prev));
  const confirm = useMutation({
    mutationFn: (id: string) => assistantApi.confirm(id),
    onSuccess: ({ proposal }) => { patch(proposal); invalidate(); toast({ title: t("assistant.applied"), description: proposal.summary }); },
    onError: (e: Error) => { toast({ title: t("assistant.applyFailed"), description: e.message, variant: "destructive" }); queryClient.invalidateQueries({ queryKey: ["assistant", jobId] }); },
  });
  const dismiss = useMutation({ mutationFn: (id: string) => assistantApi.dismiss(id), onSuccess: ({ proposal }) => patch(proposal) });

  const reset = () => { setTurn(null); setTyped(""); setError(null); setPhase("idle"); };
  const gated = error?.code === "PLAN_REQUIRED";
  const reply = turn?.messages.filter((m) => m.role === "assistant" && m.content.trim()).pop()?.content ?? "";
  const pendingCount = turn?.proposals.filter((p) => p.status === "pending").length ?? 0;

  return (
    <Dialog open onOpenChange={(v) => { if (!v) { if (isRecording) stopRecording(); onClose(); } }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{mode === "photo" ? t("voice.photoTitle") : t("voice.title")}</DialogTitle>
          <DialogDescription>{mode === "photo" ? t("voice.photoDesc") : t("voice.desc")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {gated ? (
            <div className="rounded-[var(--radius)] border border-navy-200 bg-navy-50 p-6 text-center">
              <Sparkles className="h-8 w-8 text-navy-300 mx-auto mb-2" />
              <h3 className="font-bold text-slate-900">{t("assistant.gatedTitle")}</h3>
              <p className="text-sm text-slate-600 mt-1">{t("voice.gatedDesc")}</p>
              <Link href="/dashboard/billing" className="inline-block mt-3 text-sm font-semibold text-navy-700 hover:underline">{t("assistant.upgrade")}</Link>
            </div>
          ) : phase === "result" && turn ? (
            <div className="voice-result" data-testid="voice-result">
              {turn.transcript && <div className="bubble user">{turn.transcript}</div>}
              {previewUrl && mode === "photo" && (
                <div className="voice-photo">
                  <img src={previewUrl} alt="" />
                  {note && <span>{note}</span>}
                </div>
              )}
              {reply && <div className="bubble ai"><Markdownish text={reply} /></div>}
              {turn.proposals.map((p) => (
                <ProposalCard key={p.id} proposal={p} onConfirm={() => confirm.mutate(p.id)} onDismiss={() => dismiss.mutate(p.id)} busy={confirm.isPending && confirm.variables === p.id} />
              ))}
              {turn.proposals.length === 0 && <p className="text-sm text-slate-500">{t("voice.noProposal")}</p>}
            </div>
          ) : mode === "photo" ? (
            <div className="voice-idle">
              {previewUrl ? (
                <div className="voice-photo"><img src={previewUrl} alt="" /></div>
              ) : (
                <div className="voice-photo empty"><ImageIcon className="h-8 w-8" /></div>
              )}
              <div className="field">
                <label>{t("voice.photoNote")}</label>
                <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("voice.photoNotePlaceholder")} disabled={phase === "working"} />
              </div>
              {error && !gated && <p className="text-sm" style={{ color: "var(--red)" }}>{error.message}</p>}
              <button type="button" className="btn btn-navy" disabled={!photo || phase === "working"} onClick={() => photo && run.mutate({ kind: "photo", file: photo, note: note.trim() })}>
                {phase === "working" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {phase === "working" ? t("voice.looking") : t("voice.askPhoto")}
              </button>
            </div>
          ) : (
            <div className="voice-idle">
              <button
                type="button"
                className={cn("voice-big", isRecording && "rec", phase === "working" && "busy")}
                onClick={toggleRecording}
                disabled={phase === "working"}
                aria-label={isRecording ? t("mic.stop") : t("mic.dictate")}
                data-testid="voice-record"
              >
                {phase === "working" ? <Loader2 className="h-8 w-8 animate-spin" /> : isRecording ? <Square className="h-7 w-7 fill-current" /> : <Mic className="h-8 w-8" />}
              </button>
              <p className="voice-state">
                {phase === "working" ? t("voice.working") : isRecording ? t("voice.listening") : t("voice.tapToTalk")}
              </p>
              {phase === "idle" && !isRecording && (
                <ul className="voice-examples">
                  <li>{t("voice.ex1")}</li>
                  <li>{t("voice.ex2")}</li>
                  <li>{t("voice.ex3")}</li>
                </ul>
              )}
              {error && !gated && <p className="text-sm" style={{ color: "var(--red)" }}>{error.message}</p>}
              <div className="voice-typed">
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && typed.trim() && phase !== "working") { e.preventDefault(); run.mutate({ kind: "text", text: typed.trim() }); } }}
                  placeholder={t("voice.typeInstead")}
                  aria-label={t("voice.typeInstead")}
                  disabled={phase === "working" || isRecording}
                  data-testid="voice-typed"
                />
                <button type="button" className="comp-send" disabled={!typed.trim() || phase === "working" || isRecording} onClick={() => run.mutate({ kind: "text", text: typed.trim() })} aria-label={t("assistant.send")}>
                  <Send className="chev" />
                </button>
              </div>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          {phase === "result" ? (
            <>
              <button type="button" className="btn btn-sm btn-outline-navy" onClick={reset}><RotateCcw className="h-4 w-4" /> {t("voice.another")}</button>
              <button type="button" className="btn btn-sm btn-navy" onClick={onClose}>{pendingCount ? t("voice.closeKeep") : t("voice.done")}</button>
            </>
          ) : (
            <button type="button" className="btn btn-sm btn-outline-navy" onClick={onClose}><X className="h-4 w-4" /> {t("jobs.cancel")}</button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
