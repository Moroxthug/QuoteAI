import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FolderOpen, Upload, Loader2, CheckCircle2, AlertCircle, Clock, Trash2, Zap, FileText, ImageIcon, TrendingUp, TrendingDown, ChevronDown, ChevronUp, X, Scale } from "lucide-react";
import {
  useListDocuments,
  useUploadDocument,
  useExtractDocument,
  useDeleteDocument,
  useGetPriceSummary,
  useGetPriceAlerts,
  useDismissPriceAlert,
  useGetPriceComparison,
  getListDocumentsQueryKey,
  getGetPriceSummaryQueryKey,
  getGetPriceAlertsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { UploadedDocument } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 2 }).format(v);

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));

function StatusChip({ status }: { status: UploadedDocument["status"] }) {
  if (status === "done") return (
    <span className="chip chip-green gap-1"><CheckCircle2 className="h-3 w-3" /> Processed</span>
  );
  if (status === "processing") return (
    <span className="chip chip-teal gap-1 animate-pulse"><Loader2 className="h-3 w-3 animate-spin" /> Processing...</span>
  );
  if (status === "error") return (
    <span className="chip chip-red gap-1"><AlertCircle className="h-3 w-3" /> Error</span>
  );
  return (
    <span className="chip chip-grey gap-1"><Clock className="h-3 w-3" /> Queued</span>
  );
}

