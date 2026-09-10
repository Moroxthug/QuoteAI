import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, Pencil, Trash2, Download, Loader2, BookOpen, Tag, Ruler,
  Euro, X, Check, Upload, AlertCircle, Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  useListCatalogItems, getListCatalogItemsQueryKey, useCreateCatalogItem,
  useUpdateCatalogItem, useDeleteCatalogItem, useBulkCreateCatalogItems,
  useGetSubscription
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import type { CatalogItem } from "@workspace/api-client-react";
import { useLanguage } from "@/i18n/LanguageContext";

const UM_OPTIONS = ["mq", "ml", "mc", "cad", "ore", "kg", "a.c.", "pezzi", "kw", "lt", "t", "m", "%"];

function useCategoriaSuggestions() {
  const { t } = useLanguage();
  return [
    t("dashboard.catalog.category.painting"),
    t("dashboard.catalog.category.demolition"),
    t("dashboard.catalog.category.construction"),
    t("dashboard.catalog.category.electrical"),
    t("dashboard.catalog.category.plumbing"),
    t("dashboard.catalog.category.flooring"),
    t("dashboard.catalog.category.wallCladding"),
    t("dashboard.catalog.category.doorsWindows"),
    t("dashboard.catalog.category.insulation"),
    t("dashboard.catalog.category.carpentry"),
    t("dashboard.catalog.category.labor"),
    t("dashboard.catalog.category.other"),
  ];
}

interface ItemFormData {
  nome: string;
  categoria: string;
  um: string;
  prezzoUnitario: string;
  note: string;
}

const EMPTY_FORM: ItemFormData = {
  nome: "",
  categoria: "",
  um: "cad",
  prezzoUnitario: "",
  note: "",
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);
}

interface ParsedItem {
  nome: string;
  categoria?: string;
  um: string;
  prezzoUnitario: number;
  note?: string;
}

