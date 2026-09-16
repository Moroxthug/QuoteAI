import { useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

function StatusBadge({ status }: { status: UploadedDocument["status"] }) {
  if (status === "done") return (
    <Badge className="gap-1 bg-green-100 text-green-700 border-0">
      <CheckCircle2 className="h-3 w-3" /> Processed
    </Badge>
  );
  if (status === "processing") return (
    <Badge className="gap-1 bg-blue-100 text-blue-700 border-0 animate-pulse">
      <Loader2 className="h-3 w-3 animate-spin" /> Processing...
    </Badge>
  );
  if (status === "error") return (
    <Badge className="gap-1 bg-red-100 text-red-700 border-0">
      <AlertCircle className="h-3 w-3" /> Error
    </Badge>
  );
  return (
    <Badge className="gap-1 bg-muted text-muted-foreground border-0">
      <Clock className="h-3 w-3" /> Queued
    </Badge>
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
    <div className="border border-border rounded-[var(--radius)] p-4 bg-card hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-[var(--radius-sm)] bg-muted border border-border flex items-center justify-center shrink-0">
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

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground truncate max-w-xs">{doc.fileName}</p>
            <StatusBadge status={doc.status} />
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</span>
            {doc.fileSize && (
              <span className="text-xs text-muted-foreground">{formatFileSize(doc.fileSize)}</span>
            )}
            {doc.status === "done" && lavorazioni.length > 0 && (
              <span className="text-xs text-green-600 font-medium">{lavorazioni.length} items extracted</span>
            )}
          </div>
          {doc.errorMessage && (
            <p className="text-xs text-red-500 mt-1">{doc.errorMessage}</p>
          )}

          {doc.status === "done" && lavorazioni.length > 0 && (
            <button
              className="mt-2 flex items-center gap-1 text-xs text-navy-600 hover:text-navy-800 font-medium"
              onClick={() => setExpanded(v => !v)}
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Hide items" : "Show extracted items"}
            </button>
          )}

          {expanded && lavorazioni.length > 0 && (
            <div className="mt-2 rounded-[var(--radius-sm)] bg-muted border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/60">
                    <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground">Work item</th>
                    <th className="text-right px-3 py-1.5 font-semibold text-muted-foreground">Price</th>
                    <th className="text-right px-3 py-1.5 font-semibold text-muted-foreground">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {lavorazioni.map((l, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-3 py-1.5 text-foreground">{l.tipo}</td>
                      <td className="px-3 py-1.5 text-right text-foreground font-medium">{formatCurrency(l.prezzoUnitario)}</td>
                      <td className="px-3 py-1.5 text-right text-muted-foreground">{l.um || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {(doc.status === "pending" || doc.status === "error") && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => extractMut.mutate({ id: doc.id })}
              disabled={extractMut.isPending}
            >
              {extractMut.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Zap className="h-3 w-3 text-navy-500" />
              )}
              Process
            </Button>
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
    <Card className="border-amber-200 bg-amber-50/40">
      <CardHeader className="pb-2 pt-4 px-5">
        <CardTitle className="text-base font-semibold flex items-center gap-2 text-amber-800">
          <TrendingUp className="h-4 w-4 text-amber-600" />
          Price trend alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4 space-y-2">
        {alerts.map((alert) => (
          <div key={alert.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-amber-100 bg-card p-3">
            <div className="flex items-center gap-2 min-w-0">
              {alert.direction === "up" ? (
                <TrendingUp className="h-4 w-4 text-red-500 shrink-0" />
              ) : (
                <TrendingDown className="h-4 w-4 text-green-600 shrink-0" />
              )}
              <p className="text-sm text-foreground truncate">
                <span className="font-semibold">{alert.workType}</span>
                {alert.zone && <span className="text-muted-foreground"> in {alert.zone}</span>} is{" "}
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
      </CardContent>
    </Card>
  );
}

function PriceComparison() {
  const { data } = useGetPriceComparison();
  const comparisons = data?.comparisons ?? [];

  if (comparisons.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-5">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Scale className="h-4 w-4 text-navy-500" />
          Cross-supplier comparison
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4 space-y-3">
        {comparisons.map((group) => {
          const cheapest = group.vendors[0];
          return (
            <div key={`${group.workType}::${group.zone ?? ""}`} className="rounded-[var(--radius-sm)] border border-border p-3">
              <p className="text-xs font-semibold text-foreground">
                {group.workType}
                {group.zone && <span className="text-muted-foreground font-normal"> — {group.zone}</span>}
              </p>
              <div className="mt-2 space-y-1">
                {group.vendors.map((v) => (
                  <div key={v.vendor} className="flex items-center justify-between text-xs">
                    <span className={cn("text-muted-foreground", v.vendor === cheapest.vendor && "font-semibold text-green-700")}>
                      {v.vendor}
                    </span>
                    <span className="text-muted-foreground">
                      {formatCurrency(v.avgPrice)}
                      {group.unit && `/${group.unit}`}
                      <span className="text-muted-foreground ml-1">({v.count})</span>
                    </span>
                  </div>
                ))}
              </div>
              {group.vendors.length >= 2 && group.vendors[group.vendors.length - 1].avgPrice > cheapest.avgPrice && (
                <p className="text-[10px] text-navy-600 mt-1.5">
                  You're paying more at {group.vendors[group.vendors.length - 1].vendor} than at {cheapest.vendor} for the same work.
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2"><FolderOpen className="h-7 w-7 text-navy-500" />Quote Archive</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Upload existing quotes to extract your market prices and improve AI estimates.
        </p>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          "border-2 border-dashed rounded-[var(--radius)] p-8 text-center transition-colors cursor-pointer",
          isDragging ? "border-navy-400 bg-navy-50" : "border-border bg-muted/50 hover:border-navy-300 hover:bg-navy-50/30"
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex flex-col items-center gap-3">
          {uploadMut.isPending ? (
            <Loader2 className="h-8 w-8 text-navy-400 animate-spin" />
          ) : (
            <div className="h-12 w-12 rounded-[var(--radius-sm)] bg-navy-100 flex items-center justify-center">
              <Upload className="h-5 w-5 text-navy-600" />
            </div>
          )}
          <div>
            <p className="font-semibold text-foreground text-sm">
              {uploadMut.isPending ? "Uploading..." : "Drag files here or click to select"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, DOCX, XLSX, JPG, PNG o WEBP — max 10 MB per file
            </p>
          </div>
        </div>
      </div>

      {/* Price intelligence banner */}
      {doneCount > 0 && (
        <Card className={cn(
          "border",
          hasEnoughForIntelligence ? "border-navy-200 bg-navy-50/40" : "border-amber-200 bg-amber-50/40"
        )}>
          <CardContent className="py-4 px-5 flex items-center gap-3">
            <div className={cn(
              "h-9 w-9 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0",
              hasEnoughForIntelligence ? "bg-navy-100" : "bg-amber-100"
            )}>
              <TrendingUp className={cn("h-4 w-4", hasEnoughForIntelligence ? "text-navy-600" : "text-amber-600")} />
            </div>
            <div>
              {hasEnoughForIntelligence ? (
                <>
                  <p className="text-sm font-semibold text-navy-800">Price intelligence active</p>
                  <p className="text-xs text-navy-600 mt-0.5">
                    {doneCount} documents processed — your average prices are now used in new AI quotes.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-amber-800">Almost ready ({doneCount}/3 documents)</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Process at least 3 documents to activate price intelligence in AI quotes.
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <PriceAlerts />

      <PriceComparison />

      {/* Price summary */}
      {priceSummary && priceSummary.items.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-navy-500" />
              Average extracted prices
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {priceSummary.items.slice(0, 12).map((item) => (
                <div key={item.workType} className="rounded-[var(--radius-sm)] border border-border bg-muted/50 p-3">
                  <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2">{item.workType}</p>
                  <p className="text-lg font-bold text-navy-700 mt-1">
                    {formatCurrency(item.avgUnitPrice)}
                    {item.unit && <span className="text-xs font-normal text-muted-foreground ml-1">/{item.unit}</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">
                      {formatCurrency(item.minPrice)} – {formatCurrency(item.maxPrice)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">({item.count} docs)</span>
                  </div>
                  {item.zones && item.zones.length > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{item.zones.join(", ")}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document list */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            Uploaded documents
            {docs.length > 0 && (
              <Badge className="bg-muted text-muted-foreground border-0 text-xs">{docs.length}</Badge>
            )}
          </CardTitle>
          {pendingCount > 0 && (
            <span className="text-xs text-amber-600">{pendingCount} pending processing</span>
          )}
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : docs.length === 0 ? (
            <div className="py-12 text-center">
              <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No documents uploaded</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload your past quotes to extract market prices
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map((doc) => (
                <DocumentRow key={doc.id} doc={doc} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
