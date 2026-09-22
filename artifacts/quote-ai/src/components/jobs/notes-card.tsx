import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Loader2, Plus, StickyNote, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { jobsApi, type JobNoteDto } from "@/lib/jobs-api";

/**
 * Phase 78 — job notes on the Overview tab. Notes arrive from this card, from
 * a dictation ("note: client wants the trim white") or from a photo the
 * assistant looked at; the source pill says which.
 */
export function NotesCard({ jobId, milestoneTitles }: { jobId: string; milestoneTitles: Map<string, string> }) {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const locale = lang === "fr" ? frCA : enCA;

  const key = ["job-notes", jobId];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => jobsApi.listNotes(jobId) });
  const onError = (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" });
  const add = useMutation({
    mutationFn: (body: string) => jobsApi.addNote(jobId, { body }),
    onSuccess: ({ note }) => { setDraft(""); queryClient.setQueryData(key, (prev: typeof data) => (prev ? { notes: [note, ...prev.notes] } : prev)); },
    onError,
  });
  const remove = useMutation({
    mutationFn: (noteId: string) => jobsApi.deleteNote(jobId, noteId),
    onSuccess: (_r, noteId) => queryClient.setQueryData(key, (prev: typeof data) => (prev ? { notes: prev.notes.filter((n) => n.id !== noteId) } : prev)),
    onError,
  });

  const submit = () => { const b = draft.trim(); if (b && !add.isPending) add.mutate(b); };
  const notes: JobNoteDto[] = data?.notes ?? [];

  return (
    <section className="card" data-testid="notes-card">
      <div className="card-head">
        <div><h2><StickyNote className="inline h-4 w-4 mr-1 -mt-0.5" />{t("notes.title")}</h2></div>
        {notes.length > 0 && <span className="foot-note">{notes.length}</span>}
      </div>
      <div className="act-body">
        {isLoading ? (
          <Skeleton className="h-12 w-full" />
        ) : notes.length === 0 ? (
          <p className="text-sm text-slate-500">{t("notes.empty")}</p>
        ) : (
          <div className="note-list">
            {notes.map((n) => (
              <div key={n.id} className="note-row">
                <div className="body">
                  {n.body}
                  <div className="meta">
                    <span className={cn("src", n.source)}>{t(`notes.source.${n.source}`)}</span>
                    {n.milestoneId && milestoneTitles.get(n.milestoneId) && <span>{milestoneTitles.get(n.milestoneId)}</span>}
                    {n.authorName && <span>{n.authorName}</span>}
                    <span>{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale })}</span>
                  </div>
                </div>
                <button type="button" className="ic-btn danger" onClick={() => remove.mutate(n.id)} disabled={remove.isPending} aria-label={t("notes.delete")}><Trash2 /></button>
              </div>
            ))}
          </div>
        )}
        <div className="note-add">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
            placeholder={t("notes.placeholder")}
            aria-label={t("notes.placeholder")}
            rows={1}
            data-testid="note-input"
          />
          <button type="button" className="btn btn-sm btn-navy" onClick={submit} disabled={!draft.trim() || add.isPending}>
            {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {t("notes.add")}
          </button>
        </div>
      </div>
    </section>
  );
}
