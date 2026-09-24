import { useState, useRef, useCallback, useEffect, useId, useMemo } from "react";
import { useLocation } from "wouter";
import { useCreateQuote, useGetBusinessProfile, useGetSubscription, useListClients } from "@workspace/api-client-react";
import {
  Sparkles, ImagePlus, ArrowRight, Loader2,
  X, User, Lock, Bot, PencilLine, FileText, FileSpreadsheet,
  LayoutTemplate, CheckCircle2, BookOpen, Plus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useClientMemory } from "@/hooks/use-client-memory";
import type { SavedClient } from "@/hooks/use-client-memory";
import ManualQuoteBuilder from "@/components/manual-quote-builder";
import { PriceCatalogSection } from "@/components/price-catalog-section";
import { MicButton } from "@/components/mic-button";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";

function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const MAX_SIZE_MB = 5;
const MAX_DOC_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const MAX_DOC_SIZE_BYTES = MAX_DOC_SIZE_MB * 1024 * 1024;
const MAX_ATTACHMENTS = 3;

function getExamples(t: (key: string) => string) {
  return [
    { label: t("dashboard.new.examples.painter.label"), text: t("dashboard.new.examples.painter.text") },
    { label: t("dashboard.new.examples.electrician.label"), text: t("dashboard.new.examples.electrician.text") },
    { label: t("dashboard.new.examples.plumber.label"), text: t("dashboard.new.examples.plumber.text") },
    { label: t("dashboard.new.examples.renovation.label"), text: t("dashboard.new.examples.renovation.text") },
    { label: t("dashboard.new.examples.mason.label"), text: t("dashboard.new.examples.mason.text") },
  ];
}

function getMaxPhotos(plan: string | null | undefined, isActive: boolean): number {
  if (!isActive) return 0;
  if (plan === "monthly_elite") return 5;
  if (plan === "monthly_pro") return 3;
  if (plan === "monthly_starter") return 1;
  return 0;
}

interface ClientForm {
  nome: string;
  indirizzo: string;
  city: string;
  postalCode: string;
  province: string;
  businessNumber: string;
  partitaIva: string;
  email: string;
  phone: string;
}
const emptyClient: ClientForm = {
  nome: "", indirizzo: "", city: "", postalCode: "", province: "", businessNumber: "", partitaIva: "", email: "", phone: "",
};

const toForm = (c: SavedClient): ClientForm => ({
  nome: c.nome, indirizzo: c.indirizzo || "", city: c.city || "",
  postalCode: c.postalCode || "", province: c.province || "",
  businessNumber: c.businessNumber || "", partitaIva: c.partitaIva || "",
  email: c.email || "", phone: c.phone || "",
});

// Phase 94: quotes used to be created with no way to enter the client's email
// or phone, so every CRM row started without contact details. Loose check only:
// the send dialog is where an address is really proven.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clientEmailInvalid = (f: ClientForm) => f.email.trim() !== "" && !EMAIL_RE.test(f.email.trim());

// ─── Shared client selector used in both tabs ───────────────────────────────
interface ClientSelectorProps {
  clientMode: "none" | "saved" | "new";
  setClientMode: (m: "none" | "saved" | "new") => void;
  selectedClientId: string | null;
  setSelectedClientId: (id: string | null) => void;
  clientForm: ClientForm;
  setClientForm: (fn: (prev: ClientForm) => ClientForm) => void;
  rememberClient: boolean;
  setRememberClient: (v: boolean) => void;
  savedClients: SavedClient[];
  selectSavedClient: (c: SavedClient) => void;
  clearClient: () => void;
  disabled?: boolean;
}

