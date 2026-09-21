import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Download, Loader2, BookOpen, Search, Check, Import, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="field">
            <label>{t("dashboard.catalog.form.descriptionLabel")}</label>
            <input placeholder={t("dashboard.catalog.form.descriptionPlaceholder")} value={form.nome} onChange={e => set("nome", e.target.value)} autoFocus />
          </div>
          <div className="form-grid">
            <div className="field">
              <label>{t("dashboard.catalog.form.unitLabel")}</label>
              <select value={form.um} onChange={e => set("um", e.target.value)}>
                {UM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="field">
              <label>{t("dashboard.catalog.form.unitPriceLabel")}</label>
              <input type="number" min={0} step={0.01} placeholder={t("dashboard.catalog.form.unitPricePlaceholder")} value={form.prezzoUnitario} onChange={e => set("prezzoUnitario", e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>{t("dashboard.catalog.form.categoryLabel")}</label>
            <select value={form.categoria} onChange={e => set("categoria", e.target.value)}>
              <option value="">{t("dashboard.catalog.form.noCategoryOption")}</option>
              {CATEGORIA_SUGGESTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t("dashboard.catalog.form.notesLabel")}</label>
            <input placeholder={t("dashboard.catalog.form.notesPlaceholder")} value={form.note} onChange={e => set("note", e.target.value)} />
          </div>
        </DialogBody>
        <DialogFooter>
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={onClose} disabled={isSaving}>{t("dashboard.catalog.cancel")}</button>
          <button type="button" className="btn btn-sm btn-navy" onClick={() => onSave(form)} disabled={!valid || isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {t("dashboard.catalog.form.save")}
          </button>
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
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t("dashboard.catalog.ocr.title")}</DialogTitle>
          <DialogDescription>{!previewItems ? t("dashboard.catalog.ocr.uploadDesc") : t("dashboard.catalog.ocr.foundItemsDesc").replace("{count}", String(previewItems.length))}</DialogDescription>
        </DialogHeader>

        {!previewItems ? (
          <>
            <DialogBody>
              <div className="field">
                <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.docx,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
              {error && <div className="notice danger"><AlertTriangle /><span className="grow">{error}</span></div>}
            </DialogBody>
            <DialogFooter>
              <button type="button" className="btn btn-sm btn-outline-navy" onClick={handleClose} disabled={isExtracting}>{t("dashboard.catalog.cancel")}</button>
              <button type="button" className="btn btn-sm btn-navy" onClick={handleExtract} disabled={!file || isExtracting}>
                {isExtracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Import className="h-4 w-4" />}
                {t("dashboard.catalog.ocr.extractItems")}
              </button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogBody className="flush">
              <div className="ocr-list">
                {previewItems.map((it, i) => (
                  <label key={i} className="item-row">
                    <input type="checkbox" checked={it.selected} onChange={() => toggleItem(i)} />
                    <div className="grow">
                      <b className="ttl">{it.nome}</b>
                      <span className="sub">{it.categoria || t("dashboard.catalog.noCategory")} · {it.um}</span>
                    </div>
                    <input className="inp-sm r" style={{ width: 96 }} type="number" step={0.01} value={it.prezzoUnitario} onChange={(e) => updateItemPrice(i, e.target.value)}/>
                  </label>
                ))}
              </div>
            </DialogBody>
            <DialogFooter>
              <button type="button" className="btn btn-sm btn-outline-navy" onClick={reset} disabled={isImporting}>{t("dashboard.catalog.ocr.back")}</button>
              <button type="button" className="btn btn-sm btn-navy" onClick={handleImport} disabled={selectedCount === 0 || isImporting}>
                {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {t(selectedCount === 1 ? "dashboard.catalog.ocr.importSingular" : "dashboard.catalog.ocr.importPlural").replace("{count}", String(selectedCount))}
              </button>
            </DialogFooter>
          </>
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

  // Elite includes everything Pro does (Phase 66: Elite accounts were shown the "Upgrade to Pro" wall).
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

  const sortedItems = [...items].sort((a, b) => {
    const catA = a.categoria ?? noCategoryLabel, catB = b.categoria ?? noCategoryLabel;
    return catA === catB ? a.nome.localeCompare(b.nome) : catA.localeCompare(catB);
  });
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const visibleItems = q ? sortedItems.filter(i => i.nome.toLowerCase().includes(q) || (i.categoria ?? "").toLowerCase().includes(q)) : sortedItems;

  if (!isPro) {
    return (
      <div className="card">
        <div className="card-empty" style={{ padding: "64px 22px" }}>
          <BookOpen />
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--navy)", marginBottom: 6 }}>{t("dashboard.catalog.proOnly.title")}</h2>
          <p style={{ maxWidth: 420, margin: "0 auto 18px" }}>{t("dashboard.catalog.proOnly.desc")}</p>
          <button type="button" className="btn btn-sm btn-navy" onClick={() => window.location.href = "/dashboard/settings?tab=billing"}>{t("dashboard.catalog.proOnly.cta")}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="page-head">
        <div>
          <h1>{t("dashboard.nav.catalog")}</h1>
          <p className="sub">{t("dashboard.catalog.header.subtitle")}</p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn-outline-navy btn-sm" onClick={handleImport} disabled={importFromQuotes.isPending}>
            {importFromQuotes.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {t("dashboard.catalog.importFromQuotes")}
          </button>
          <button type="button" className="btn btn-outline-navy btn-sm" onClick={() => setIsOcrOpen(true)}>
            <Import className="h-4 w-4" />
            {t("dashboard.catalog.importFromPhotoPdf")}
          </button>
          <button type="button" className="btn btn-navy" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("dashboard.catalog.addItem")}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="card" style={{ padding: "40px 22px", textAlign: "center" }}>
          <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium text-foreground">{t("dashboard.catalog.empty.title")}</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">{t("dashboard.catalog.empty.desc")}</p>
          <div className="flex gap-2 justify-center flex-wrap">
            <button type="button" className="btn btn-outline-navy btn-sm" onClick={handleImport} disabled={importFromQuotes.isPending}>
              {importFromQuotes.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {t("dashboard.catalog.importFromQuotes")}
            </button>
            <button type="button" className="btn btn-outline-navy btn-sm" onClick={() => setIsOcrOpen(true)}>
              <Import className="h-4 w-4" />
              {t("dashboard.catalog.importFromPhotoPdf")}
            </button>
            <button type="button" className="btn btn-navy" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              {t("dashboard.catalog.addItem")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="card stat-card">
              <p className="lbl">{t("dashboard.catalog.summary.totalItems")}</p>
              <p className="val">{items.length}</p>
            </div>
            <div className="card stat-card">
              <p className="lbl">{t("dashboard.catalog.summary.categories")}</p>
              <p className="val">{categories.filter(c => c !== noCategoryLabel).length}</p>
            </div>
            <div className="card stat-card">
              <p className="lbl">{t("dashboard.catalog.summary.avgPrice")}</p>
              <p className="val">{formatCurrency(items.reduce((s, i) => s + i.prezzoUnitario, 0) / items.length)}</p>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="toolbar">
              <label className="search sm grow">
                <Search className="h-4 w-4" />
                <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={t("dashboard.catalog.searchPlaceholder")} aria-label={t("dashboard.catalog.searchPlaceholder")} />
              </label>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t("dashboard.catalog.col.item")}</th>
                    <th>{t("dashboard.catalog.col.category")}</th>
                    <th>{t("dashboard.catalog.col.unit")}</th>
                    <th style={{ textAlign: "right" }}>{t("dashboard.catalog.col.unitPrice")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map(item => (
                    <tr key={item.id} className="group">
                      <td>
                        <span className="t-strong">{item.nome}</span>
                        {item.note && <span className="t-sub">{item.note}</span>}
                      </td>
                      <td>{item.categoria || noCategoryLabel}</td>
                      <td>{item.um}</td>
                      <td className="t-amt" style={{ textAlign: "right" }}>{formatCurrency(item.prezzoUnitario)}</td>
                      <td>
                        <div className="row-act">
                          <button type="button" className="ic-btn" onClick={() => setEditingItem(item)}><Pencil /></button>
                          <button type="button" className="ic-btn danger" onClick={() => setDeletingId(item.id)}><Trash2 /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card-foot"><span className="foot-note">{t("dashboard.catalog.itemCount").replace("{count}", String(visibleItems.length))}</span></div>
          </div>
        </>
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
            <AlertDialogDescription>{t("dashboard.catalog.delete.desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dashboard.catalog.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="btn-red" disabled={deleteItem.isPending}>
              {deleteItem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("dashboard.catalog.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
