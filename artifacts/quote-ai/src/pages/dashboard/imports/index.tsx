import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UploadCloud, Loader2, Download, Check, X, Trash2, CheckCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";
import { importsApi, type ImportCandidateDto, type ImportedQuoteExtraction } from "@/lib/imports-api";

const BATCH_BADGE: Record<string, string> = {
  processing: "chip-yellow",
  done: "chip-green",
  error: "chip-red",
};

function CandidateCard({ candidate }: { candidate: ImportCandidateDto }) {
  const { t } = useLanguage();
const can = useCan();
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
    <div className="card" style={{ padding: 16 }}>
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

      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-3 border-t" style={{ borderColor: "var(--soft)" }}>
        <span className={cn("chip", candidate.matchedClientId ? "chip-green" : draft.clientName ? "chip-teal" : "chip-yellow")}>
          {matchLabel}
        </span>
        {can("imports", "edit") && <div className="flex gap-2">
          <button type="button" className="btn btn-outline-navy btn-sm gap-1.5" disabled={busy} onClick={() => reject.mutate()}>
            {reject.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            {t("imports.reject")}
          </button>
          <button type="button" className="btn btn-navy btn-sm gap-1.5" disabled={busy || !draft.clientName?.trim()} onClick={() => confirm.mutate()}>
            {confirm.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {t("imports.confirm")}
          </button>
        </div>}
      </div>
    </div>
  );
}

export default function ImportsPage() {
  const { t } = useLanguage();
const can = useCan();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const onError = (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" });

  const [source, setSource] = useState<"csv" | "pdf">("csv");
  const [dragging, setDragging] = useState(false);
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

  const busy = source === "csv" ? uploadSpreadsheet.isPending : uploadPdfs.isPending;
  const lastBatch = batches[0];

  return (
    <div className="animate-in fade-in duration-300">
      <div className="page-head">
        <div>
          <h1>{t("imports.title")}</h1>
          <p className="sub">{t("imports.subtitle")}</p>
        </div>
      </div>

      <div className="steps-3">
        <div className="card step-card">
          <span className="step-num">1</span>
          <b>{t("imports.step1Title")}</b>
          <p>{t("imports.step1Desc")}</p>
        </div>
        <div className="card step-card">
          <span className="step-num">2</span>
          <b>{t("imports.step2Title")}</b>
          <p>{t("imports.step2Desc")}</p>
        </div>
        <div className="card step-card">
          <span className="step-num">3</span>
          <b>{t("imports.step3Title")}</b>
          <p>{t("imports.step3Desc")}</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <div>
            <h2>{t("imports.chooseSource")}</h2>
            <p className="sub">{t("imports.chooseSourceDesc")}</p>
          </div>
        </div>
        <div className="src-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
          <button type="button" className={cn("src", source === "csv" && "on")} onClick={() => setSource("csv")}>
            <b>{t("imports.uploadSpreadsheet")}</b>
            <p>{t("imports.uploadSpreadsheetDesc")}</p>
            <span className="chip chip-green">{t("imports.recommended")}</span>
          </button>
          <button type="button" className={cn("src", source === "pdf" && "on")} onClick={() => setSource("pdf")}>
            <b>{t("imports.uploadPdfs")}</b>
            <p>{t("imports.uploadPdfsDesc")}</p>
            <span className="chip chip-grey">{t("imports.manualMapping")}</span>
          </button>
        </div>

        {source === "csv" ? (
          <div
            className="dropzone"
            style={dragging ? { borderColor: "var(--navy)", background: "var(--soft)" } : undefined}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); onCsvFiles(e.dataTransfer.files); }}
          >
            <input ref={csvInput} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { onCsvFiles(e.target.files); e.target.value = ""; }} />
            <b>{t("imports.dropCsvTitle")}</b>
            <p>{t("imports.dropCsvDesc")}</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button type="button" className="btn btn-outline-navy btn-sm gap-1.5" onClick={() => csvInput.current?.click()} disabled={uploadSpreadsheet.isPending}>
                {uploadSpreadsheet.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                {uploadSpreadsheet.isPending ? t("imports.uploading") : t("imports.chooseFile")}
              </button>
              <a href={importsApi.templateUrl} className="cta-link" style={{ fontSize: 13.5 }}>
                <Download className="h-3.5 w-3.5" /> {t("imports.downloadTemplate")}
              </a>
            </div>
          </div>
        ) : (
          <div
            className="dropzone"
            style={dragging ? { borderColor: "var(--navy)", background: "var(--soft)" } : undefined}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); onPdfFiles(e.dataTransfer.files); }}
          >
            <input ref={pdfInput} type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => { onPdfFiles(e.target.files); e.target.value = ""; }} />
            <b>{t("imports.dropPdfTitle")}</b>
            <p>{t("imports.dropPdfDesc")}</p>
            <button type="button" className="btn btn-outline-navy btn-sm gap-1.5" onClick={() => pdfInput.current?.click()} disabled={uploadPdfs.isPending}>
              {uploadPdfs.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {uploadPdfs.isPending ? t("imports.uploading") : t("imports.chooseFile")}
            </button>
          </div>
        )}

        <div className="card-foot">
          <span className="foot-note">
            {lastBatch ? `${t("imports.lastImport")}: ${lastBatch.fileName} · ${lastBatch.totalRows} ${lastBatch.kind === "pdf" ? t("imports.files") : t("imports.rows")}` : t("imports.noBatches")}
          </span>
          {busy && <Loader2 className="h-4 w-4 animate-spin text-navy-500" />}
        </div>
      </div>

      {batches.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-head">
            <div><h2>{t("imports.batches")}</h2></div>
          </div>
          <div>
            {batches.map((b) => (
              <div key={b.id} className="set-row">
                <div className="txt flex items-center gap-3 flex-wrap">
                  <span style={{ color: "var(--navy)", fontSize: 14.5, fontWeight: 600 }}>{b.fileName}</span>
                  <span className={cn("chip", BATCH_BADGE[b.status])}>{t(`imports.batch.${b.status}`)}</span>
                  <span style={{ fontSize: 13, color: "var(--faint)" }}>{b.totalRows} {b.kind === "pdf" ? t("imports.files") : t("imports.rows")}</span>
                </div>
                {b.status === "done" && can("imports", "edit") && (
                  <button type="button" className="btn btn-outline-navy btn-sm gap-1.5" disabled={confirmAll.isPending} onClick={() => confirmAll.mutate(b.id)}>
                    {confirmAll.isPending && confirmAll.variables === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                    {t("imports.confirmAll")}
                  </button>
                )}
                {can("imports", "full") && <button
                  type="button"
                  className="btn btn-outline-navy btn-sm"
                  style={{ color: "var(--red)", borderColor: "var(--red)" }}
                  disabled={deleteBatch.isPending}
                  onClick={() => deleteBatch.mutate(b.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <div>
            <h2>{t("imports.reviewQueue")}</h2>
            <p className="sub">{t("imports.reviewQueueDesc")}</p>
          </div>
        </div>
        <div style={{ padding: 22 }}>
          {candidatesLoading ? (
            <div className="text-sm text-slate-400 py-8 text-center">…</div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-12" style={{ color: "var(--faint)" }}>{t("imports.emptyQueue")}</div>
          ) : (
            <div className="space-y-3">
              {candidates.map((c) => <CandidateCard key={c.id} candidate={c} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
