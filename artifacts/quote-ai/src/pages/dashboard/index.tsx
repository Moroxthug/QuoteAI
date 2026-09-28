import {
  useGetQuoteStats,
  useGetSubscription,
  useCreateCustomerPortalSession,
  useGetTrialStatus,
  useCreateQuote,
  useGetBusinessProfile,
} from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  FileSpreadsheet,
  Sparkles,
  Plus,
  ArrowRight,
  Crown,
  Lock,
  CheckCircle2,
  MessageSquare,
  Download,
  Building2,
  Gift,
  ImagePlus,
  X,
  User,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useClientMemory } from "@/hooks/use-client-memory";
import type { SavedClient } from "@/hooks/use-client-memory";
import { useState, useRef, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MicButton } from "@/components/mic-button";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan, useRole } from "@/hooks/use-role";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { CashFlowCard } from "@/components/dashboard/cash-flow-card";
import { CrewLine, NeedsYouCard, NextUpCard, TodayStats } from "@/components/dashboard/today";
import { ListRow } from "@/components/mobile/list-row";
import { CardSkeleton, StatStripSkeleton } from "@/components/skeletons";
import { MARKETING_PLANS } from "@/data/pricing";
import { PaymentReturnNotice } from "@/components/billing/payment-return-notice";
import { ForemanHome } from "@/components/crew/foreman-home";
import { formatCadWhole } from "@/lib/money";
import { UpgradeLink } from "@/components/billing/upgrade-link";
import { isNativeApp } from "@/lib/native/env";

/* ─── plan helpers ─────────────────────────────────────────────────────────── */

