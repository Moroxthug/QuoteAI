import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Plus, StickyNote, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { applyPatches, patch, rollback, showUndoToast, useOptimisticMutation, useUndoableRemove } from "@/lib/optimistic";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";
import { jobsApi, type JobNoteDto } from "@/lib/jobs-api";

/**
 * Phase 78 — job notes on the Overview tab. Notes arrive from this card, from
 * a dictation ("note: client wants the trim white") or from a photo the
 * assistant looked at; the source pill says which.
 */
export function NotesCard({ jobId, milestoneTitles }: { jobId: string; milestoneTitles: Map<string, string> }) {
  const { t, lang } = useLanguage();
const can = useCan();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const locale = lang === "fr" ? frCA : enCA;

  const key = ["job-notes", jobId];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => jobsApi.listNotes(jobId) });
  const onError = (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" });
  // Phase 115: a note shows the moment it is added (a stand-in row until the
  // server's arrives) with an Undo that deletes it; a deleted note goes at once
  // and is only deleted on the server once its Undo has passed.
  type Notes = { notes: JobNoteDto[] };
  const without = (id: string) => patch<Notes>(key, (d) => ({ notes: d.notes.filter((n) => n.id !== id) }));
  const add = useOptimisticMutation({
    mutationFn: ({ body }: { body: string; tempId: string }) => jobsApi.addNote(jobId, { body }),
    patch: ({ body, tempId }) => [patch<Notes>(key, (d) => ({ notes: [{ id: tempId, projectId: jobId, milestoneId: null, photoId: null, body, source: "manual", authorName: "", createdAt: new Date().toISOString() }, ...d.notes] }))],
    onSuccess: ({ note }, { tempId }) => {
      queryClient.setQueryData<Notes>(key, (prev) => (prev ? { notes: prev.notes.map((n) => (n.id === tempId ? note : n)) } : prev));
      showUndoToast({
        title: t("undo.noteAdded"),
        undoLabel: t("common.undo"),
        onUndo: () => {
          void applyPatches(queryClient, [without(note.id)]).then((snap) =>
            jobsApi.deleteNote(jobId, note.id).then(
              () => void queryClient.invalidateQueries({ queryKey: key }),
              (e: Error) => { rollback(queryClient, snap); onError(e); },
            ),
          );
        },
      });
    },
    onError: (e) => onError(e),
  });
  const remove = useUndoableRemove({
    commit: (noteId: string) => jobsApi.deleteNote(jobId, noteId),
    patch: (noteId) => [without(noteId)],
    title: () => t("undo.noteDeleted"),
  });

  const submit = () => {
    const b = draft.trim();
    if (!b) return;
    setDraft("");
    add.mutate({ body: b, tempId: `tmp-${Date.now()}` });
  };
  const notes: JobNoteDto[] = data?.notes ?? [];

  return (
    <section className="card" data-testid="notes-card">
      <div className="card-head">
        <div><h2><StickyNote className="inline h-4 w-4 mr-1 -mt-0.5" />{t("notes.title")}</h2></div>
        {notes.length > 0 && <span className="foot-note">{notes.length}</span>}
      </div>
      <div className="act-body">
        {isLoading ? (
          <div className="note-list skel-wait" aria-busy="true"><Skeleton className="h-[62px] w-full rounded-[12px]" aria-hidden="true" /><Skeleton className="h-[62px] w-full rounded-[12px]" aria-hidden="true" /></div>
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
                {can("jobs", "edit") && <button type="button" className="ic-btn danger" onClick={() => remove(n.id)} disabled={n.id.startsWith("tmp-")} aria-label={t("notes.delete")}><Trash2 /></button>}
              </div>
            ))}
          </div>
        )}
        {can("jobs", "edit") && <div className="note-add">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
            placeholder={t("notes.placeholder")}
            aria-label={t("notes.placeholder")}
            rows={1}
            data-testid="note-input"
          />
          <button type="button" className="btn btn-sm btn-navy" onClick={submit} disabled={!draft.trim()}>
            <Plus className="h-4 w-4" /> {t("notes.add")}
          </button>
        </div>}
      </div>
    </section>
  );
}
