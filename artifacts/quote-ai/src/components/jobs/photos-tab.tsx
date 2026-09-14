import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Loader2, Trash2, Share2, Check, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-900">{t("jobs.photos.title")}</h3>
        <p className="text-xs text-slate-500">{t("jobs.photos.desc")}</p>
      </div>

      <div
        className={cn("rounded-2xl border-2 border-dashed p-5 text-center transition-colors cursor-pointer", dragging ? "border-violet-400 bg-violet-50" : "border-slate-200 bg-white hover:border-violet-300")}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); onFiles(e.dataTransfer.files); }}
        onClick={() => fileInput.current?.click()}
      >
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
        <div className="flex flex-col items-center gap-1.5">
          <div className="h-10 w-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center">{upload.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}</div>
          <div className="font-semibold text-slate-900 text-sm">{upload.isPending ? t("jobs.photos.uploading") : t("jobs.photos.upload")}</div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5">
          <span className="text-sm text-violet-900">{selected.size} {t("jobs.photos.selected")}</span>
          <Button size="sm" className="gap-2" disabled={share.isPending} onClick={() => share.mutate([...selected])}>
            {share.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
            {share.isPending ? t("jobs.photos.sharing") : t("jobs.photos.share")}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-slate-400 py-8 text-center">…</div>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-slate-400">
          <ImageOff className="h-8 w-8" />
          <p className="text-sm">{t("jobs.photos.empty")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map((p: JobPhotoDto) => {
            const isSelected = selected.has(p.id);
            return (
              <div key={p.id} className={cn("group relative rounded-xl overflow-hidden border bg-white", isSelected ? "border-violet-500 ring-2 ring-violet-200" : "border-slate-200")}>
                <button className="block w-full aspect-square bg-slate-100" onClick={() => toggle(p.id)}>
                  <img src={jobsApi.photoFileUrl(job.id, p.id)} alt={p.caption || p.fileName} className="w-full h-full object-cover" />
                </button>
                <div className={cn("absolute top-2 left-2 h-5 w-5 rounded-full border-2 flex items-center justify-center", isSelected ? "bg-violet-600 border-violet-600" : "bg-white/80 border-white")} onClick={() => toggle(p.id)}>
                  {isSelected && <Check className="h-3 w-3 text-white" />}
                </div>
                <button
                  className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-red-600"
                  onClick={(e) => { e.stopPropagation(); if (confirm(t("jobs.photos.deleteConfirm"))) del.mutate(p.id); }}
                  title={t("jobs.photos.delete")}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
                <div className="p-2 space-y-0.5">
                  {milestoneTitle(p.milestoneId) && <div className="text-[10px] text-violet-600 truncate">{milestoneTitle(p.milestoneId)}</div>}
                  {p.caption && <div className="text-[11px] text-slate-600 truncate">{p.caption}</div>}
                  {p.sharedAt && <div className="text-[10px] text-emerald-600">{t("jobs.photos.shared")}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
