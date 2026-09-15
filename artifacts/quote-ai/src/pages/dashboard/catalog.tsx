import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Download, Loader2, BookOpen, Tag, Ruler, Euro, X, Check, Import } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useListCatalogItems,
  getListCatalogItemsQueryKey,
  useCreateCatalogItem,
  useUpdateCatalogItem,
  useDeleteCatalogItem,
  useImportCatalogFromQuotes,
  useGetSubscription,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import type { CatalogItem } from "@workspace/api-client-react";

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

  const handleOpenChange = (o: boolean) => {
    if (!o) { onClose(); }
  };

  const valid = form.nome.trim() && form.um.trim() && form.prezzoUnitario !== "" && !isNaN(Number(form.prezzoUnitario));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>{t("dashboard.catalog.form.descriptionLabel")}</Label>
            <Input
              placeholder={t("dashboard.catalog.form.descriptionPlaceholder")}
              value={form.nome}
              onChange={e => set("nome", e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("dashboard.catalog.form.unitLabel")}</Label>
              <Select value={form.um} onValueChange={v => set("um", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UM_OPTIONS.map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("dashboard.catalog.form.unitPriceLabel")}</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder={t("dashboard.catalog.form.unitPricePlaceholder")}
                value={form.prezzoUnitario}
                onChange={e => set("prezzoUnitario", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("dashboard.catalog.form.categoryLabel")}</Label>
            <Select value={form.categoria || "__none__"} onValueChange={v => set("categoria", v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder={t("dashboard.catalog.form.categoryPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("dashboard.catalog.form.noCategoryOption")}</SelectItem>
                {CATEGORIA_SUGGESTIONS.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("dashboard.catalog.form.notesLabel")}</Label>
            <Input
              placeholder={t("dashboard.catalog.form.notesPlaceholder")}
              value={form.note}
              onChange={e => set("note", e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>{t("dashboard.catalog.cancel")}</Button>
          <Button onClick={() => onSave(form)} disabled={!valid || isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {t("dashboard.catalog.form.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface OcrPreviewItem {
  nome: string;
  categoria: string | null;
  um: string;
  prezzoUnitario: number;
  note: string | null;
  selected: boolean;
}

function OcrImportDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [previewItems, setPreviewItems] = useState<OcrPreviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setPreviewItems(null);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleExtract = async () => {
    if (!file) return;
    setIsExtracting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const res = await fetch("/api/catalog/import-ocr", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("dashboard.catalog.ocr.readError"));
        return;
      }
      const items = data.items as Array<{ nome: string; categoria: string | null; um: string; prezzoUnitario: number; note: string | null }>;
      setPreviewItems(items.map(it => ({ ...it, selected: true })));
    } catch {
      setError(t("dashboard.catalog.ocr.connectionError"));
    } finally {
      setIsExtracting(false);
    }
  };

  const toggleItem = (index: number) => {
    setPreviewItems(prev => prev ? prev.map((it, i) => i === index ? { ...it, selected: !it.selected } : it) : prev);
  };

  const updateItemPrice = (index: number, value: string) => {
    const num = Number(value);
    setPreviewItems(prev => prev ? prev.map((it, i) => i === index ? { ...it, prezzoUnitario: isNaN(num) ? it.prezzoUnitario : num } : it) : prev);
  };

  const selectedCount = previewItems?.filter(it => it.selected).length ?? 0;

  const handleImport = async () => {
    if (!previewItems) return;
    const toImport = previewItems.filter(it => it.selected);
    if (toImport.length === 0) return;
    setIsImporting(true);
    try {
      const res = await fetch("/api/catalog/bulk", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toImport.map(({ selected, ...rest }) => rest)),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ title: t("dashboard.catalog.ocr.errorTitle"), description: data.error || t("dashboard.catalog.ocr.errorImportDesc"), variant: "destructive" });
        return;
      }
      onImported(toImport.length);
      handleClose();
    } catch {
      toast({ title: t("dashboard.catalog.ocr.errorConnectionTitle"), variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("dashboard.catalog.ocr.title")}</DialogTitle>
        </DialogHeader>

        {!previewItems ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {t("dashboard.catalog.ocr.uploadDesc")}
            </p>
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.docx,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={isExtracting}>{t("dashboard.catalog.cancel")}</Button>
              <Button onClick={handleExtract} disabled={!file || isExtracting} className="gap-2">
                {isExtracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Import className="h-4 w-4" />}
                {t("dashboard.catalog.ocr.extractItems")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {t("dashboard.catalog.ocr.foundItemsDesc").replace("{count}", String(previewItems.length))}
            </p>
            <div className="max-h-80 overflow-y-auto space-y-1 border rounded-lg divide-y">
              {previewItems.map((it, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={it.selected}
                    onChange={() => toggleItem(i)}
                    className="h-4 w-4 shrink-0 accent-violet-600"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{it.nome}</div>
                    <div className="text-xs text-muted-foreground">{it.categoria || t("dashboard.catalog.noCategory")} · {it.um}</div>
                  </div>
                  <Input
                    type="number"
                    step={0.01}
                    value={it.prezzoUnitario}
                    onChange={(e) => updateItemPrice(i, e.target.value)}
                    className="w-24 h-8 text-right shrink-0"
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={reset} disabled={isImporting}>{t("dashboard.catalog.ocr.back")}</Button>
              <Button onClick={handleImport} disabled={selectedCount === 0 || isImporting} className="gap-2">
                {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {t(selectedCount === 1 ? "dashboard.catalog.ocr.importSingular" : "dashboard.catalog.ocr.importPlural").replace("{count}", String(selectedCount))}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function CatalogPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: subscription } = useGetSubscription();
  const { data: items = [], isLoading } = useListCatalogItems();

  const createItem = useCreateCatalogItem();
  const updateItem = useUpdateCatalogItem();
  const deleteItem = useDeleteCatalogItem();
  const importFromQuotes = useImportCatalogFromQuotes();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isOcrOpen, setIsOcrOpen] = useState(false);

  const isPro = subscription?.isActive && subscription?.plan === "monthly_pro";

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

  const handleImport = () => {
    importFromQuotes.mutate(undefined, {
      onSuccess: (result) => {
        invalidate();
        if (result.imported === 0) {
          toast({ title: t("dashboard.catalog.toast.noNewItemsTitle"), description: t("dashboard.catalog.toast.noNewItemsDesc") });
        } else {
          toast({
            title: t("dashboard.catalog.toast.itemsImportedTitle").replace("{count}", String(result.imported)),
            description: result.skipped > 0 ? t("dashboard.catalog.toast.itemsSkippedDesc").replace("{count}", String(result.skipped)) : undefined,
          });
        }
      },
      onError: () => toast({ title: t("dashboard.catalog.toast.errorImportTitle"), variant: "destructive" }),
    });
  };

  const noCategoryLabel = t("dashboard.catalog.noCategory");
  const groupedByCategory = items.reduce<Record<string, CatalogItem[]>>((acc, item) => {
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
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <BookOpen className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-foreground">{t("dashboard.catalog.proOnly.title")}</h2>
        <p className="text-muted-foreground max-w-md">
          {t("dashboard.catalog.proOnly.desc")}
        </p>
        <Button onClick={() => window.location.href = "/dashboard/settings?tab=billing"} className="gap-2 mt-2">
          {t("dashboard.catalog.proOnly.cta")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("dashboard.nav.catalog")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("dashboard.catalog.header.subtitle")}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleImport}
            disabled={importFromQuotes.isPending}
          >
            {importFromQuotes.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Download className="h-4 w-4" />}
            {t("dashboard.catalog.importFromQuotes")}
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setIsOcrOpen(true)}>
            <Import className="h-4 w-4" />
            {t("dashboard.catalog.importFromPhotoPdf")}
          </Button>
          <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("dashboard.catalog.addItem")}
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">{t("dashboard.catalog.empty.title")}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("dashboard.catalog.empty.desc")}
              </p>
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" className="gap-2" onClick={handleImport} disabled={importFromQuotes.isPending}>
                {importFromQuotes.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {t("dashboard.catalog.importFromQuotes")}
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => setIsOcrOpen(true)}>
                <Import className="h-4 w-4" />
                {t("dashboard.catalog.importFromPhotoPdf")}
              </Button>
              <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                {t("dashboard.catalog.addItem")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="text-2xl font-bold">{items.length}</div>
              <div className="text-sm text-muted-foreground">{t("dashboard.catalog.summary.totalItems")}</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-bold">{categories.filter(c => c !== noCategoryLabel).length}</div>
              <div className="text-sm text-muted-foreground">{t("dashboard.catalog.summary.categories")}</div>
            </Card>
            <Card className="p-4 col-span-2 sm:col-span-1">
              <div className="text-2xl font-bold">
                {formatCurrency(items.reduce((s, i) => s + i.prezzoUnitario, 0) / items.length)}
              </div>
              <div className="text-sm text-muted-foreground">{t("dashboard.catalog.summary.avgPrice")}</div>
            </Card>
          </div>

          {/* Items by category */}
          {categories.map(cat => (
            <Card key={cat}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Tag className="h-4 w-4 text-violet-500" />
                  {cat}
                  <Badge variant="secondary" className="ml-auto">{groupedByCategory[cat].length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {groupedByCategory[cat].map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-6 py-3 hover:bg-accent transition-colors group">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{item.nome}</div>
                        {item.note && <div className="text-xs text-muted-foreground truncate">{item.note}</div>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-xs font-mono">
                          <Ruler className="h-3 w-3 mr-1 opacity-60" />
                          {item.um}
                        </Badge>
                        <span className="text-sm font-semibold text-green-700 min-w-[80px] text-right">
                          {formatCurrency(item.prezzoUnitario)}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setEditingItem(item)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setDeletingId(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <ItemFormDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        initial={EMPTY_FORM}
        onSave={handleCreate}
        isSaving={createItem.isPending}
        title={t("dashboard.catalog.dialog.addTitle")}
      />

      {/* Edit dialog */}
      {editingItem && (
        <ItemFormDialog
          open={!!editingItem}
          onClose={() => setEditingItem(null)}
          initial={{
            nome: editingItem.nome,
            categoria: editingItem.categoria ?? "",
            um: editingItem.um,
            prezzoUnitario: String(editingItem.prezzoUnitario),
            note: editingItem.note ?? "",
          }}
          onSave={handleUpdate}
          isSaving={updateItem.isPending}
          title={t("dashboard.catalog.dialog.editTitle")}
        />
      )}

      {/* OCR import dialog */}
      <OcrImportDialog
        open={isOcrOpen}
        onClose={() => setIsOcrOpen(false)}
        onImported={(count) => {
          invalidate();
          toast({ title: t(count === 1 ? "dashboard.catalog.ocr.importedSingular" : "dashboard.catalog.ocr.importedPlural").replace("{count}", String(count)) });
        }}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={o => { if (!o) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dashboard.catalog.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("dashboard.catalog.delete.desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dashboard.catalog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteItem.isPending}
            >
              {deleteItem.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("dashboard.catalog.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
