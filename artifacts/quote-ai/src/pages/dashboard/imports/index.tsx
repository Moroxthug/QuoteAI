import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UploadCloud, FileSpreadsheet, FileText, Loader2, Download, Check, X, Trash2, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { importsApi, type ImportCandidateDto, type ImportedQuoteExtraction } from "@/lib/imports-api";

const BATCH_BADGE: Record<string, string> = {
  processing: "bg-amber-100 text-amber-700",
  done: "bg-emerald-100 text-emerald-700",
  error: "bg-red-100 text-red-700",
};

function CandidateCard({ candidate }: { candidate: ImportCandidateDto }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ImportedQuoteExtraction>(candidate.extraction);
  const onError = (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" });

  const save = useMutation({
    mutationFn: (extraction: ImportedQuoteExtraction) => importsApi.updateCandidate(candidate.id, extraction),
    onError,
  });
  const confirm = useMutation({
    mutationFn: () => importsApi.confirm(candidate.id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["import-candidates"] }); toast({ title: t("imports.confirmSuccess") }); },
    onError,
  });
  const reject = useMutation({
    mutationFn: () => importsApi.reject(candidate.id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["import-candidates"] }); toast({ title: t("imports.rejectSuccess") }); },
    onError,
  });

  const update = (patch: Partial<ImportedQuoteExtraction>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
  };
  const commit = () => save.mutate(draft);

  const busy = confirm.isPending || reject.isPending;
  const matchLabel = candidate.matchedClientId ? t("imports.matchedClient") : draft.clientName ? t("imports.newClient") : t("imports.missingClient");

  return (
    <div className="rounded-[var(--radius)] border bg-card p-4 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <label className="text-xs text-slate-500">{t("imports.field.client")}</label>
          <Input value={draft.clientName ?? ""} onChange={(e) => update({ clientName: e.target.value || null })} onBlur={commit} />
        </div>
        <div>
          <label className="text-xs text-slate-500">{t("imports.field.email")}</label>
          <Input value={draft.email ?? ""} onChange={(e) => update({ email: e.target.value || null })} onBlur={commit} />
        </div>
        <div>
          <label className="text-xs text-slate-500">{t("imports.field.phone")}</label>
          <Input value={draft.phone ?? ""} onChange={(e) => update({ phone: e.target.value || null })} onBlur={commit} />
        </div>
        <div>
          <label className="text-xs text-slate-500">{t("imports.field.address")}</label>
          <Input value={draft.address ?? ""} onChange={(e) => update({ address: e.target.value || null })} onBlur={commit} />
        </div>
        <div>
          <label className="text-xs text-slate-500">{t("imports.field.date")}</label>
          <Input type="date" value={draft.date ?? ""} onChange={(e) => update({ date: e.target.value || null })} onBlur={commit} />
        </div>
        <div>
          <label className="text-xs text-slate-500">{t("imports.field.status")}</label>
          <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={draft.status} onChange={(e) => { update({ status: e.target.value as "draft" | "accepted" }); commit(); }}>
            <option value="draft">{t("imports.status.draft")}</option>
            <option value="accepted">{t("imports.status.accepted")}</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">{t("imports.field.total")}</label>
          <Input type="number" step="0.01" value={draft.total ?? ""} onChange={(e) => update({ total: e.target.value ? Number(e.target.value) : null })} onBlur={commit} />
        </div>
        <div>
          <label className="text-xs text-slate-500">{t("imports.field.notes")}</label>
          <Input value={draft.notes ?? ""} onChange={(e) => update({ notes: e.target.value || null })} onBlur={commit} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Badge variant="secondary" className={cn("font-normal", candidate.matchedClientId ? "bg-emerald-100 text-emerald-700" : draft.clientName ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700")}>
          {matchLabel}
        </Badge>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={() => reject.mutate()}>
            {reject.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            {t("imports.reject")}
          </Button>
          <Button size="sm" className="gap-1.5" disabled={busy || !draft.clientName?.trim()} onClick={() => confirm.mutate()}>
            {confirm.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {t("imports.confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ImportsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const onError = (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" });

  const [dragCsv, setDragCsv] = useState(false);
  const [dragPdf, setDragPdf] = useState(false);
  const csvInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);

  const { data: batchesData } = useQuery({ queryKey: ["import-batches"], queryFn: () => importsApi.listBatches() });
  const { data: candidatesData, isLoading: candidatesLoading } = useQuery({ queryKey: ["import-candidates"], queryFn: () => importsApi.listCandidates({ status: "pending_review" }) });

  const batches = batchesData?.batches ?? [];
  const candidates = candidatesData?.candidates ?? [];

  const uploadSpreadsheet = useMutation({
    mutationFn: (file: File) => importsApi.uploadSpreadsheet(file),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["import-batches"] });
      queryClient.invalidateQueries({ queryKey: ["import-candidates"] });
      toast({ title: `${res.totalRows} rows imported` });
    },
    onError,
  });

  const uploadPdfs = useMutation({
    mutationFn: (files: File[]) => importsApi.uploadPdfs(files),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["import-batches"] });
      queryClient.invalidateQueries({ queryKey: ["import-candidates"] });
      toast({ title: `${res.ok} of ${res.totalRows} PDFs read successfully` });
    },
    onError,
  });

  const confirmAll = useMutation({
    mutationFn: (batchId: string) => importsApi.confirmAll(batchId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["import-candidates"] });
      toast({ title: `${res.confirmed} quotes created${res.skipped ? `, ${res.skipped} skipped (missing client name)` : ""}` });
    },
    onError,
  });

  const deleteBatch = useMutation({
    mutationFn: (batchId: string) => importsApi.deleteBatch(batchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-batches"] });
      queryClient.invalidateQueries({ queryKey: ["import-candidates"] });
    },
    onError,
  });

  const onCsvFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) uploadSpreadsheet.mutate(file);
  };
  const onPdfFiles = (files: FileList | null) => {
    if (!files || !files.length) return;
    uploadPdfs.mutate(Array.from(files).slice(0, 20));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
          <UploadCloud className="h-8 w-8 text-navy-600" />
          {t("imports.title")}
        </h1>
        <p className="text-slate-500 mt-1">{t("imports.subtitle")}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-[var(--radius)] border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-navy-600" />
            <h3 className="font-bold text-slate-900">{t("imports.uploadSpreadsheet")}</h3>
          </div>
          <p className="text-xs text-slate-500">{t("imports.uploadSpreadsheetDesc")}</p>
          <a href={importsApi.templateUrl} className="inline-flex items-center gap-1.5 text-xs font-medium text-navy-700 hover:underline">
            <Download className="h-3.5 w-3.5" /> {t("imports.downloadTemplate")}
          </a>
          <div
            className={cn("rounded-[var(--radius)] border-2 border-dashed p-5 text-center transition-colors cursor-pointer", dragCsv ? "border-navy-400 bg-navy-50" : "border-slate-200 hover:border-navy-300")}
            onDragOver={(e) => { e.preventDefault(); setDragCsv(true); }}
            onDragLeave={() => setDragCsv(false)}
            onDrop={(e) => { e.preventDefault(); setDragCsv(false); onCsvFiles(e.dataTransfer.files); }}
            onClick={() => csvInput.current?.click()}
          >
            <input ref={csvInput} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { onCsvFiles(e.target.files); e.target.value = ""; }} />
            <div className="flex flex-col items-center gap-1.5 text-sm text-slate-500">
              {uploadSpreadsheet.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
              {uploadSpreadsheet.isPending ? t("imports.uploading") : t("imports.dropFiles")}
            </div>
          </div>
        </div>

        <div className="rounded-[var(--radius)] border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-navy-600" />
            <h3 className="font-bold text-slate-900">{t("imports.uploadPdfs")}</h3>
          </div>
          <p className="text-xs text-slate-500">{t("imports.uploadPdfsDesc")}</p>
          <div
            className={cn("rounded-[var(--radius)] border-2 border-dashed p-5 text-center transition-colors cursor-pointer mt-6", dragPdf ? "border-navy-400 bg-navy-50" : "border-slate-200 hover:border-navy-300")}
            onDragOver={(e) => { e.preventDefault(); setDragPdf(true); }}
            onDragLeave={() => setDragPdf(false)}
            onDrop={(e) => { e.preventDefault(); setDragPdf(false); onPdfFiles(e.dataTransfer.files); }}
            onClick={() => pdfInput.current?.click()}
          >
            <input ref={pdfInput} type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => { onPdfFiles(e.target.files); e.target.value = ""; }} />
            <div className="flex flex-col items-center gap-1.5 text-sm text-slate-500">
              {uploadPdfs.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
              {uploadPdfs.isPending ? t("imports.uploading") : t("imports.dropFiles")}
            </div>
          </div>
        </div>
      </div>

      {batches.length > 0 && (
        <div className="rounded-[var(--radius)] border bg-card p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-2">{t("imports.batches")}</h3>
          <div className="divide-y">
            {batches.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-3 py-2">
                <div className="flex-1 min-w-[160px] text-sm text-slate-900">{b.fileName}</div>
                <Badge variant="secondary" className={cn("font-normal", BATCH_BADGE[b.status])}>{t(`imports.batch.${b.status}`)}</Badge>
                <span className="text-xs text-slate-500">{b.totalRows} {b.kind === "pdf" ? "files" : "rows"}</span>
                {b.status === "done" && (
                  <Button size="sm" variant="outline" className="gap-1.5" disabled={confirmAll.isPending} onClick={() => confirmAll.mutate(b.id)}>
                    {confirmAll.isPending && confirmAll.variables === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                    {t("imports.confirmAll")}
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="gap-1.5 text-red-600 hover:text-red-700" disabled={deleteBatch.isPending} onClick={() => deleteBatch.mutate(b.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{t("imports.reviewQueue")}</h3>
          <p className="text-xs text-slate-500">{t("imports.reviewQueueDesc")}</p>
        </div>
        {candidatesLoading ? (
          <div className="text-sm text-slate-400 py-8 text-center">…</div>
        ) : candidates.length === 0 ? (
          <div className="text-center py-16 text-slate-500 border border-dashed rounded-[var(--radius)]">{t("imports.emptyQueue")}</div>
        ) : (
          <div className="space-y-3">
            {candidates.map((c) => <CandidateCard key={c.id} candidate={c} />)}
          </div>
        )}
      </div>
    </div>
  );
}
