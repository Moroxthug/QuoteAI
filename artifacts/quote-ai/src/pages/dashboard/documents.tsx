import { useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderOpen, Upload, Loader2, CheckCircle2, AlertCircle, Clock, Trash2, Zap, FileText, ImageIcon, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import {
  useListDocuments,
  useUploadDocument,
  useExtractDocument,
  useDeleteDocument,
  useGetPriceSummary,
  getListDocumentsQueryKey,
  getGetPriceSummaryQueryKey,
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
  new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));

function StatusBadge({ status }: { status: UploadedDocument["status"] }) {
  if (status === "done") return (
    <Badge className="gap-1 bg-green-100 text-green-700 border-0">
      <CheckCircle2 className="h-3 w-3" /> Elaborato
    </Badge>
  );
  if (status === "processing") return (
    <Badge className="gap-1 bg-blue-100 text-blue-700 border-0 animate-pulse">
      <Loader2 className="h-3 w-3 animate-spin" /> Elaborazione...
    </Badge>
  );
  if (status === "error") return (
    <Badge className="gap-1 bg-red-100 text-red-700 border-0">
      <AlertCircle className="h-3 w-3" /> Errore
    </Badge>
  );
  return (
    <Badge className="gap-1 bg-gray-100 text-gray-500 border-0">
      <Clock className="h-3 w-3" /> In coda
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
        toast({ title: "Elaborazione completata" });
      },
      onError: () => toast({ title: "Errore durante l'elaborazione", variant: "destructive" }),
    },
  });

  const deleteMut = useDeleteDocument({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetPriceSummaryQueryKey() });
      },
      onError: () => toast({ title: "Errore durante l'eliminazione", variant: "destructive" }),
    },
  });

  const isPdf = doc.mimeType === "application/pdf";
  const isDocx = doc.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const isXlsx = doc.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const lavorazioni = (doc.extractedData as { lavorazioni?: Array<{ tipo: string; prezzoUnitario: number; um?: string | null; zona?: string | null }> } | null)?.lavorazioni ?? [];

  return (
    <div className="border border-gray-100 rounded-xl p-4 bg-white hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
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
            <p className="text-sm font-medium text-gray-800 truncate max-w-xs">{doc.fileName}</p>
            <StatusBadge status={doc.status} />
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-gray-400">{formatDate(doc.createdAt)}</span>
            {doc.fileSize && (
              <span className="text-xs text-gray-400">{formatFileSize(doc.fileSize)}</span>
            )}
            {doc.status === "done" && lavorazioni.length > 0 && (
              <span className="text-xs text-green-600 font-medium">{lavorazioni.length} voci estratte</span>
            )}
          </div>
          {doc.errorMessage && (
            <p className="text-xs text-red-500 mt-1">{doc.errorMessage}</p>
          )}

          {doc.status === "done" && lavorazioni.length > 0 && (
            <button
              className="mt-2 flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-medium"
              onClick={() => setExpanded(v => !v)}
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Nascondi voci" : "Mostra voci estratte"}
            </button>
          )}

          {expanded && lavorazioni.length > 0 && (
            <div className="mt-2 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-100/60">
                    <th className="text-left px-3 py-1.5 font-semibold text-gray-600">Lavorazione</th>
                    <th className="text-right px-3 py-1.5 font-semibold text-gray-600">Prezzo</th>
                    <th className="text-right px-3 py-1.5 font-semibold text-gray-600">UM</th>
                  </tr>
                </thead>
                <tbody>
                  {lavorazioni.map((l, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="px-3 py-1.5 text-gray-700">{l.tipo}</td>
                      <td className="px-3 py-1.5 text-right text-gray-700 font-medium">{formatCurrency(l.prezzoUnitario)}</td>
                      <td className="px-3 py-1.5 text-right text-gray-400">{l.um || "—"}</td>
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
                <Zap className="h-3 w-3 text-violet-500" />
              )}
              Elabora
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-gray-400 hover:text-red-500"
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
        toast({ title: "Documento caricato — clicca Elabora per estrarre i prezzi" });
      },
      onError: (err) => {
        const msg = err instanceof Error ? err.message : "Errore caricamento";
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
        <h1 className="text-2xl font-bold tracking-tight">Archivio Preventivi</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Carica preventivi esistenti per estrarre i tuoi prezzi di mercato e migliorare le stime AI.
        </p>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
          isDragging ? "border-violet-400 bg-violet-50" : "border-gray-200 bg-gray-50/50 hover:border-violet-300 hover:bg-violet-50/30"
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
            <Loader2 className="h-8 w-8 text-violet-400 animate-spin" />
          ) : (
            <div className="h-12 w-12 rounded-xl bg-violet-100 flex items-center justify-center">
              <Upload className="h-5 w-5 text-violet-600" />
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-800 text-sm">
              {uploadMut.isPending ? "Caricamento in corso..." : "Trascina i file qui o clicca per selezionare"}
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
          hasEnoughForIntelligence ? "border-violet-200 bg-violet-50/40" : "border-amber-200 bg-amber-50/40"
        )}>
          <CardContent className="py-4 px-5 flex items-center gap-3">
            <div className={cn(
              "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
              hasEnoughForIntelligence ? "bg-violet-100" : "bg-amber-100"
            )}>
              <TrendingUp className={cn("h-4 w-4", hasEnoughForIntelligence ? "text-violet-600" : "text-amber-600")} />
            </div>
            <div>
              {hasEnoughForIntelligence ? (
                <>
                  <p className="text-sm font-semibold text-violet-800">Price intelligence attiva</p>
                  <p className="text-xs text-violet-600 mt-0.5">
                    {doneCount} documenti elaborati — i tuoi prezzi medi vengono usati nei nuovi preventivi AI.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-amber-800">Quasi pronto ({doneCount}/3 documenti)</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Elabora almeno 3 documenti per attivare la price intelligence nei preventivi AI.
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Price summary */}
      {priceSummary && priceSummary.items.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-violet-500" />
              Prezzi medi estratti
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {priceSummary.items.slice(0, 12).map((item) => (
                <div key={item.workType} className="rounded-lg border border-gray-100 bg-gray-50/50 p-3">
                  <p className="text-xs font-semibold text-gray-700 leading-tight line-clamp-2">{item.workType}</p>
                  <p className="text-lg font-bold text-violet-700 mt-1">
                    {formatCurrency(item.avgUnitPrice)}
                    {item.unit && <span className="text-xs font-normal text-gray-400 ml-1">/{item.unit}</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-400">
                      {formatCurrency(item.minPrice)} – {formatCurrency(item.maxPrice)}
                    </span>
                    <span className="text-[10px] text-gray-400">({item.count} doc)</span>
                  </div>
                  {item.zones && item.zones.length > 0 && (
                    <p className="text-[10px] text-gray-400 mt-0.5 truncate">{item.zones.join(", ")}</p>
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
            <FolderOpen className="h-4 w-4 text-gray-400" />
            Documenti caricati
            {docs.length > 0 && (
              <Badge className="bg-gray-100 text-gray-500 border-0 text-xs">{docs.length}</Badge>
            )}
          </CardTitle>
          {pendingCount > 0 && (
            <span className="text-xs text-amber-600">{pendingCount} in attesa di elaborazione</span>
          )}
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
            </div>
          ) : docs.length === 0 ? (
            <div className="py-12 text-center">
              <FolderOpen className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nessun documento caricato</p>
              <p className="text-xs text-muted-foreground mt-1">
                Carica i tuoi preventivi precedenti per estrarre i prezzi di mercato
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
