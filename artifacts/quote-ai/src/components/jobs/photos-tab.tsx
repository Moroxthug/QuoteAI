import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Loader2, Trash2, Share2, Check, ImageOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { jobsApi, type JobDetailDto, type JobPhotoDto } from "@/lib/jobs-api";

/**
 * Photos tab (Phase 10): upload progress photos tied to the job (optionally
 * a milestone), then optionally share a selection with the customer — a
 * time-limited link sent by email/WhatsApp, not a public gallery.
 */
export function PhotosTab({ data }: { data: JobDetailDto }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { job, milestones } = data;
  const queryKey = ["job-photos", job.id];

  const { data: photosData, isLoading } = useQuery({ queryKey, queryFn: () => jobsApi.listPhotos(job.id) });
  const photos = photosData?.photos ?? [];

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const onError = (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" });

  const upload = useMutation({
    mutationFn: (file: File) => jobsApi.uploadPhoto(job.id, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (e: Error) => toast({ title: t("jobs.photos.uploadError"), description: e.message, variant: "destructive" }),
  });
  const del = useMutation({
    mutationFn: (photoId: string) => jobsApi.deletePhoto(job.id, photoId),
    onSuccess: (_r, photoId) => { queryClient.invalidateQueries({ queryKey }); setSelected((s) => { const n = new Set(s); n.delete(photoId); return n; }); },
    onError,
  });
  const share = useMutation({
    mutationFn: (photoIds: string[]) => jobsApi.sharePhotos(job.id, photoIds),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); setSelected(new Set()); toast({ title: t("jobs.photos.sharedToast") }); },
    onError: (e: Error & { code?: string }) => toast({ title: e.code === "NO_CLIENT" ? t("jobs.photos.shareErrorNoClient") : t("jobs.photos.shareError"), description: e.code === "NO_CLIENT" ? undefined : e.message, variant: "destructive" }),
  });

  const onFiles = (files: FileList | null) => {
    if (!files || !files.length) return;
    Array.from(files).slice(0, 10).forEach((f) => upload.mutate(f));
  };

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const milestoneTitle = (id: string | null) => (id ? milestones.find((m) => m.id === id)?.title ?? null : null);

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>{t("jobs.photos.title")}</h2>
          <p className="sub">{t("jobs.photos.desc")}</p>
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="foot-note">{selected.size} {t("jobs.photos.selected")}</span>
            <button type="button" className="btn btn-sm btn-navy" disabled={share.isPending} onClick={() => share.mutate([...selected])}>
              {share.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
              {share.isPending ? t("jobs.photos.sharing") : t("jobs.photos.share")}
            </button>
          </div>
        )}
      </div>

      <div className="act-body stack">
        <div
          className={cn("dropzone flush", dragging && "on")}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); onFiles(e.dataTransfer.files); }}
          onClick={() => fileInput.current?.click()}
        >
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
          <div className="dz-ic">{upload.isPending ? <Loader2 className="animate-spin" /> : <Upload />}</div>
          <b>{upload.isPending ? t("jobs.photos.uploading") : t("jobs.photos.upload")}</b>
        </div>

        {isLoading ? (
          <div className="card-empty">…</div>
        ) : photos.length === 0 ? (
          <div className="card-empty">
            <ImageOff />
            {t("jobs.photos.empty")}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((p: JobPhotoDto) => {
              const isSelected = selected.has(p.id);
              const ms = milestoneTitle(p.milestoneId);
              return (
                <div key={p.id} className={cn("photo", isSelected && "on")}>
                  <button type="button" className="photo-img" onClick={() => toggle(p.id)}>
                    <img src={jobsApi.photoFileUrl(job.id, p.id)} alt={p.caption || p.fileName} />
                  </button>
                  <button type="button" className={cn("chk", isSelected && "on")} onClick={() => toggle(p.id)} aria-pressed={isSelected}>
                    {isSelected && <Check />}
                  </button>
                  <button
                    type="button"
                    className="photo-del"
                    onClick={(e) => { e.stopPropagation(); if (confirm(t("jobs.photos.deleteConfirm"))) del.mutate(p.id); }}
                    title={t("jobs.photos.delete")}
                  >
                    <Trash2 />
                  </button>
                  {(ms || p.caption || p.sharedAt) && (
                    <div className="photo-meta">
                      {ms && <b>{ms}</b>}
                      {p.caption && <span className="block truncate">{p.caption}</span>}
                      {p.sharedAt && <i>{t("jobs.photos.shared")}</i>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