function getMaxPhotos(plan: string | null | undefined, isActive: boolean): number {
  if (!isActive) return 0;
  if (plan === "monthly_elite" || plan === "monthly_business") return 5;
  if (plan === "monthly_pro") return 3;
  if (plan === "monthly_starter") return 1;
  return 0;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_DOC_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 3;

interface ClientForm {
  nome: string; indirizzo: string; city: string;
  postalCode: string; province: string; businessNumber: string; partitaIva: string;
}
const emptyClient: ClientForm = {
  nome: "", indirizzo: "", city: "", postalCode: "", province: "", businessNumber: "", partitaIva: "",
};

/* ─── StatusBadge ────────────────────────────────────────────────────────── */
function quoteStatusChip(status: string, t: (key: string) => string): { cls: string; label: string } {
  switch (status) {
    case "unlocked":
      return { cls: "chip-green", label: t("dashboard.index.status.unlocked") };
    case "pending_payment":
      return { cls: "chip-yellow", label: t("dashboard.index.status.pending") };
    case "accepted":
      return { cls: "chip-teal", label: t("dashboard.index.status.accepted") };
    default:
      return { cls: "chip-grey", label: t("dashboard.index.status.draft") };
  }
}

/* ─── StarterUpgradeCard ─────────────────────────────────────────────────── */
function StarterUpgradeCard() {
  const { t } = useLanguage();
  const createPortal = useCreateCustomerPortalSession();
  return (
    <div className="bg-gradient-to-r from-amber-50 to-navy-50 border border-amber-200 rounded-[var(--radius)] p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
          <Crown className="h-4 w-4 text-amber-600" />
        </div>
        <div>
          <div className="font-semibold text-foreground text-sm">{t("dashboard.index.starterUpgrade.title")}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{t("dashboard.index.starterUpgrade.desc")}</div>
        </div>
      </div>
      <button
        onClick={() => createPortal.mutate(undefined, { onSuccess: (r) => { window.open(r.url, "_blank"); } })}
        disabled={createPortal.isPending}
        className="shrink-0 btn-gradient inline-flex h-8 items-center justify-center px-3 text-xs font-semibold disabled:opacity-60"
      >
        {createPortal.isPending ? t("dashboard.index.starterUpgrade.upgrading") : t("dashboard.index.starterUpgrade.upgrade")}
      </button>
    </div>
  );
}

/* ─── OnboardingView ─────────────────────────────────────────────────────── */
function OnboardingView({ profileDone }: { profileDone: boolean }) {
  const { t } = useLanguage();
const can = useCan();
  const steps = [
    // Phase 93: someone who just finished onboarding has done this one — say so instead of asking again.
    { icon: Building2, num: "1", done: profileDone, title: t(profileDone ? "dashboard.index.onboarding.step1.doneTitle" : "dashboard.index.onboarding.step1.title"), desc: t(profileDone ? "dashboard.index.onboarding.step1.doneDesc" : "dashboard.index.onboarding.step1.desc"), href: "/dashboard/settings/company", cta: t("dashboard.index.onboarding.step1.cta") },
    { icon: MessageSquare, num: "2", done: false, title: t("dashboard.index.onboarding.step2.title"), desc: t("dashboard.index.onboarding.step2.desc"), href: "/dashboard/new", cta: t("dashboard.index.onboarding.step2.cta") },
    { icon: Download, num: "3", done: false, title: t("dashboard.index.onboarding.step3.title"), desc: t("dashboard.index.onboarding.step3.desc"), href: null, cta: null },
  ];
  return (
    <div className="space-y-3">
      <div className="card overflow-hidden">
        <div className="px-5 pt-6 pb-5 text-center">
          <div className="mx-auto h-12 w-12 rounded-[var(--radius-sm)] flex items-center justify-center mb-3" style={{ background: "linear-gradient(135deg, rgba(16,16,49,0.12), rgba(15,151,162,0.12))" }}>
            <Sparkles className="h-6 w-6 text-navy-500" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-1">{t("dashboard.index.onboarding.welcomePrefix")} <span className="quoteai-word text-lg">QuoteAI</span>!</h2>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mb-5">
            {t("dashboard.index.onboarding.subtitle")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 text-left">
            {steps.map(({ icon: Icon, num, done, title, desc, href, cta }) => (
              <div key={num} className="rounded-lg bg-muted border border-border p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  {done
                    ? <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: "var(--green-dark)" }} aria-label={t("dashboard.index.onboarding.stepDone")} />
                    : <span className="h-5 w-5 rounded-full bg-navy-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{num}</span>}
                  <Icon className="h-3.5 w-3.5 text-navy-500" />
                  <span className="text-sm font-semibold text-foreground">{title}</span>
                </div>
                <p className="text-xs leading-relaxed mb-1.5" style={{ color: "var(--muted-mk)" }}>{desc}</p>
                {href && cta && <Link href={href} className="text-xs font-semibold text-navy-600 hover:text-navy-700 transition-colors">{cta}</Link>}
              </div>
            ))}
          </div>
          {can("quotes", "edit") && (
            <Link href="/dashboard/new" className="btn btn-navy">
              <Plus className="h-3.5 w-3.5" />
              {t("dashboard.index.onboarding.ctaButton")}
            </Link>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <Link href="/dashboard/settings/company" className="card p-3 flex items-center gap-2.5 hover:border-navy-200 hover:bg-navy-50/30 transition-all group">
          <div className="h-7 w-7 rounded-lg bg-navy-100 flex items-center justify-center"><Building2 className="h-3.5 w-3.5 text-navy-500" /></div>
          <span className="text-sm font-medium text-foreground group-hover:text-navy-700">{t("dashboard.index.onboarding.companyProfile")}</span>
        </Link>
        <UpgradeLink className="card p-3 flex items-center gap-2.5 hover:border-amber-200 hover:bg-amber-50/30 transition-all group">
          <div className="h-7 w-7 rounded-lg bg-amber-100 flex items-center justify-center"><Crown className="h-3.5 w-3.5 text-amber-500" /></div>
          <span className="text-sm font-medium text-foreground group-hover:text-amber-700">{t("dashboard.index.onboarding.plansPricing")}</span>
        </UpgradeLink>
        {can("quotes", "edit") && (
          <Link href="/dashboard/new" className="card p-3 flex items-center gap-2.5 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all group">
            <div className="h-7 w-7 rounded-lg bg-emerald-100 flex items-center justify-center"><Sparkles className="h-3.5 w-3.5 text-emerald-500" /></div>
            <span className="text-sm font-medium text-foreground group-hover:text-emerald-700">{t("dashboard.index.onboarding.createQuote")}</span>
          </Link>
        )}
      </div>
    </div>
  );
}

/* ─── TrialBanner ────────────────────────────────────────────────────────── */
function TrialBanner({ downloadsUsed, downloadsLimit, daysLeft }: { downloadsUsed: number; downloadsLimit: number; daysLeft: number | null | undefined }) {
  const { t } = useLanguage();
const can = useCan();
  const remaining = downloadsLimit - downloadsUsed;
  return (
    <div className="bg-gradient-to-r from-navy-50 to-teal-50 border border-navy-200 rounded-[var(--radius)] p-3.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-8 w-8 rounded-lg bg-navy-100 flex items-center justify-center shrink-0">
          <Gift className="h-4 w-4 text-navy-600" />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-foreground text-sm">
            {t("dashboard.index.trial.active")}
            {typeof daysLeft === "number" && (
              <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-medium text-navy-600 bg-navy-100 px-1.5 py-0.5 rounded-full">
                {daysLeft === 0
                  ? t("dashboard.index.trial.expiresToday")
                  : t(daysLeft === 1 ? "dashboard.index.trial.daysLeftSingular" : "dashboard.index.trial.daysLeftPlural").replace("{days}", String(daysLeft))}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {remaining > 0
              ? t("dashboard.index.trial.remainingDesc").replace("{remaining}", String(remaining)).replace("{limit}", String(downloadsLimit))
              : t("dashboard.index.trial.exhaustedDesc")}
          </div>
        </div>
      </div>
      {remaining > 0 && can("quotes", "edit") ? (
        <Link href="/dashboard/new" className="shrink-0 btn-gradient inline-flex h-8 items-center justify-center px-3 text-xs font-semibold gap-1">
          <Sparkles className="h-3 w-3" />
          {t("dashboard.index.trial.createNow")}
        </Link>
      ) : (
        <UpgradeLink className="shrink-0 btn-gradient inline-flex h-8 items-center justify-center px-3 text-xs font-semibold">
          {t("dashboard.index.trial.subscribe")}
        </UpgradeLink>
      )}
    </div>
  );
}

/* ─── DashboardComposer (AI bar + client section, ported to .composer) ──────── */
function DashboardComposer() {
  const { t } = useLanguage();
  const [input, setInput] = useState("");
  const [, setLocation] = useLocation();
  const createQuote = useCreateQuote();
  const { data: profile } = useGetBusinessProfile();
  const { data: subscription } = useGetSubscription();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { clients: savedClients, upsertClient } = useClientMemory();

  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [docs, setDocs] = useState<File[]>([]);
  const maxPhotos = getMaxPhotos(subscription?.plan, !!subscription?.isActive);
  const photoAllowed = maxPhotos > 0;

  const [clientMode, setClientMode] = useState<"none" | "saved" | "new">("none");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientForm, setClientForm] = useState<ClientForm>(emptyClient);
  const [rememberClient, setRememberClient] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  // Phase 104: one line on the home page; the client part appears once the box is used.
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    return () => { photoPreviews.forEach(url => URL.revokeObjectURL(url)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    const totalAttachments = photos.length + docs.length;
    const remaining = MAX_ATTACHMENTS - totalAttachments;
    if (remaining <= 0) {
      toast({ title: t("dashboard.new.toast.maxAttachmentsTitle").replace("{max}", String(MAX_ATTACHMENTS)), description: t("dashboard.new.toast.maxAttachmentsDesc"), variant: "destructive" });
      return;
    }
    const validImages: File[] = [];
    const validDocs: File[] = [];
    for (const file of arr.slice(0, remaining)) {
      const isImage = ALLOWED_TYPES.includes(file.type) || !!file.name.toLowerCase().match(/\.(heic|heif)$/);
      const isDoc = ALLOWED_DOC_TYPES.includes(file.type);
      if (!isImage && !isDoc) {
        toast({ title: t("dashboard.new.toast.unsupportedFormatTitle"), description: t("dashboard.new.toast.unsupportedFormatDesc").replace("{name}", file.name), variant: "destructive" });
        continue;
      }
      if (isImage && file.size > MAX_SIZE_BYTES) {
        toast({ title: t("dashboard.new.toast.fileTooLargeTitle"), description: t("dashboard.new.toast.fileTooLargePhotoDesc").replace("{name}", file.name).replace("{maxSize}", "5"), variant: "destructive" });
        continue;
      }
      if (isDoc && file.size > MAX_DOC_SIZE_BYTES) {
        toast({ title: t("dashboard.new.toast.fileTooLargeTitle"), description: t("dashboard.new.toast.fileTooLargeDocDesc").replace("{name}", file.name).replace("{maxSize}", "10"), variant: "destructive" });
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
      ...(f.indirizzo.trim() && { indirizzo: f.indirizzo.trim() }),
      ...(f.city.trim() && { city: f.city.trim() }),
      ...(f.postalCode.trim() && { postalCode: f.postalCode.trim() }),
      ...(f.province.trim() && { province: f.province.trim() }),
      ...(f.businessNumber.trim() && { businessNumber: f.businessNumber.trim() }),
      ...(f.partitaIva.trim() && { partitaIva: f.partitaIva.trim() }),
    };
  };

  const handleSubmit = () => {
    if (!input.trim() || isSubmitting) return;
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
    createQuote.mutate(
      {
        data: {
          rawInput: input,
          clientData: clientData ? JSON.stringify(clientData) : undefined,
          companySnapshot: companySnapshot ? JSON.stringify(companySnapshot) : undefined,
          images: allAttachments.length > 0 ? allAttachments : undefined,
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

  const isSubmitting = createQuote.isPending;
  const canSubmit = input.trim().length > 0 && !isSubmitting;
  const expanded = focused || input.trim().length > 0 || photos.length + docs.length > 0 || clientOpen || !!clientForm.nome;

  const selectSavedClient = (c: SavedClient) => {
    setSelectedClientId(c.id);
    setClientMode("saved");
    setClientForm({
      nome: c.nome, indirizzo: c.indirizzo || "", city: c.city || "",
      postalCode: c.postalCode || "", province: c.province || "",
      businessNumber: c.businessNumber || "", partitaIva: c.partitaIva || "",
    });
    setClientOpen(false);
  };

  const clearClient = () => {
    setClientMode("none");
    setSelectedClientId(null);
    setClientForm(emptyClient);
  };

  return (
    <section className={cn("card composer", isSubmitting && "busy")} onFocus={() => setFocused(true)}>
      {/* Photo strip */}
      {photos.length > 0 && (
        <div className="px-3 pt-3 flex gap-2 flex-wrap border-b border-border pb-3">
          {photoPreviews.map((src, idx) => (
            <div key={idx} className="relative group w-12 h-12 rounded-lg overflow-hidden border border-border bg-muted shrink-0">
              <img src={src} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => removePhoto(idx)} disabled={isSubmitting}
                className="absolute top-0.5 right-0.5 bg-black/70 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="h-2 w-2 text-white" />
              </button>
            </div>
          ))}
          {photos.length < maxPhotos && (
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}
              className="w-12 h-12 rounded-lg border-2 border-dashed border-border hover:border-navy-300 flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-navy-500 transition-colors text-[9px]">
              <ImagePlus className="h-3 w-3" />
              <span>{t("dashboard.new.add")}</span>
            </button>
          )}
        </div>
      )}

      {/* Document strip */}
      {docs.length > 0 && (
        <div className="px-3 pt-3 flex gap-2 flex-wrap border-b border-border pb-3">
          {docs.map((file, idx) => (
            <div key={idx} className="relative group flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border bg-muted text-xs text-foreground shrink-0">
              {file.type === "application/pdf" ? (
                <FileText className="h-3.5 w-3.5 text-red-500" />
              ) : file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ? (
                <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <FileText className="h-3.5 w-3.5 text-blue-600" />
              )}
              <span className="truncate max-w-[120px]">{file.name}</span>
              <button type="button" onClick={() => removeDoc(idx)} disabled={isSubmitting} className="ml-0.5 text-muted-foreground hover:text-red-500 transition-colors">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {photos.length + docs.length < MAX_ATTACHMENTS && (
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}
              className="w-auto px-2 h-7 rounded-lg border-2 border-dashed border-border hover:border-navy-300 flex items-center gap-0.5 text-muted-foreground hover:text-navy-500 transition-colors text-[10px]">
              <ImagePlus className="h-3 w-3" />
              <span>{t("dashboard.new.add")}</span>
            </button>
          )}
        </div>
      )}

      {/* comp-row */}
      <div className="comp-row">
        <div className="group relative shrink-0">
          {photoAllowed ? (
            <button type="button" className="comp-ic" aria-label={t("a11y.attachPhoto")} onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting || photos.length + docs.length >= MAX_ATTACHMENTS}>
              <ImagePlus className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" className="comp-ic" disabled aria-label={t("a11y.attachPhoto")}>
              <Lock className="h-4 w-4" />
            </button>
          )}
          {!photoAllowed && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-gray-900 text-white text-[11px] font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-10">
              {t("dashboard.new.paidPlanOnly")}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
            </div>
          )}
        </div>

        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && canSubmit) { e.preventDefault(); handleSubmit(); } }}
          placeholder={t("dashboard.index.composer.placeholder")}
          aria-label={t("dashboard.index.composer.placeholder")}
          disabled={isSubmitting}
        />

        <MicButton
          disabled={isSubmitting}
          onTranscribed={text => setInput(prev => (prev.trim() ? `${prev.trim()} ${text}` : text))}
        />

        <button onClick={handleSubmit} disabled={!canSubmit} aria-label={t("a11y.generateQuote")} className="comp-send">
          {isSubmitting
            ? <Loader2 className="chev animate-spin" />
            : <ArrowRight className="chev" />
          }
        </button>
      </div>

      <div className="prog"><i style={{ width: isSubmitting ? "70%" : "0%" }} /></div>
      {isSubmitting && (
        <p className="comp-status">
          {(photos.length > 0 || docs.length > 0) ? t("dashboard.index.quickBar.analyzingAttachments") : t("dashboard.index.quickBar.generatingQuote")}
        </p>
      )}

      <input ref={fileInputRef} type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        multiple className="hidden"
        onChange={e => { if (e.target.files) { addFiles(e.target.files); e.target.value = ""; } }}
        disabled={isSubmitting}
      />

      {/* Client section */}
      {expanded && <>
      <button type="button" onClick={() => setClientOpen(v => !v)} className="comp-client">
        <User className="h-3.5 w-3.5" />
        <span>{t("dashboard.new.client.label")}</span>
        {clientForm.nome && !clientOpen && (
          <span className="text-xs font-semibold text-navy-700 bg-navy-50 border border-navy-100 px-2 py-0.5 rounded-full">
            {clientForm.nome}
          </span>
        )}
        <span className="opt">
          {!clientOpen && !clientForm.nome && t("dashboard.new.client.optional")}
          {clientOpen ? <ChevronUp className="chev" /> : <ChevronDown className="chev" />}
        </span>
      </button>

      {!clientOpen && savedClients.length > 0 && (
        <div className="px-5 pb-3 flex flex-wrap gap-1.5 border-t border-border pt-2.5">
          {savedClients.slice(0, 5).map(c => (
            <button key={c.id} type="button" onClick={() => selectSavedClient(c)}
              className={cn(
                "inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border transition-all",
                selectedClientId === c.id
                  ? "border-navy-300 bg-navy-50 text-navy-700 font-semibold"
                  : "border-border text-muted-foreground hover:border-navy-200 hover:bg-navy-50/50"
              )}>
              <User className="h-2.5 w-2.5" />
              {c.nome}
            </button>
          ))}
          <button type="button" onClick={() => { setClientOpen(true); setClientMode("new"); setSelectedClientId(null); setClientForm(emptyClient); }}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border border-dashed border-border text-muted-foreground hover:border-navy-300 hover:text-navy-600 transition-all">
            {t("dashboard.new.client.addNew")}
          </button>
          {selectedClientId && (
            <button type="button" onClick={clearClient} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 text-red-400 hover:text-red-600 transition-colors">
              × {t("dashboard.index.client.removeClient")}
            </button>
          )}
        </div>
      )}

      {clientOpen && (
        <div className="border-t border-border px-5 pt-3 pb-4 animate-in fade-in slide-in-from-top-1 duration-200">
          {savedClients.length > 0 && clientMode !== "new" && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {savedClients.slice(0, 6).map(c => (
                <button key={c.id} type="button" onClick={() => selectSavedClient(c)}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-[var(--radius-sm)] border transition-all",
                    selectedClientId === c.id
                      ? "border-navy-300 bg-navy-50 text-navy-700 font-semibold shadow-sm"
                      : "border-border text-muted-foreground hover:border-navy-200 hover:bg-navy-50/50"
                  )}>
                  <User className="h-3 w-3" />
                  {c.nome}
                </button>
              ))}
              <button type="button" onClick={() => { setClientMode("new"); setSelectedClientId(null); setClientForm(emptyClient); }}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-dashed border-border text-muted-foreground hover:border-navy-300 hover:text-navy-600 transition-all">
                {t("dashboard.index.client.addNewClient")}
              </button>
            </div>
          )}

          {savedClients.length === 0 && clientMode !== "new" && (
            <button type="button" onClick={() => setClientMode("new")}
              className="w-full mb-3 py-2 rounded-[var(--radius-sm)] border border-dashed border-border text-xs text-muted-foreground hover:border-navy-300 hover:text-navy-600 hover:bg-navy-50/30 transition-all">
              {t("dashboard.new.client.addClientData")}
            </button>
          )}

          {clientMode === "new" && (
            <div className="space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">{t("dashboard.index.client.nameLabel")}</Label>
                <Input placeholder={t("dashboard.new.client.namePlaceholder")} value={clientForm.nome}
                  onChange={e => setClientForm(f => ({ ...f, nome: e.target.value }))}
                  disabled={isSubmitting} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">{t("dashboard.new.client.addressLabel")}</Label>
                <Input placeholder={t("dashboard.new.client.addressPlaceholder")} value={clientForm.indirizzo}
                  onChange={e => setClientForm(f => ({ ...f, indirizzo: e.target.value }))}
                  disabled={isSubmitting} className="h-8 text-sm" />
              </div>
              <div className="grid grid-cols-5 gap-2">
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">City</Label>
                  <Input placeholder="Toronto" value={clientForm.city}
                    onChange={e => setClientForm(f => ({ ...f, city: e.target.value }))}
                    disabled={isSubmitting} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">{t("dashboard.new.client.province")}</Label>
                  <Input placeholder="ON" value={clientForm.province}
                    onChange={e => setClientForm(f => ({ ...f, province: e.target.value.toUpperCase() }))}
                    disabled={isSubmitting} className="h-8 text-sm" maxLength={2} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">{t("dashboard.new.client.postalCode")}</Label>
                  <Input placeholder="M5H 2N2" value={clientForm.postalCode}
                    onChange={e => setClientForm(f => ({ ...f, postalCode: e.target.value.toUpperCase() }))}
                    disabled={isSubmitting} className="h-8 text-sm" maxLength={7} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">{t("dashboard.new.client.businessNumber")}</Label>
                  <Input placeholder="123456789RT0001" value={clientForm.businessNumber}
                    onChange={e => setClientForm(f => ({ ...f, businessNumber: e.target.value.toUpperCase() }))}
                    disabled={isSubmitting} className="h-8 text-sm" maxLength={16} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">{t("dashboard.new.client.gstHst")}</Label>
                  <Input placeholder="123456789RT0001" value={clientForm.partitaIva}
                    onChange={e => setClientForm(f => ({ ...f, partitaIva: e.target.value }))}
                    disabled={isSubmitting} className="h-8 text-sm" maxLength={15} />
                </div>
              </div>
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                  <input type="checkbox" checked={rememberClient} onChange={e => setRememberClient(e.target.checked)}
                    className="rounded border-border text-navy-600 focus:ring-navy-500" />
                  {t("dashboard.new.client.remember")}
                </label>
                <button type="button" onClick={clearClient} className="text-xs text-muted-foreground hover:text-muted-foreground transition-colors">
                  {t("dashboard.new.client.cancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      </>}
    </section>
  );
}

/* ─── DashboardHome (default export) ────────────────────────────────────── */
/** Phase 86: a foreman lands on the crew's day, not on the owner's sales dashboard with parts hidden. */
export default function DashboardHome() {
  const { role } = useRole();
  return role === "foreman" ? <ForemanHome /> : <OwnerHome />;
}

/** Phase 93: the monthly quote allowance from the pricing data (Pro was shown as "unlimited"; it is 60). */
const planQuota = (plan: string | null | undefined): number | null => MARKETING_PLANS.find((p) => p.id === plan)?.quotaPerMonth ?? null;

/**
 * Phase 104: Today. What needs you first, the describe-a-job line, then the
 * period's numbers as one strip, the crew as one line and the next five
 * things — instead of a greeting followed by a tower of cards.
 */
function OwnerHome() {
  const { t } = useLanguage();
  const can = useCan();
  const { data: stats, isLoading: isLoadingStats } = useGetQuoteStats();
  const { data: subscription } = useGetSubscription();
  const { data: trialStatus } = useGetTrialStatus();
  const { data: profile } = useGetBusinessProfile();
  const { user } = useAuth();

  const recentQuotes = (stats?.recentQuotes || []).slice(0, 5);
  const firstName = user?.name?.split(" ")?.[0] || "";
  const isNewUser = !isLoadingStats && (stats?.total ?? 0) === 0;

  if (isLoadingStats) {
    return (
      // Phase 115: the greeting, what needs you, the numbers and recent quotes, as they will sit.
      <div className="today skel-wait" aria-busy="true">
        <div className="page-head" aria-hidden="true">
          <div style={{ width: "100%" }}>
            <Skeleton className="skel-line skel-h1" style={{ width: 220, marginTop: 0 }} />
            <Skeleton className="skel-line skel-sub" style={{ width: 280, marginTop: 10 }} />
          </div>
        </div>
        <CardSkeleton rows={3} list={{ lead: "icon", chip: false }} immediate />
        <StatStripSkeleton cells={4} immediate className="today-gap" />
        <CardSkeleton rows={5} immediate />
      </div>
    );
  }

  return (
    <div className="today animate-in fade-in duration-500">
      <div className="page-head">
        <div>
          <h1>{firstName ? t("dashboard.index.greetingName").replace("{name}", firstName) : t("dashboard.index.greetingFallback")}</h1>
          <p className="sub">
            {isNewUser
              ? t("dashboard.index.subtitleNewUser")
              : subscription?.isActive
                ? t("dashboard.index.subtitlePlanActive")
                    .replace("{plan}", subscription.plan === "monthly_pro" ? "Pro" : subscription.plan === "monthly_business" ? "Business" : subscription.plan === "monthly_elite" ? "Elite" : "Starter")
                    .replace("{quotesInfo}", planQuota(subscription.plan) === null ? t("dashboard.index.unlimitedQuotes") : t("dashboard.index.quotesPerMonth").replace("{count}", String(planQuota(subscription.plan))))
                : t("dashboard.index.subtitleTotalQuotes").replace("{count}", String(stats?.total ?? 0))}
          </p>
        </div>
        {/* On a phone the + in the top bar is the new-quote button. */}
        {can("quotes", "edit") && (
          <div className="head-actions today-new">
            <Link href="/dashboard/new" className="btn btn-navy">
              <Plus className="h-4 w-4" />
              {t("dashboard.index.quickActions.newQuote")}
            </Link>
          </div>
        )}
      </div>

      <PaymentReturnNotice />

      {can("quotes", "edit") && <DashboardComposer />}

      <InstallPrompt className="mt-4" />

      {trialStatus?.isTrialActive && !subscription?.isActive && (
        <div className="today-gap">
          <TrialBanner
            downloadsUsed={trialStatus.trialDownloadsUsed}
            downloadsLimit={trialStatus.trialDownloadsLimit}
            daysLeft={trialStatus.trialDaysLeft}
          />
        </div>
      )}

      {isNewUser ? (
        <div className="today-gap">
          <OnboardingView profileDone={!!profile?.companyName} />
        </div>
      ) : (
        <>
          <div className="today-grid">
            <div className="today-main">
              <NeedsYouCard />
              <TodayStats />
              {recentQuotes.length > 0 && (
                <section className="card" aria-labelledby="recent-quotes-h">
                  <div className="today-head">
                    <h2 id="recent-quotes-h">{t("dashboard.index.recentQuotes.title")}</h2>
                    <Link href="/dashboard/quotes" className="cta-link today-link">
                      {t("dashboard.index.recentQuotes.viewAll")} <ArrowRight className="chev" />
                    </Link>
                  </div>
                  <ul className="lrows">
                    {recentQuotes.map((quote) => {
                      const chip = quoteStatusChip(quote.status, t);
                      return (
                        <li key={quote.id}>
                          <ListRow
                            href={`/dashboard/quotes/${quote.id}`}
                            title={quote.clientData?.nome || t("dashboard.quotesList.clientNotSpecified")}
                            meta={new Date(quote.createdAt).toLocaleDateString("en-CA")}
                            amount={formatCadWhole(quote.totale)}
                            end={<span className={cn("chip", chip.cls)}>{chip.label}</span>}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </div>
            <div className="today-side">
              <CrewLine />
              <NextUpCard />
              {/* Phase 79: 60-day cash-flow outlook (Elite) */}
              <CashFlowCard plan={subscription?.plan} isActive={subscription?.isActive} />
            </div>
          </div>

          {!isNativeApp && !subscription?.isActive && (
            <div className="bg-gradient-to-r from-navy-50 to-teal-50 border border-navy-100 rounded-[var(--radius)] p-4 flex items-center justify-between gap-4 today-gap">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-navy-100 flex items-center justify-center shrink-0">
                  <Crown className="h-4 w-4 text-navy-500" />
                </div>
                <div>
                  <div className="font-semibold text-foreground text-sm">{t("dashboard.index.unlockAll.title")}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t("dashboard.index.unlockAll.desc")}</div>
                </div>
              </div>
              <UpgradeLink className="shrink-0 btn-gradient inline-flex h-8 items-center justify-center px-3 text-xs font-semibold">
                {t("dashboard.index.unlockAll.cta")}
              </UpgradeLink>
            </div>
          )}

          {!isNativeApp && subscription?.isActive && subscription?.plan === "monthly_starter" && (
            <div className="today-gap"><StarterUpgradeCard /></div>
          )}
        </>
      )}
    </div>
  );
}
