import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, Pencil, Trash2, Loader2, BookOpen, Tag, Ruler,
  Check, Upload, AlertCircle, Search
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogFooter
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
import { formatCad } from "@/lib/money";

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

const formatCurrency = (n: number) => formatCad(n);

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
      } catch {
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
      <div className="card card-empty" style={{ padding: "56px 22px" }}>
        <BookOpen />
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--navy)", marginBottom: 6 }}>{t("dashboard.catalog.proOnly.title")}</h2>
        <p style={{ maxWidth: 440, margin: "0 auto 16px" }}>{t("dashboard.catalog.proOnly.desc")}</p>
        <button type="button" onClick={() => window.location.href = "/dashboard/settings?tab=billing"} className="btn btn-navy btn-sm">
          {t("dashboard.catalog.proOnly.cta")}
        </button>
      </div>
    );
  }

  return (
    <div className="stack">
      {/* Upload & CSV Action Card */}
      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="flex items-center gap-2"><Upload className="h-4 w-4" style={{ color: "var(--faint)" }} /> {t("catalog.csv.importTitle")}</h2>
            <p className="sub">{t("catalog.csv.importDesc")}</p>
          </div>
        </div>
        <div className="csv-row">
          <input type="file" accept=".csv" ref={fileInputRef} onChange={handleCsvSelect} className="hidden" />
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            {t("catalog.csv.chooseFile")}
          </button>
          {csvFileName && <span className="fname">{csvFileName}</span>}
          {csvPreview && (
            <button type="button" className="btn btn-sm btn-navy grow" style={{ background: "var(--green)" }} onClick={handleBulkUpload} disabled={bulkCreate.isPending}>
              {bulkCreate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {t("catalog.csv.confirmImport").replace("{count}", String(csvPreview.length))}
            </button>
          )}
        </div>

        {csvError && (
          <div className="notice danger">
            <AlertCircle />
            <span className="grow">{csvError}</span>
          </div>
        )}

        {/* CSV Preview */}
        {csvPreview && (
          <div className="csv-preview">
            <table className="ptbl soft">
              <thead>
                <tr>
                  <th>{t("catalog.csv.colItem")}</th>
                  <th>{t("catalog.csv.colCategory")}</th>
                  <th className="c w-um">{t("catalog.csv.colUnit")}</th>
                  <th className="r w-price">{t("catalog.csv.colPrice")}</th>
                </tr>
              </thead>
              <tbody>
                {csvPreview.slice(0, 10).map((row, idx) => (
                  <tr key={idx}>
                    <td className="t-strong">{row.nome}</td>
                    <td className="faint">{row.categoria || "-"}</td>
                    <td className="c faint">{row.um}</td>
                    <td className="r amt">{formatCurrency(row.prezzoUnitario)}</td>
                  </tr>
                ))}
                {csvPreview.length > 10 && (
                  <tr>
                    <td colSpan={4} className="c note">{t("catalog.csv.andMoreItems").replace("{count}", String(csvPreview.length - 10))}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Main List Management */}
      <section className="card">
        <div className="toolbar">
          <label className="search sm grow" style={{ width: "auto", flex: 1 }}>
            <Search className="h-4 w-4" />
            <input type="search" placeholder={t("catalog.searchPlaceholder")} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} aria-label={t("catalog.searchPlaceholder")} />
          </label>
          <button type="button" className="btn btn-sm btn-navy" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("dashboard.catalog.addItem")}
          </button>
        </div>

        {isLoading ? (
          <div className="stack" style={{ padding: 22 }}>
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="card-empty">
            <BookOpen />
            <b style={{ display: "block", color: "var(--navy)" }}>{t("catalog.noItemsFound")}</b>
            {t("catalog.noItemsFoundDesc")}
          </div>
        ) : (
          <div>
            {categories.map(cat => (
              <div key={cat} className="cat-group">
                <div className="cat-head">
                  <Tag />
                  {cat}
                  <span className="chip chip-grey">{groupedByCategory[cat].length}</span>
                </div>
                {groupedByCategory[cat].map(item => (
                  <div key={item.id} className="item-row">
                    <div className="grow">
                      <b className="ttl">{item.nome}</b>
                      {item.note && <span className="sub">{item.note}</span>}
                    </div>
                    <span className="chip chip-grey"><Ruler className="h-3 w-3 mr-1" style={{ opacity: .6 }} />{item.um}</span>
                    <span className="amt" style={{ color: "var(--green-dark)", minWidth: 80, textAlign: "right" }}>{formatCurrency(item.prezzoUnitario)}</span>
                    <div className="hover-act">
                      <button type="button" className="ic-btn" onClick={() => setEditingItem(item)} aria-label={t("dashboard.catalog.dialog.editTitle")}><Pencil /></button>
                      <button type="button" className="ic-btn danger" onClick={() => setDeletingId(item.id)} aria-label={t("dashboard.catalog.delete.title")}><Trash2 /></button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

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