export function PriceCatalogSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useLanguage();

  const { data: subscription } = useGetSubscription();
  const { data: items = [], isLoading } = useListCatalogItems();

  const createItem = useCreateCatalogItem();
  const updateItem = useUpdateCatalogItem();
  const deleteItem = useDeleteCatalogItem();
  const bulkCreate = useBulkCreateCatalogItems();

  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // CSV parsing state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvPreview, setCsvPreview] = useState<ParsedItem[] | null>(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvError, setCsvError] = useState("");

  const isPro = subscription?.isActive && (subscription?.plan === "monthly_pro" || subscription?.plan === "monthly_elite");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListCatalogItemsQueryKey() });

  const handleCreate = (form: ItemFormData) => {
    createItem.mutate({
      data: {
        nome: form.nome.trim(),
        categoria: form.categoria.trim() || undefined,
        um: form.um.trim(),
        prezzoUnitario: Number(form.prezzoUnitario),
        note: form.note.trim() || undefined,
      }
    }, {
      onSuccess: () => {
        setIsCreateOpen(false);
        invalidate();
        toast({ title: t("dashboard.catalog.toast.itemAdded") });
      },
      onError: () => toast({ title: t("dashboard.catalog.toast.errorTitle"), description: t("dashboard.catalog.toast.errorAddDesc"), variant: "destructive" }),
    });
  };

  const handleUpdate = (form: ItemFormData) => {
    if (!editingItem) return;
    updateItem.mutate({
      id: editingItem.id,
      data: {
        nome: form.nome.trim(),
        categoria: form.categoria.trim() || undefined,
        um: form.um.trim(),
        prezzoUnitario: Number(form.prezzoUnitario),
        note: form.note.trim() || undefined,
      }
    }, {
      onSuccess: () => {
        setEditingItem(null);
        invalidate();
        toast({ title: t("dashboard.catalog.toast.itemUpdated") });
      },
      onError: () => toast({ title: t("dashboard.catalog.toast.errorTitle"), description: t("dashboard.catalog.toast.errorUpdateDesc"), variant: "destructive" }),
    });
  };

  const handleDelete = () => {
    if (!deletingId) return;
    deleteItem.mutate({ id: deletingId }, {
      onSuccess: () => {
        setDeletingId(null);
        invalidate();
        toast({ title: t("dashboard.catalog.toast.itemDeleted") });
      },
      onError: () => toast({ title: t("dashboard.catalog.toast.errorTitle"), description: t("dashboard.catalog.toast.errorDeleteDesc"), variant: "destructive" }),
    });
  };

  const handleCsvSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    setCsvError("");
    setCsvPreview(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setCsvError(t("catalog.csv.errorEmptyFile"));
        return;
      }

      try {
        const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
        if (lines.length < 2) {
          setCsvError(t("catalog.csv.errorNeedsHeaderAndData"));
          return;
        }

        // Detect delimiter: comma vs semicolon
        const firstLine = lines[0]!;
        const commaCount = (firstLine.match(/,/g) || []).length;
        const semiCount = (firstLine.match(/;/g) || []).length;
        const delimiter = semiCount > commaCount ? ";" : ",";

        // Helper to parse CSV row respecting quotes
        const parseCSVRow = (rowText: string): string[] => {
          const result: string[] = [];
          let current = "";
          let inQuotes = false;
          for (let i = 0; i < rowText.length; i++) {
            const char = rowText[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === delimiter && !inQuotes) {
              result.push(current.trim());
              current = "";
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };

        const headers = parseCSVRow(firstLine).map(h => h.toLowerCase().replace(/["']/g, "").trim());

        // Find column indices
        const nameIdx = headers.findIndex(h => h.includes("lavorazione") || h.includes("nome") || h.includes("descrizione") || h.includes("voce") || h === "item" || h === "name");
        const categoryIdx = headers.findIndex(h => h.includes("categoria") || h.includes("category"));
        const umIdx = headers.findIndex(h => h.includes("um") || h.includes("unità") || h.includes("unita") || h.includes("misura") || h === "unit");
        const priceIdx = headers.findIndex(h => h.includes("prezzo") || h.includes("tariffa") || h.includes("unitario") || h === "price" || h === "rate");
        const noteIdx = headers.findIndex(h => h.includes("note") || h.includes("desc") || h.includes("dettagli"));

        if (nameIdx === -1 || priceIdx === -1) {
          setCsvError(t("catalog.csv.errorMissingColumns"));
          return;
        }

        const parsedItems: ParsedItem[] = [];

        for (let i = 1; i < lines.length; i++) {
          const cells = parseCSVRow(lines[i]!);
          if (cells.length < Math.max(nameIdx, priceIdx) + 1) continue;

          const nome = cells[nameIdx]?.replace(/["']/g, "").trim() || "";
          const rawPrice = cells[priceIdx]?.replace(/["']/g, "").replace(",", ".").trim() || "";
          const prezzoUnitario = Number(rawPrice);

          if (!nome || isNaN(prezzoUnitario)) continue;

          const categoria = categoryIdx !== -1 ? cells[categoryIdx]?.replace(/["']/g, "").trim() : undefined;
          const rawUm = umIdx !== -1 ? cells[umIdx]?.replace(/["']/g, "").trim() : "";
          const um = UM_OPTIONS.includes(rawUm.toLowerCase()) ? rawUm.toLowerCase() : "cad";
          const note = noteIdx !== -1 ? cells[noteIdx]?.replace(/["']/g, "").trim() : undefined;

          parsedItems.push({
            nome,
            categoria: categoria || undefined,
            um,
            prezzoUnitario,
            note: note || undefined,
          });
        }

        if (parsedItems.length === 0) {
          setCsvError(t("catalog.csv.errorNoValidItems"));
          return;
        }

        setCsvPreview(parsedItems);
      } catch (err) {
        setCsvError(t("catalog.csv.errorReadingFile"));
      }
    };

    reader.readAsText(file);
  };

  const handleBulkUpload = () => {
    if (!csvPreview || csvPreview.length === 0) return;
    bulkCreate.mutate({
      data: csvPreview
    }, {
      onSuccess: (res) => {
        invalidate();
        toast({
          title: t("catalog.csv.importCompleteTitle"),
          description: t("catalog.csv.importCompleteDesc").replace("{count}", String(res.length)),
        });
        setCsvPreview(null);
        setCsvFileName("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
      onError: () => {
        toast({
          title: t("dashboard.catalog.toast.errorTitle"),
          description: t("catalog.csv.errorImportFailed"),
          variant: "destructive",
        });
      }
    });
  };

  const filteredItems = items.filter(item => {
    const q = searchQuery.toLowerCase();
    return (
      item.nome.toLowerCase().includes(q) ||
      (item.categoria?.toLowerCase() || "").includes(q) ||
      (item.note?.toLowerCase() || "").includes(q)
    );
  });

  const noCategoryLabel = t("dashboard.catalog.noCategory");

  const groupedByCategory = filteredItems.reduce<Record<string, CatalogItem[]>>((acc, item) => {
    const cat = item.categoria ?? noCategoryLabel;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const categories = Object.keys(groupedByCategory).sort((a, b) => {
    if (a === noCategoryLabel) return 1;
    if (b === noCategoryLabel) return -1;
    return a.localeCompare(b);
  });

  if (!isPro) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <BookOpen className="h-12 w-12 text-gray-300 animate-pulse" />
        <h2 className="text-xl font-semibold text-gray-700">{t("dashboard.catalog.proOnly.title")}</h2>
        <p className="text-gray-500 max-w-md text-sm leading-relaxed">
          {t("dashboard.catalog.proOnly.desc")}
        </p>
        <Button onClick={() => window.location.href = "/dashboard/settings?tab=billing"} className="gap-2 mt-2 font-semibold">
          {t("dashboard.catalog.proOnly.cta")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload & CSV Action Card */}
      <Card className="border border-violet-100 bg-gradient-to-br from-white to-violet-50/20 shadow-sm overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Upload className="h-4 w-4 text-violet-500" />
            {t("catalog.csv.importTitle")}
          </CardTitle>
          <CardDescription className="text-xs">
            {t("catalog.csv.importDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleCsvSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-violet-200 hover:bg-violet-55 text-violet-750"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {t("catalog.csv.chooseFile")}
            </Button>
            {csvFileName && (
              <span className="text-xs font-medium text-gray-600 truncate max-w-xs bg-gray-100 px-2.5 py-1 rounded-md border">
                {csvFileName}
              </span>
            )}
            {csvPreview && (
              <Button
                size="sm"
                className="gap-2 bg-green-600 hover:bg-green-700 text-white shadow-sm ml-auto"
                onClick={handleBulkUpload}
                disabled={bulkCreate.isPending}
              >
                {bulkCreate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {t("catalog.csv.confirmImport").replace("{count}", String(csvPreview.length))}
              </Button>
            )}
          </div>

          {csvError && (
            <div className="flex items-center gap-2 text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {csvError}
            </div>
          )}

          {/* CSV Preview */}
          {csvPreview && (
            <div className="border rounded-lg bg-white overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-gray-50 border-b font-semibold text-gray-700 sticky top-0">
                  <tr>
                    <th className="p-2 border-r">{t("catalog.csv.colItem")}</th>
                    <th className="p-2 border-r w-32">{t("catalog.csv.colCategory")}</th>
                    <th className="p-2 border-r w-16 text-center">{t("catalog.csv.colUnit")}</th>
                    <th className="p-2 w-28 text-right">{t("catalog.csv.colPrice")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-gray-600">
                  {csvPreview.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="p-2 border-r truncate max-w-xs">{row.nome}</td>
                      <td className="p-2 border-r truncate">{row.categoria || "-"}</td>
                      <td className="p-2 border-r text-center font-mono">{row.um}</td>
                      <td className="p-2 text-right font-semibold text-green-700">{formatCurrency(row.prezzoUnitario)}</td>
                    </tr>
                  ))}
                  {csvPreview.length > 10 && (
                    <tr className="bg-gray-50/50">
                      <td colSpan={4} className="p-2 text-center text-gray-400 italic">
                        {t("catalog.csv.andMoreItems").replace("{count}", String(csvPreview.length - 10))}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main List Management */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder={t("catalog.searchPlaceholder")}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Button size="sm" className="gap-2 shrink-0 h-9" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("dashboard.catalog.addItem")}
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        ) : filteredItems.length === 0 ? (
          <Card className="border-dashed py-12 text-center">
            <CardContent className="flex flex-col items-center justify-center gap-3">
              <BookOpen className="h-8 w-8 text-gray-300" />
              <div className="text-sm font-semibold text-gray-600">{t("catalog.noItemsFound")}</div>
              <div className="text-xs text-gray-400">{t("catalog.noItemsFoundDesc")}</div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {categories.map(cat => (
              <Card key={cat} className="shadow-sm border border-gray-150 overflow-hidden">
                <CardHeader className="py-2.5 px-4 bg-gray-50/50 border-b">
                  <CardTitle className="text-xs font-bold text-gray-700 flex items-center gap-1.5 uppercase tracking-wide">
                    <Tag className="h-3.5 w-3.5 text-violet-500" />
                    {cat}
                    <Badge variant="secondary" className="ml-auto font-mono text-[10px] py-0 px-1.5">{groupedByCategory[cat].length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 divide-y">
                  {groupedByCategory[cat].map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50/50 transition-colors group">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-xs text-gray-800 truncate">{item.nome}</div>
                        {item.note && <div className="text-[10px] text-gray-400 truncate mt-0.5">{item.note}</div>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px] font-mono h-5 px-1.5">
                          <Ruler className="h-2.5 w-2.5 mr-1 opacity-60" />
                          {item.um}
                        </Badge>
                        <span className="text-xs font-bold text-green-700 min-w-[70px] text-right">
                          {formatCurrency(item.prezzoUnitario)}
                        </span>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 rounded-md"
                            onClick={() => setEditingItem(item)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setDeletingId(item.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Item Form Dialog */}
      {(isCreateOpen || editingItem) && (
        <ItemFormDialog
          open={isCreateOpen || !!editingItem}
          onClose={() => {
            setIsCreateOpen(false);
            setEditingItem(null);
          }}
          initial={
            editingItem
              ? {
                  nome: editingItem.nome,
                  categoria: editingItem.categoria ?? "",
                  um: editingItem.um,
                  prezzoUnitario: String(editingItem.prezzoUnitario),
                  note: editingItem.note ?? "",
                }
              : EMPTY_FORM
          }
          onSave={editingItem ? handleUpdate : handleCreate}
          isSaving={createItem.isPending || updateItem.isPending}
          title={editingItem ? t("dashboard.catalog.dialog.editTitle") : t("dashboard.catalog.dialog.addTitle")}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deletingId} onOpenChange={o => { if (!o) setDeletingId(null); }}>
        <AlertDialogContent className="sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold">{t("dashboard.catalog.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {t("dashboard.catalog.delete.desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2.5">
            <AlertDialogCancel className="text-xs h-8">{t("dashboard.catalog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-xs h-8 text-white"
              disabled={deleteItem.isPending}
            >
              {deleteItem.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              {t("dashboard.catalog.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ItemFormDialog({
  open,
  onClose,
  initial,
  onSave,
  isSaving,
  title,
}: {
  open: boolean;
  onClose: () => void;
  initial: ItemFormData;
  onSave: (data: ItemFormData) => void;
  isSaving: boolean;
  title: string;
}) {
  const { t } = useLanguage();
  const CATEGORIA_SUGGESTIONS = useCategoriaSuggestions();
  const [form, setForm] = useState<ItemFormData>(initial);
  const set = (k: keyof ItemFormData, v: string) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.nome.trim() && form.um.trim() && form.prezzoUnitario !== "" && !isNaN(Number(form.prezzoUnitario));

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1 text-xs">
          <div className="space-y-1">
            <Label className="text-xs">{t("dashboard.catalog.form.descriptionLabel")}</Label>
            <Input
              placeholder={t("dashboard.catalog.form.descriptionPlaceholder")}
              value={form.nome}
              onChange={e => set("nome", e.target.value)}
              className="h-8.5 text-xs"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t("dashboard.catalog.form.unitLabel")}</Label>
              <Select value={form.um} onValueChange={v => set("um", v)}>
                <SelectTrigger className="h-8.5 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UM_OPTIONS.map(u => (
                    <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("dashboard.catalog.form.unitPriceLabel")}</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder={t("dashboard.catalog.form.unitPricePlaceholder")}
                value={form.prezzoUnitario}
                onChange={e => set("prezzoUnitario", e.target.value)}
                className="h-8.5 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">{t("dashboard.catalog.form.categoryLabel")}</Label>
            <Select value={form.categoria || "__none__"} onValueChange={v => set("categoria", v === "__none__" ? "" : v)}>
              <SelectTrigger className="h-8.5 text-xs">
                <SelectValue placeholder={t("dashboard.catalog.form.categoryPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" className="text-xs">{t("dashboard.catalog.form.noCategoryOption")}</SelectItem>
                {CATEGORIA_SUGGESTIONS.map(c => (
                  <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">{t("dashboard.catalog.form.notesLabel")}</Label>
            <Input
              placeholder={t("dashboard.catalog.form.notesPlaceholder")}
              value={form.note}
              onChange={e => set("note", e.target.value)}
              className="h-8.5 text-xs"
            />
          </div>
        </div>
        <DialogFooter className="mt-3 gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSaving} className="text-xs h-8">{t("dashboard.catalog.cancel")}</Button>
          <Button onClick={() => onSave(form)} disabled={!valid || isSaving} className="gap-1.5 text-xs h-8">
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {t("dashboard.catalog.form.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