function DocumentRow({ doc }: { doc: UploadedDocument }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);

  const extractMut = useExtractDocument({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetPriceSummaryQueryKey() });
        toast({ title: "Processing complete" });
      },
      onError: () => toast({ title: "Error while processing", variant: "destructive" }),
    },
  });

  const deleteMut = useDeleteDocument({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetPriceSummaryQueryKey() });
      },
      onError: () => toast({ title: "Error while deleting", variant: "destructive" }),
    },
  });

  const isPdf = doc.mimeType === "application/pdf";
  const isDocx = doc.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const isXlsx = doc.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const lavorazioni = (doc.extractedData as { lavorazioni?: Array<{ tipo: string; prezzoUnitario: number; um?: string | null; zona?: string | null }> } | null)?.lavorazioni ?? [];

  return (
    <div className="set-row" style={{ alignItems: "flex-start" }}>
      <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--soft)", border: "1px solid var(--line)" }}>
        {isPdf ? (
          <FileText className="h-4 w-4 text-red-500" />
        ) : isDocx ? (
          <FileText className="h-4 w-4 text-blue-600" />
        ) : isXlsx ? (
          <FileText className="h-4 w-4 text-green-600" />
        ) : (
          <ImageIcon className="h-4 w-4 text-blue-500" />
        )}
      </div>

      <div className="txt">
        <div className="flex items-center gap-2 flex-wrap">
          <b style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.fileName}</b>
          <StatusChip status={doc.status} />
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span>{formatDate(doc.createdAt)}</span>
          {doc.fileSize && <span>{formatFileSize(doc.fileSize)}</span>}
          {doc.status === "done" && lavorazioni.length > 0 && (
            <span style={{ color: "var(--green-dark)", fontWeight: 700 }}>{lavorazioni.length} items extracted</span>
          )}
        </div>
        {doc.errorMessage && (
          <p className="text-xs mt-1" style={{ color: "var(--red)" }}>{doc.errorMessage}</p>
        )}

        {doc.status === "done" && lavorazioni.length > 0 && (
          <button
            className="mt-2 flex items-center gap-1 text-xs font-semibold"
            style={{ color: "var(--navy)" }}
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Hide items" : "Show extracted items"}
          </button>
        )}

        {expanded && lavorazioni.length > 0 && (
          <div className="mt-2 rounded-lg overflow-hidden" style={{ background: "var(--soft)", border: "1px solid var(--line)" }}>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--line)" }}>
                  <th className="text-left px-3 py-1.5 font-semibold" style={{ color: "var(--muted-mk)" }}>Work item</th>
                  <th className="text-right px-3 py-1.5 font-semibold" style={{ color: "var(--muted-mk)" }}>Price</th>
                  <th className="text-right px-3 py-1.5 font-semibold" style={{ color: "var(--muted-mk)" }}>Unit</th>
                </tr>
              </thead>
              <tbody>
                {lavorazioni.map((l, i) => (
                  <tr key={i} className="border-b last:border-0" style={{ borderColor: "var(--soft)" }}>
                    <td className="px-3 py-1.5" style={{ color: "var(--ink)" }}>{l.tipo}</td>
                    <td className="px-3 py-1.5 text-right font-medium" style={{ color: "var(--ink)" }}>{formatCurrency(l.prezzoUnitario)}</td>
                    <td className="px-3 py-1.5 text-right" style={{ color: "var(--muted-mk)" }}>{l.um || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {(doc.status === "pending" || doc.status === "error") && (
          <button
            type="button"
            className="btn btn-outline-navy btn-sm gap-1"
            onClick={() => extractMut.mutate({ id: doc.id })}
            disabled={extractMut.isPending}
          >
            {extractMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
            Process
          </button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-red-500"
          onClick={() => deleteMut.mutate({ id: doc.id })}
          disabled={deleteMut.isPending}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function PriceAlerts() {
  const qc = useQueryClient();
  const { data: alerts = [] } = useGetPriceAlerts();

  const dismissMut = useDismissPriceAlert({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetPriceAlertsQueryKey() }),
    },
  });

  if (alerts.length === 0) return null;

  return (
    <div className="card" style={{ background: "var(--yellow-t)", borderColor: "var(--yellow-dark)" }}>
      <div className="card-head">
        <h2 className="flex items-center gap-2" style={{ color: "var(--yellow-dark)" }}>
          <TrendingUp className="h-4 w-4" />
          Price trend alerts
        </h2>
      </div>
      <div style={{ padding: "14px 22px" }} className="space-y-2">
        {alerts.map((alert) => (
          <div key={alert.id} className="flex items-center justify-between gap-3 rounded-lg p-3" style={{ background: "#fff", border: "1px solid var(--line)" }}>
            <div className="flex items-center gap-2 min-w-0">
              {alert.direction === "up" ? (
                <TrendingUp className="h-4 w-4 text-red-500 shrink-0" />
              ) : (
                <TrendingDown className="h-4 w-4 text-green-600 shrink-0" />
              )}
              <p className="text-sm truncate" style={{ color: "var(--ink)" }}>
                <span className="font-semibold">{alert.workType}</span>
                {alert.zone && <span style={{ color: "var(--muted-mk)" }}> in {alert.zone}</span>} is{" "}
                <span className={cn("font-semibold", alert.direction === "up" ? "text-red-600" : "text-green-600")}>
                  {alert.direction === "up" ? "up" : "down"} {Math.abs(alert.percentChange).toFixed(0)}%
                </span>{" "}
                ({formatCurrency(alert.previousAvgPrice)} → {formatCurrency(alert.currentAvgPrice)})
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground hover:text-muted-foreground shrink-0"
              onClick={() => dismissMut.mutate({ id: alert.id })}
              disabled={dismissMut.isPending}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PriceComparison() {
  const { data } = useGetPriceComparison();
  const comparisons = data?.comparisons ?? [];

  if (comparisons.length === 0) return null;

  return (
    <div className="card">
      <div className="card-head">
        <h2 className="flex items-center gap-2"><Scale className="h-4 w-4" style={{ color: "var(--navy)" }} />Cross-supplier comparison</h2>
      </div>
      <div style={{ padding: "14px 22px" }} className="space-y-3">
        {comparisons.map((group) => {
          const cheapest = group.vendors[0];
          return (
            <div key={`${group.workType}::${group.zone ?? ""}`} className="rounded-lg p-3" style={{ border: "1px solid var(--line)" }}>
              <p className="text-xs font-semibold" style={{ color: "var(--ink)" }}>
                {group.workType}
                {group.zone && <span className="font-normal" style={{ color: "var(--muted-mk)" }}> — {group.zone}</span>}
              </p>
              <div className="mt-2 space-y-1">
                {group.vendors.map((v) => (
                  <div key={v.vendor} className="flex items-center justify-between text-xs">
                    <span className={cn(v.vendor === cheapest.vendor && "font-semibold text-green-700")} style={v.vendor === cheapest.vendor ? undefined : { color: "var(--muted-mk)" }}>
                      {v.vendor}
                    </span>
                    <span style={{ color: "var(--muted-mk)" }}>
                      {formatCurrency(v.avgPrice)}
                      {group.unit && `/${group.unit}`}
                      <span className="ml-1">({v.count})</span>
                    </span>
                  </div>
                ))}
              </div>
              {group.vendors.length >= 2 && group.vendors[group.vendors.length - 1].avgPrice > cheapest.avgPrice && (
                <p className="text-[10px] mt-1.5" style={{ color: "var(--navy)" }}>
                  You're paying more at {group.vendors[group.vendors.length - 1].vendor} than at {cheapest.vendor} for the same work.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { data: docs = [], isLoading } = useListDocuments();
  const { data: priceSummary } = useGetPriceSummary();

  const uploadMut = useUploadDocument({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        toast({ title: "Document uploaded — click Process to extract prices" });
      },
      onError: (err) => {
        const msg = err instanceof Error ? err.message : "Upload error";
        toast({ title: msg, variant: "destructive" });
      },
    },
  });

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      uploadMut.mutate({ data: { file } });
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, []);

  const pendingCount = docs.filter(d => d.status === "pending" || d.status === "error").length;
  const doneCount = docs.filter(d => d.status === "done").length;
  const hasEnoughForIntelligence = doneCount >= 3;

  return (
    <div className="animate-in fade-in duration-500">
      <div className="page-head">
        <div>
          <h1 className="flex items-center gap-2"><FolderOpen className="h-6 w-6" style={{ color: "var(--navy)" }} />Quote Archive</h1>
          <p className="sub">Upload existing quotes to extract your market prices and improve AI estimates.</p>
        </div>
      </div>

      <div className="card">
        <div
          className="dropzone"
          style={isDragging ? { margin: "22px", borderColor: "var(--navy)", background: "var(--soft)" } : { margin: "22px" }}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.xlsx,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <b>{uploadMut.isPending ? "Uploading..." : "Drag files here or click to select"}</b>
          <p>PDF, DOCX, XLSX, JPG, PNG or WEBP — max 10 MB per file</p>
          <button type="button" className="btn btn-outline-navy btn-sm gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={uploadMut.isPending}>
            {uploadMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Choose file
          </button>
        </div>
      </div>

      {/* Price intelligence banner */}
      {doneCount > 0 && (
        <div className="card" style={{ marginTop: 16, background: hasEnoughForIntelligence ? "var(--soft)" : "var(--yellow-t)" }}>
          <div className="flex items-center gap-3" style={{ padding: "16px 22px" }}>
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0")} style={{ background: hasEnoughForIntelligence ? "var(--soft-2)" : "var(--yellow)" }}>
              <TrendingUp className="h-4 w-4" style={{ color: hasEnoughForIntelligence ? "var(--navy)" : "var(--yellow-dark)" }} />
            </div>
            <div>
              {hasEnoughForIntelligence ? (
                <>
                  <p className="text-sm font-semibold" style={{ color: "var(--navy)" }}>Price intelligence active</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted-mk)" }}>
                    {doneCount} documents processed — your average prices are now used in new AI quotes.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold" style={{ color: "var(--yellow-dark)" }}>Almost ready ({doneCount}/3 documents)</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted-mk)" }}>
                    Process at least 3 documents to activate price intelligence in AI quotes.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <PriceAlerts />
      </div>

      <div style={{ marginTop: 16 }}>
        <PriceComparison />
      </div>

      {/* Price summary */}
      {priceSummary && priceSummary.items.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-head">
            <h2 className="flex items-center gap-2"><TrendingUp className="h-4 w-4" style={{ color: "var(--navy)" }} />Average extracted prices</h2>
          </div>
          <div style={{ padding: "14px 22px" }}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {priceSummary.items.slice(0, 12).map((item) => (
                <div key={item.workType} className="rounded-lg p-3" style={{ background: "var(--soft)", border: "1px solid var(--line)" }}>
                  <p className="text-xs font-semibold leading-tight line-clamp-2" style={{ color: "var(--ink)" }}>{item.workType}</p>
                  <p className="text-lg font-bold mt-1" style={{ color: "var(--navy)" }}>
                    {formatCurrency(item.avgUnitPrice)}
                    {item.unit && <span className="text-xs font-normal ml-1" style={{ color: "var(--muted-mk)" }}>/{item.unit}</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px]" style={{ color: "var(--faint)" }}>
                      {formatCurrency(item.minPrice)} – {formatCurrency(item.maxPrice)}
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--faint)" }}>({item.count} docs)</span>
                  </div>
                  {item.zones && item.zones.length > 0 && (
                    <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--faint)" }}>{item.zones.join(", ")}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Document list */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <div>
            <h2 className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" style={{ color: "var(--muted-mk)" }} />
              Uploaded documents
              {docs.length > 0 && <span className="chip chip-grey">{docs.length}</span>}
            </h2>
          </div>
          {pendingCount > 0 && (
            <span className="sub" style={{ color: "var(--yellow-dark)" }}>{pendingCount} pending processing</span>
          )}
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : docs.length === 0 ? (
          <div className="py-12 text-center">
            <FolderOpen className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--faint)" }} />
            <p className="text-sm" style={{ color: "var(--muted-mk)" }}>No documents uploaded</p>
            <p className="text-xs mt-1" style={{ color: "var(--faint)" }}>
              Upload your past quotes to extract market prices
            </p>
          </div>
        ) : (
          <div>
            {docs.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