function ClientSelector({
  clientMode, setClientMode, selectedClientId,
  clientForm, setClientForm, rememberClient, setRememberClient,
  savedClients, selectSavedClient, clearClient, disabled,
}: ClientSelectorProps) {
  const { t } = useLanguage();
  const idBase = useId();
  const emailBad = clientEmailInvalid(clientForm);
  const field = (key: keyof ClientForm, label: string, placeholder: string, opts?: { maxLength?: number; upper?: boolean; full?: boolean; type?: "email" | "tel"; autoComplete?: string }) => {
    const id = `${idBase}-${key}`;
    const err = key === "email" && emailBad;
    return (
      <div className={cn("field", opts?.full && "full")}>
        <label htmlFor={id}>{label}</label>
        <input
          id={id}
          type={opts?.type ?? "text"}
          inputMode={opts?.type}
          autoComplete={opts?.autoComplete ?? "off"}
          placeholder={placeholder}
          value={clientForm[key]}
          onChange={e => { const v = opts?.upper ? e.target.value.toUpperCase() : e.target.value; setClientForm(f => ({ ...f, [key]: v })); }}
          disabled={disabled}
          maxLength={opts?.maxLength}
          aria-invalid={err || undefined}
          aria-describedby={err ? `${id}-err` : undefined}
        />
        {err && <p id={`${id}-err`} className="field-err">{t("dashboard.new.client.emailInvalid")}</p>}
      </div>
    );
  };
  const contactFields = (
    <>
      {field("email", t("dashboard.new.client.email"), t("dashboard.new.client.emailPlaceholder"), { type: "email", maxLength: 200 })}
      {field("phone", t("dashboard.new.client.phone"), t("dashboard.new.client.phonePlaceholder"), { type: "tel", maxLength: 30 })}
    </>
  );
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="flex items-center gap-2"><User className="h-4 w-4" style={{ color: "var(--faint)" }} /> {t("dashboard.new.client.label")}{clientForm.nome && <span className="chip chip-grey">{clientForm.nome}</span>}</h2>
          <p className="sub">{t("dashboard.new.client.optional")}</p>
        </div>
      </div>

      {savedClients.length > 0 && clientMode !== "new" && (
        <div className="pick-row">
          {savedClients.slice(0, 6).map(c => (
            <button key={c.id} type="button" onClick={() => selectSavedClient(c)} className={cn("pill", selectedClientId === c.id && "on")}>
              <User /> {c.nome}
            </button>
          ))}
          <button type="button" onClick={() => setClientMode("new")} className="pill dashed">
            <Plus /> {t("dashboard.new.client.addNew")}
          </button>
        </div>
      )}

      {clientMode === "saved" && selectedClientId && (
        <div className="pick-sub">
          <span>{[clientForm.indirizzo, clientForm.city, clientForm.province].filter(Boolean).join(", ") || t("dashboard.new.client.noAddress")}</span>
          <button type="button" onClick={clearClient} className="text-link danger">{t("dashboard.new.client.remove")}</button>
        </div>
      )}
      {/* Phase 94: a picked client's contact details, prefilled and editable; blanks are saved to the client record. */}
      {clientMode === "saved" && selectedClientId && (
        <div className="form-grid tight" style={{ borderTop: "1px solid var(--soft)" }}>{contactFields}</div>
      )}

      {savedClients.length === 0 && clientMode === "none" && (
        <div style={{ padding: 22 }}>
          <button type="button" onClick={() => setClientMode("new")} className="add-dashed">
            <Plus /> {t("dashboard.new.client.addClientData")}
          </button>
        </div>
      )}

      {clientMode === "new" && (
        <>
          <div className="form-grid tight animate-in fade-in slide-in-from-top-1 duration-200" style={{ borderTop: "1px solid var(--soft)" }}>
            {field("nome", t("dashboard.new.client.nameLabel"), t("dashboard.new.client.namePlaceholder"), { full: true })}
            {contactFields}
            {field("indirizzo", t("dashboard.new.client.addressLabel"), t("dashboard.new.client.addressPlaceholder"), { full: true })}
            {field("city", t("dashboard.new.client.city"), t("dashboard.new.client.cityPlaceholder"))}
            <div className="grid grid-cols-2 gap-2">
              {field("province", t("dashboard.new.client.province"), t("dashboard.new.client.provincePlaceholder"), { maxLength: 2, upper: true })}
              {field("postalCode", t("dashboard.new.client.postalCode"), t("dashboard.new.client.postalPlaceholder"), { maxLength: 7, upper: true })}
            </div>
            {field("businessNumber", t("dashboard.new.client.businessNumber"), "123456789RT0001", { maxLength: 16, upper: true })}
            {field("partitaIva", t("dashboard.new.client.gstHst"), "123456789RT0001", { maxLength: 15 })}
          </div>
          <div className="card-foot">
            <label className="chk-row">
              <input type="checkbox" checked={rememberClient} onChange={e => setRememberClient(e.target.checked)} />
              {t("dashboard.new.client.remember")}
            </label>
            <button type="button" onClick={clearClient} className="text-link">{t("dashboard.new.client.cancel")}</button>
          </div>
        </>
      )}
    </section>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function NewQuote() {
  const { t } = useLanguage();
  const can = useCan();
  const EXAMPLES = getExamples(t);
  const [activeTab, setActiveTab] = useState<"ai" | "manual" | "listino">("ai");

  const [input, setInput] = useState("");
  const [templateId, setTemplateId] = useState<"standard" | "arosio" | "mariagrazia">("standard");
  const [targetTotalEur, setTargetTotalEur] = useState<string>("");
  const [, setLocation] = useLocation();
  const createQuote = useCreateQuote();
  const { data: profile } = useGetBusinessProfile();
  const { data: subscription } = useGetSubscription();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { clients: localClients, upsertClient } = useClientMemory();
  // Phase 94: the picker offers the account's clients (every device, with their
  // email and phone), then anything only this browser remembers.
  const { data: serverClients } = useListClients();
  const savedClients = useMemo<SavedClient[]>(() => {
    const fromServer: SavedClient[] = (serverClients ?? []).map((c, i) => ({
      id: `s:${c.id}`, nome: c.clientName, indirizzo: c.indirizzo ?? undefined, city: c.city ?? undefined,
      postalCode: c.postalCode ?? undefined, province: c.province ?? undefined, businessNumber: c.businessNumber ?? undefined,
      partitaIva: c.partitaIva ?? undefined, email: c.email ?? undefined, phone: c.phone ?? undefined, lastUsed: -i,
    }));
    const known = new Set(fromServer.map((c) => c.nome.trim().toLowerCase()));
    return [...fromServer, ...localClients.filter((c) => !known.has(c.nome.trim().toLowerCase()))];
  }, [serverClients, localClients]);

  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [docs, setDocs] = useState<File[]>([]);

  const maxPhotos = getMaxPhotos(subscription?.plan, !!subscription?.isActive);
  const photoAllowed = maxPhotos > 0;

  const [clientMode, setClientMode] = useState<"none" | "saved" | "new">("none");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientForm, setClientForm] = useState<ClientForm>(emptyClient);
  const [rememberClient, setRememberClient] = useState(false);

  useEffect(() => {
    const savedPrompt = sessionStorage.getItem("quoteai:homepage_prompt");
    if (savedPrompt) {
      sessionStorage.removeItem("quoteai:homepage_prompt");
      setInput(savedPrompt);
    }
    const savedClient = sessionStorage.getItem("quoteai:selected_client");
    if (savedClient) {
      sessionStorage.removeItem("quoteai:selected_client");
      try {
        const c = JSON.parse(savedClient) as SavedClient;
        setClientMode("saved");
        setSelectedClientId(c.id);
        setClientForm(toForm(c));
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    return () => { photoPreviews.forEach(url => URL.revokeObjectURL(url)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    const totalAttachments = photos.length + docs.length;
    const remaining = MAX_ATTACHMENTS - totalAttachments;
    if (remaining <= 0) {
      toast({ title: fmt(t("dashboard.new.toast.maxAttachmentsTitle"), { max: MAX_ATTACHMENTS }), description: t("dashboard.new.toast.maxAttachmentsDesc"), variant: "destructive" });
      return;
    }
    const validImages: File[] = [];
    const validDocs: File[] = [];
    for (const file of arr.slice(0, remaining)) {
      const isImage = ALLOWED_TYPES.includes(file.type) || !!file.name.toLowerCase().match(/\.(heic|heif)$/);
      const isDoc = ALLOWED_DOC_TYPES.includes(file.type);
      if (!isImage && !isDoc) {
        toast({ title: t("dashboard.new.toast.unsupportedFormatTitle"), description: fmt(t("dashboard.new.toast.unsupportedFormatDesc"), { name: file.name }), variant: "destructive" });
        continue;
      }
      if (isImage && file.size > MAX_SIZE_BYTES) {
        toast({ title: t("dashboard.new.toast.fileTooLargeTitle"), description: fmt(t("dashboard.new.toast.fileTooLargePhotoDesc"), { name: file.name, maxSize: MAX_SIZE_MB }), variant: "destructive" });
        continue;
      }
      if (isDoc && file.size > MAX_DOC_SIZE_BYTES) {
        toast({ title: t("dashboard.new.toast.fileTooLargeTitle"), description: fmt(t("dashboard.new.toast.fileTooLargeDocDesc"), { name: file.name, maxSize: MAX_DOC_SIZE_MB }), variant: "destructive" });
        continue;
      }
      if (isImage) validImages.push(file);
      if (isDoc) validDocs.push(file);
    }
    const imagePreviews = validImages.map(f => URL.createObjectURL(f));
    setPhotos(prev => [...prev, ...validImages]);
    setPhotoPreviews(prev => [...prev, ...imagePreviews]);
    setDocs(prev => [...prev, ...validDocs]);
  }, [photos.length, docs.length, toast]);

  const removePhoto = (idx: number) => {
    URL.revokeObjectURL(photoPreviews[idx]);
    setPhotos(prev => prev.filter((_, i) => i !== idx));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const removeDoc = (idx: number) => {
    setDocs(prev => prev.filter((_, i) => i !== idx));
  };

  const getClientData = () => {
    const f = clientForm;
    if (!f.nome.trim()) return undefined;
    return {
      nome: f.nome.trim(),
      indirizzo: f.indirizzo.trim(),
      ...(f.email.trim() && !clientEmailInvalid(f) && { email: f.email.trim() }),
      ...(f.phone.trim() && { phone: f.phone.trim() }),
      ...(f.city.trim() && { city: f.city.trim() }),
      ...(f.postalCode.trim() && { postalCode: f.postalCode.trim() }),
      ...(f.province.trim() && { province: f.province.trim() }),
      ...(f.businessNumber.trim() && { businessNumber: f.businessNumber.trim() }),
      ...(f.partitaIva.trim() && { partitaIva: f.partitaIva.trim() }),
    };
  };

  const handleAiSubmit = () => {
    if (!input.trim() || isAiSubmitting) return;
    if (clientEmailInvalid(clientForm)) { focusEmailError(); return; }
    const clientData = getClientData();
    if (rememberClient && clientData) upsertClient(clientData);

    const companySnapshot = profile
      ? {
          companyName: profile.companyName || "",
          ...(profile.vatNumber && { vatNumber: profile.vatNumber }),
          ...(profile.address && { address: profile.address }),
          ...(profile.phone && { phone: profile.phone }),
          ...(profile.email && { email: profile.email }),
          ...(profile.logoUrl && { logoUrl: profile.logoUrl }),
        }
      : undefined;

    const allAttachments = [...photos, ...docs];
    const parsedTarget = targetTotalEur.trim() !== "" ? Number(targetTotalEur.replace(/\./g, "").replace(",", ".")) : undefined;
    createQuote.mutate(
      {
        data: {
          rawInput: input,
          clientData: clientData ? JSON.stringify(clientData) : undefined,
          companySnapshot: companySnapshot ? JSON.stringify(companySnapshot) : undefined,
          images: allAttachments.length > 0 ? allAttachments : undefined,
          templateId,
          targetTotalEur: parsedTarget && !isNaN(parsedTarget) && parsedTarget > 0 ? parsedTarget : undefined,
        },
      },
      {
        onSuccess: (quote) => { setLocation(`/dashboard/quotes/${quote.id}`); },
        onError: (err: unknown) => {
          const e = err as { status?: number; data?: { error?: string; code?: string } };
          if (e.status === 429) {
            toast({ title: t("dashboard.new.toast.quotaReachedTitle"), description: t("dashboard.new.toast.quotaReachedDesc"), variant: "destructive" });
          } else if ((e.status === 422 || e.status === 400) && e.data?.error) {
            toast({ title: t("dashboard.new.toast.cannotGenerateTitle"), description: e.data.error, variant: "destructive" });
          } else {
            toast({ title: t("dashboard.new.toast.genericErrorTitle"), description: t("dashboard.new.toast.genericErrorDesc"), variant: "destructive" });
          }
        },
      }
    );
  };

  const isAiSubmitting = createQuote.isPending;
  const canAiSubmit = input.trim().length > 0 && !isAiSubmitting;
  function focusEmailError() {
    toast({ title: t("dashboard.new.client.emailInvalid"), variant: "destructive" });
    document.querySelector<HTMLInputElement>('input[type="email"][aria-invalid="true"]')?.focus();
  }

  const selectSavedClient = (c: SavedClient) => {
    setSelectedClientId(c.id);
    setClientMode("saved");
    setClientForm(toForm(c));
  };

  const clearClient = () => {
    setClientMode("none");
    setSelectedClientId(null);
    setClientForm(emptyClient);
  };

  const planPhotoLabel = !subscription?.isActive
    ? null
    : subscription.plan === "monthly_starter"
      ? t("dashboard.new.plan.starter")
      : subscription.plan === "monthly_pro"
        ? t("dashboard.new.plan.pro")
        : t("dashboard.new.plan.elite");

  const clientData = getClientData();

  const attachmentsFull = photos.length + docs.length >= MAX_ATTACHMENTS;

  // Phase 83: every tab on this page writes a quote. The sidebar and ⌘K
  // stopped offering it to a foreman or a viewer in Phase 80, but the route
  // itself still rendered the whole composer, the manual builder and the
  // price catalog editor — each one a 403 waiting to happen.
  if (!can("quotes", "edit")) {
    return (
      <div className="animate-in fade-in duration-300" style={{ maxWidth: 760, marginInline: "auto" }}>
        <div className="page-head">
          <div>
            <h1>{t("dashboard.new.title")}</h1>
            <p className="sub">{t("dashboard.new.subtitle")}</p>
          </div>
        </div>
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <Lock className="h-8 w-8 mx-auto mb-3" style={{ color: "var(--faint)" }} />
          <p className="sub" style={{ marginBottom: 16 }}>{t("roles.readOnly")}</p>
          <button type="button" className="btn btn-outline-navy btn-sm" onClick={() => setLocation("/dashboard/quotes")}>
            {t("dashboard.nav.quotes")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300" style={{ maxWidth: 760, marginInline: "auto" }}>
      <div className="page-head">
        <div>
          <h1>{t("dashboard.new.title")}</h1>
          <p className="sub">{t("dashboard.new.subtitle")}</p>
        </div>
      </div>

      {/* ── Tab switcher ── */}
      <div className="pills" style={{ marginBottom: 16 }}>
        <button type="button" onClick={() => setActiveTab("ai")} className={cn("pill", activeTab === "ai" && "on")}>
          <Bot /> {t("dashboard.new.tabAi")}
        </button>
        <button type="button" onClick={() => setActiveTab("manual")} className={cn("pill", activeTab === "manual" && "on")}>
          <PencilLine /> {t("dashboard.new.tabManual")}
        </button>
        <button type="button" onClick={() => setActiveTab("listino")} className={cn("pill", activeTab === "listino" && "on")}>
          <BookOpen /> {t("dashboard.new.tabCatalog")}
        </button>
      </div>

      {/* ══ AI TAB ══════════════════════════════════════════════════════════ */}
      {activeTab === "ai" && (
        <div className="stack animate-in fade-in duration-200">
          {/* Template selector */}
          <div>
            <span className="eyebrow flex items-center gap-2" style={{ fontSize: 11, marginBottom: 8 }}>
              <LayoutTemplate className="h-3.5 w-3.5" /> {t("dashboard.new.layoutLabel")}
            </span>
            <div className="src-grid flush">
              {([
                { id: "standard" as const, label: t("dashboard.new.template.standard.label"), desc: t("dashboard.new.template.standard.desc"), proOnly: false },
                { id: "arosio" as const, label: t("dashboard.new.template.professional.label"), desc: t("dashboard.new.template.professional.desc"), proOnly: true },
                { id: "mariagrazia" as const, label: t("dashboard.new.template.elegant.label"), desc: t("dashboard.new.template.elegant.desc"), proOnly: true },
              ]).map((tmpl) => {
                const isActive = templateId === tmpl.id;
                const isPro = subscription?.isActive && (subscription.plan === "monthly_pro" || subscription.plan === "monthly_elite");
                const requiresPro = tmpl.proOnly && !isPro;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => {
                      if (requiresPro) {
                        toast({ title: t("dashboard.new.toast.proRequiredTitle"), description: t("dashboard.new.toast.proRequiredDesc"), variant: "destructive" });
                        return;
                      }
                      setTemplateId(tmpl.id);
                    }}
                    className={cn("src sm", isActive && "on")}
                  >
                    <b>
                      {isActive && <CheckCircle2 />}
                      {tmpl.label}
                      {requiresPro && <span className="chip chip-yellow">{t("dashboard.new.template.pro")}</span>}
                    </b>
                    <p>{tmpl.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target total input */}
          <div className="card">
            <div className="field inline" style={{ padding: "12px 20px" }}>
              <span>{t("dashboard.new.targetAmount")}</span>
              <input
                type="text"
                inputMode="numeric"
                value={targetTotalEur}
                onChange={e => {
                  const v = e.target.value.replace(/[^0-9.,]/g, "");
                  setTargetTotalEur(v);
                }}
                placeholder={t("dashboard.new.targetPlaceholder")}
                className="flex-1 min-w-0 text-right"
                style={{ fontVariantNumeric: "tabular-nums" }}
                disabled={isAiSubmitting}
              />
              <span>{t("dashboard.new.taxIncl")}</span>
            </div>
          </div>

          {/* AI composer card */}
          <div className="card composer">
            {/* Photo strip */}
            {photos.length > 0 && (
              <div className="att-strip">
                {photoPreviews.map((src, idx) => (
                  <div key={idx} className="att-thumb">
                    <img src={src} alt={`${t("dashboard.new.photoAlt")} ${idx + 1}`} />
                    <button type="button" onClick={() => removePhoto(idx)} disabled={isAiSubmitting} className="att-x" aria-label={t("dashboard.new.client.remove")}>
                      <X />
                    </button>
                  </div>
                ))}
                {photos.length < maxPhotos && !attachmentsFull && (
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isAiSubmitting} className="att-add">
                    <span className="grid place-items-center gap-0.5"><ImagePlus />{t("dashboard.new.add")}</span>
                  </button>
                )}
              </div>
            )}

            {/* Document strip */}
            {docs.length > 0 && (
              <div className="att-strip">
                {docs.map((file, idx) => (
                  <div key={idx} className="att-doc">
                    {file.type === "application/pdf" ? <FileText className="ic" />
                      : file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ? <FileSpreadsheet className="ic" />
                      : <FileText className="ic" />}
                    <span>{file.name}</span>
                    <button type="button" onClick={() => removeDoc(idx)} disabled={isAiSubmitting} className="att-x" aria-label={t("dashboard.new.client.remove")}>
                      <X />
                    </button>
                  </div>
                ))}
                {!attachmentsFull && (
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isAiSubmitting} className="att-add wide">
                    <ImagePlus /> {t("dashboard.new.add")}
                  </button>
                )}
              </div>
            )}

            {/* Bar row */}
            <div className="comp-row">
              {photoAllowed ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isAiSubmitting || photos.length >= maxPhotos}
                  title={fmt(t("dashboard.new.attachTooltip"), { maxPhotos, maxTotal: MAX_ATTACHMENTS })}
                  aria-label={fmt(t("dashboard.new.attachTooltip"), { maxPhotos, maxTotal: MAX_ATTACHMENTS })}
                  className="comp-mic"
                  style={photos.length > 0 ? { background: "var(--soft-2)", color: "var(--navy)" } : undefined}
                >
                  <ImagePlus className="h-4 w-4" />
                </button>
              ) : (
                <span className="comp-lock" title={t("dashboard.new.paidPlanOnly")} aria-label={t("dashboard.new.paidPlanOnly")}>
                  <Lock className="h-4 w-4" />
                </span>
              )}

              <span className="comp-ic"><Sparkles className="h-[18px] w-[18px]" /></span>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey && canAiSubmit) {
                    e.preventDefault();
                    handleAiSubmit();
                  }
                }}
                placeholder={t("dashboard.new.inputPlaceholder")}
                aria-label={t("dashboard.new.inputPlaceholder")}
                disabled={isAiSubmitting}
              />

              <MicButton
                disabled={isAiSubmitting}
                onTranscribed={text => setInput(prev => (prev.trim() ? `${prev.trim()} ${text}` : text))}
              />

              <button type="button" onClick={handleAiSubmit} disabled={!canAiSubmit} className="comp-send" aria-label={t("dashboard.new.tabAi")}>
                {isAiSubmitting ? <Loader2 className="chev animate-spin" /> : <ArrowRight className="chev" />}
              </button>
            </div>

            {photoAllowed && photos.length === 0 && docs.length === 0 && (
              <div className="comp-hint">{planPhotoLabel} {t("dashboard.new.photoHintSuffix")}</div>
            )}

            <div className="comp-ex">
              <span className="eyebrow">{t("dashboard.new.examplesLabel")}</span>
              {EXAMPLES.map(ex => (
                <button key={ex.label} type="button" onClick={() => setInput(ex.text)} disabled={isAiSubmitting} className="pill">
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/pdf,.pdf,.docx,.xlsx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            multiple
            className="hidden"
            onChange={e => { if (e.target.files) { addFiles(e.target.files); e.target.value = ""; } }}
            disabled={isAiSubmitting}
          />

          {/* Client selector for AI tab */}
          <ClientSelector
            clientMode={clientMode}
            setClientMode={setClientMode}
            selectedClientId={selectedClientId}
            setSelectedClientId={setSelectedClientId}
            clientForm={clientForm}
            setClientForm={setClientForm}
            rememberClient={rememberClient}
            setRememberClient={setRememberClient}
            savedClients={savedClients}
            selectSavedClient={selectSavedClient}
            clearClient={clearClient}
            disabled={isAiSubmitting}
          />
        </div>
      )}

      {/* ══ MANUAL TAB ══════════════════════════════════════════════════════ */}
      {activeTab === "manual" && (
        <div className="stack animate-in fade-in duration-200">
          {/* Client selector for manual tab */}
          <ClientSelector
            clientMode={clientMode}
            setClientMode={setClientMode}
            selectedClientId={selectedClientId}
            setSelectedClientId={setSelectedClientId}
            clientForm={clientForm}
            setClientForm={setClientForm}
            rememberClient={rememberClient}
            setRememberClient={setRememberClient}
            savedClients={savedClients}
            selectSavedClient={selectSavedClient}
            clearClient={clearClient}
          />

          <ManualQuoteBuilder
            clientData={clientData}
            profileData={profile ?? undefined}
            onBeforeSubmit={() => { if (clientEmailInvalid(clientForm)) { focusEmailError(); return false; } return true; }}
          />
        </div>
      )}

      {/* ══ LISTINO TAB ═════════════════════════════════════════════════════ */}
      {activeTab === "listino" && (
        <div className="animate-in fade-in duration-200">
          <PriceCatalogSection />
        </div>
      )}
    </div>
  );
}
