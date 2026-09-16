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
  TrendingUp,
  CalendarDays,
  Sparkles,
  Plus,
  ArrowRight,
  Crown,
  Zap,
  Lock,
  CheckCircle2,
  MessageSquare,
  Download,
  Building2,
  Clock,
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

/* ─── plan helpers ─────────────────────────────────────────────────────────── */

function getMaxPhotos(plan: string | null | undefined, isActive: boolean): number {
  if (!isActive) return 0;
  if (plan === "monthly_elite") return 5;
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

/* ─── PlanBadge ─────────────────────────────────────────────────────────── */
function PlanBadge({ plan }: { plan: string | null | undefined }) {
  if (!plan) return null;
  const isElite = plan === "monthly_elite";
  const isPro = plan === "monthly_pro";
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
        isElite
          ? "bg-teal-100 text-teal-700 border border-teal-200"
          : isPro
            ? "bg-amber-100 text-amber-700 border border-amber-200"
            : "bg-navy-100 text-navy-700 border border-navy-200"
      }`}
    >
      {isPro || isElite ? <Crown className="h-2.5 w-2.5" /> : <Zap className="h-2.5 w-2.5" />}
      {isElite ? "Elite" : isPro ? "Pro" : "Starter"}
    </span>
  );
}

/* ─── STAT_CARDS ─────────────────────────────────────────────────────────── */
function useStatCards() {
  const { t } = useLanguage();
  return [
    { key: "thisMonth" as const, label: t("dashboard.index.stat.thisMonth"), icon: CalendarDays, color: "text-navy-500", accent: "bg-navy-50", border: "border-navy-200" },
    { key: "unlocked" as const, label: t("dashboard.index.stat.unlocked"), icon: CheckCircle2, color: "text-emerald-500", accent: "bg-emerald-50", border: "border-emerald-200" },
    { key: "unlockedRevenue" as const, label: t("dashboard.index.stat.unlockedRevenue"), icon: TrendingUp, color: "text-blue-500", accent: "bg-blue-50", border: "border-blue-200", isCurrency: true },
    { key: "avgValue" as const, label: t("dashboard.index.stat.avgValue"), icon: Sparkles, color: "text-amber-500", accent: "bg-amber-50", border: "border-amber-200", isCurrency: true },
  ];
}

/* ─── StatusBadge ────────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  switch (status) {
    case "unlocked":
      return <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded-full"><CheckCircle2 className="h-2.5 w-2.5" /> {t("dashboard.index.status.unlocked")}</span>;
    case "pending_payment":
      return <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full">{t("dashboard.index.status.pending")}</span>;
    default:
      return <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-muted text-muted-foreground border border-border px-1.5 py-0.5 rounded-full"><Lock className="h-2.5 w-2.5" /> {t("dashboard.index.status.draft")}</span>;
  }
}

/* ─── StarterUpgradeCard ─────────────────────────────────────────────────── */
function StarterUpgradeCard() {
  const { t } = useLanguage();
  const createPortal = useCreateCustomerPortalSession();
  return (
    <div className="bg-gradient-to-r from-amber-50 to-navy-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
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
function OnboardingView() {
  const { t } = useLanguage();
  const steps = [
    { icon: Building2, num: "1", title: t("dashboard.index.onboarding.step1.title"), desc: t("dashboard.index.onboarding.step1.desc"), href: "/dashboard/profile", cta: t("dashboard.index.onboarding.step1.cta") },
    { icon: MessageSquare, num: "2", title: t("dashboard.index.onboarding.step2.title"), desc: t("dashboard.index.onboarding.step2.desc"), href: "/dashboard/new", cta: t("dashboard.index.onboarding.step2.cta") },
    { icon: Download, num: "3", title: t("dashboard.index.onboarding.step3.title"), desc: t("dashboard.index.onboarding.step3.desc"), href: null, cta: null },
  ];
  return (
    <div className="space-y-3">
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 pt-6 pb-5 text-center">
          <div className="mx-auto h-12 w-12 rounded-xl flex items-center justify-center mb-3" style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.12), rgba(6,182,212,0.12))" }}>
            <Sparkles className="h-6 w-6 text-navy-500" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-1">{t("dashboard.index.onboarding.welcomePrefix")} <span className="quoteai-word text-lg">QuoteAI</span>!</h2>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mb-5">
            {t("dashboard.index.onboarding.subtitle")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 text-left">
            {steps.map(({ icon: Icon, num, title, desc, href, cta }) => (
              <div key={num} className="rounded-lg bg-muted border border-border p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="h-5 w-5 rounded-full bg-navy-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{num}</span>
                  <Icon className="h-3.5 w-3.5 text-navy-500" />
                  <span className="text-sm font-semibold text-foreground">{title}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-1.5">{desc}</p>
                {href && cta && <Link href={href} className="text-xs font-semibold text-navy-600 hover:text-navy-700 transition-colors">{cta}</Link>}
              </div>
            ))}
          </div>
          <Link href="/dashboard/new" className="btn-gradient inline-flex h-9 items-center justify-center px-6 text-sm font-semibold gap-2">
            <Plus className="h-3.5 w-3.5" />
            {t("dashboard.index.onboarding.ctaButton")}
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <Link href="/dashboard/profile" className="bg-card border border-border rounded-xl p-3 flex items-center gap-2.5 hover:border-navy-200 hover:bg-navy-50/30 transition-all group shadow-sm">
          <div className="h-7 w-7 rounded-lg bg-navy-100 flex items-center justify-center"><Building2 className="h-3.5 w-3.5 text-navy-500" /></div>
          <span className="text-sm font-medium text-foreground group-hover:text-navy-700">{t("dashboard.index.onboarding.companyProfile")}</span>
        </Link>
        <Link href="/dashboard/billing" className="bg-card border border-border rounded-xl p-3 flex items-center gap-2.5 hover:border-amber-200 hover:bg-amber-50/30 transition-all group shadow-sm">
          <div className="h-7 w-7 rounded-lg bg-amber-100 flex items-center justify-center"><Crown className="h-3.5 w-3.5 text-amber-500" /></div>
          <span className="text-sm font-medium text-foreground group-hover:text-amber-700">{t("dashboard.index.onboarding.plansPricing")}</span>
        </Link>
        <Link href="/dashboard/new" className="bg-card border border-border rounded-xl p-3 flex items-center gap-2.5 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all group shadow-sm">
          <div className="h-7 w-7 rounded-lg bg-emerald-100 flex items-center justify-center"><Sparkles className="h-3.5 w-3.5 text-emerald-500" /></div>
          <span className="text-sm font-medium text-foreground group-hover:text-emerald-700">{t("dashboard.index.onboarding.createQuote")}</span>
        </Link>
      </div>
    </div>
  );
}

/* ─── TrialBanner ────────────────────────────────────────────────────────── */
function TrialBanner({ downloadsUsed, downloadsLimit, daysLeft }: { downloadsUsed: number; downloadsLimit: number; daysLeft: number | null | undefined }) {
  const { t } = useLanguage();
  const remaining = downloadsLimit - downloadsUsed;
  return (
    <div className="bg-gradient-to-r from-navy-50 to-teal-50 border border-navy-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-8 w-8 rounded-lg bg-navy-100 flex items-center justify-center shrink-0">
          <Gift className="h-4 w-4 text-navy-600" />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-foreground text-sm">
            {t("dashboard.index.trial.active")}
            {typeof daysLeft === "number" && (
              <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-medium text-navy-600 bg-navy-100 px-1.5 py-0.5 rounded-full">
                <Clock className="h-2.5 w-2.5" />
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
      {remaining > 0 ? (
        <Link href="/dashboard/new" className="shrink-0 btn-gradient inline-flex h-8 items-center justify-center px-3 text-xs font-semibold gap-1">
          <Sparkles className="h-3 w-3" />
          {t("dashboard.index.trial.createNow")}
        </Link>
      ) : (
        <Link href="/dashboard/billing" className="shrink-0 btn-gradient inline-flex h-8 items-center justify-center px-3 text-xs font-semibold">
          {t("dashboard.index.trial.subscribe")}
        </Link>
      )}
    </div>
  );
}

/* ─── DashboardQuickBar ──────────────────────────────────────────────────── */
function DashboardQuickBar() {
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
    <div className="space-y-2">
      {/* ── AI Bar ── */}
      <div className="ai-bar-glow bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
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
                <button
                  type="button"
                  onClick={() => removeDoc(idx)}
                  disabled={isSubmitting}
                  className="ml-0.5 text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {photos.length + docs.length < MAX_ATTACHMENTS && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
                className="w-auto px-2 h-7 rounded-lg border-2 border-dashed border-border hover:border-navy-300 flex items-center gap-0.5 text-muted-foreground hover:text-navy-500 transition-colors text-[10px]"
              >
                <ImagePlus className="h-3 w-3" />
                <span>{t("dashboard.new.add")}</span>
              </button>
            )}
          </div>
        )}

        {/* Bar row */}
        <div className="flex items-center gap-2 px-3 py-3">
          {/* Upload */}
          <div className="group relative shrink-0">
            {photoAllowed ? (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting || photos.length + docs.length >= MAX_ATTACHMENTS}
                className={cn(
                  "h-8 w-8 flex items-center justify-center rounded-xl transition-colors",
                  (photos.length > 0 || docs.length > 0) ? "bg-navy-100 text-navy-600 hover:bg-navy-200" : "text-muted-foreground hover:bg-accent",
                  (isSubmitting || photos.length + docs.length >= MAX_ATTACHMENTS) && "opacity-40 cursor-not-allowed"
                )}>
                <ImagePlus className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" disabled className="h-8 w-8 flex items-center justify-center rounded-xl text-muted-foreground cursor-not-allowed">
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

          <Sparkles className="h-4 w-4 text-navy-400 shrink-0" />
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && canSubmit) { e.preventDefault(); handleSubmit(); } }}
            placeholder={t("dashboard.new.inputPlaceholder")}
            className="flex-1 text-sm outline-none placeholder:text-muted-foreground text-foreground bg-transparent min-w-0"
            disabled={isSubmitting}
          />

          {/* Mic */}
          <MicButton
            disabled={isSubmitting}
            onTranscribed={text => setInput(prev => (prev.trim() ? `${prev.trim()} ${text}` : text))}
          />

          {/* Send */}
          <button onClick={handleSubmit} disabled={!canSubmit}
            className={cn(
              "h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-all",
              canSubmit ? "btn-gradient shadow-sm" : "bg-muted cursor-not-allowed"
            )}>
            {isSubmitting
              ? <Loader2 className="h-4 w-4 animate-spin text-white" />
              : <ArrowRight className={cn("h-4 w-4", canSubmit ? "text-white" : "text-muted-foreground")} />
            }
          </button>
        </div>

        {isSubmitting && (
          <div className="px-3 pb-3 text-xs text-navy-600 font-medium flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            {(photos.length > 0 || docs.length > 0) ? t("dashboard.index.quickBar.analyzingAttachments") : t("dashboard.index.quickBar.generatingQuote")}
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        multiple className="hidden"
        onChange={e => { if (e.target.files) { addFiles(e.target.files); e.target.value = ""; } }}
        disabled={isSubmitting}
      />

      {/* ── Client Section ── */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* Header — always clickable to toggle */}
        <button
          type="button"
          onClick={() => setClientOpen(v => !v)}
          className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-accent transition-colors"
        >
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">{t("dashboard.new.client.label")}</span>
            {clientForm.nome && !clientOpen && (
              <span className="text-xs font-semibold text-navy-700 bg-navy-50 border border-navy-100 px-2 py-0.5 rounded-full">
                {clientForm.nome}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {!clientOpen && !clientForm.nome && (
              <span className="text-[11px] text-muted-foreground">{t("dashboard.new.client.optional")}</span>
            )}
            {clientOpen
              ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            }
          </div>
        </button>

        {/* Collapsed: compact chips for saved clients */}
        {!clientOpen && savedClients.length > 0 && (
          <div className="px-4 pb-2.5 flex flex-wrap gap-1.5 border-t border-border pt-2">
            {savedClients.slice(0, 5).map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => selectSavedClient(c)}
                className={cn(
                  "inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border transition-all",
                  selectedClientId === c.id
                    ? "border-navy-300 bg-navy-50 text-navy-700 font-semibold"
                    : "border-border text-muted-foreground hover:border-navy-200 hover:bg-navy-50/50"
                )}
              >
                <User className="h-2.5 w-2.5" />
                {c.nome}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setClientOpen(true); setClientMode("new"); setSelectedClientId(null); setClientForm(emptyClient); }}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border border-dashed border-border text-muted-foreground hover:border-navy-300 hover:text-navy-600 transition-all"
            >
              {t("dashboard.new.client.addNew")}
            </button>
            {selectedClientId && (
              <button type="button" onClick={clearClient} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 text-red-400 hover:text-red-600 transition-colors">
                × {t("dashboard.index.client.removeClient")}
              </button>
            )}
          </div>
        )}

        {/* Expanded panel */}
        {clientOpen && (
          <div className="border-t border-border px-4 pt-3 pb-4 animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Saved clients chips in expanded view */}
            {savedClients.length > 0 && clientMode !== "new" && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {savedClients.slice(0, 6).map(c => (
                  <button key={c.id} type="button" onClick={() => selectSavedClient(c)}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl border transition-all",
                      selectedClientId === c.id
                        ? "border-navy-300 bg-navy-50 text-navy-700 font-semibold shadow-sm"
                        : "border-border text-muted-foreground hover:border-navy-200 hover:bg-navy-50/50"
                    )}>
                    <User className="h-3 w-3" />
                    {c.nome}
                  </button>
                ))}
                <button type="button" onClick={() => { setClientMode("new"); setSelectedClientId(null); setClientForm(emptyClient); }}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl border border-dashed border-border text-muted-foreground hover:border-navy-300 hover:text-navy-600 transition-all">
                  {t("dashboard.index.client.addNewClient")}
                </button>
              </div>
            )}

            {/* No saved clients CTA (collapsed-like prompt) */}
            {savedClients.length === 0 && clientMode !== "new" && (
              <button
                type="button"
                onClick={() => setClientMode("new")}
                className="w-full mb-3 py-2 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:border-navy-300 hover:text-navy-600 hover:bg-navy-50/30 transition-all"
              >
                {t("dashboard.new.client.addClientData")}
              </button>
            )}

            {/* Form */}
            {(clientMode === "new") && (
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
                    <Label className="text-xs font-medium text-muted-foreground">Postal Code</Label>
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
      </div>
    </div>
  );
}

/* ─── DashboardHome (default export) ────────────────────────────────────── */
export default function DashboardHome() {
  const { t } = useLanguage();
  const STAT_CARDS = useStatCards();
  const { data: stats, isLoading: isLoadingStats } = useGetQuoteStats();
  const { data: subscription } = useGetSubscription();
  const { data: trialStatus } = useGetTrialStatus();
  const { user } = useAuth();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(amount);

  const recentQuotes = stats?.recentQuotes || [];
  const firstName = user?.name?.split(" ")?.[0] || "";
  const isNewUser = !isLoadingStats && (stats?.total ?? 0) === 0;

  if (isLoadingStats) {
    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-52 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* ── div 1: Hero greeting ── */}
      <div className="hero-sheen relative overflow-hidden rounded-xl bg-gradient-to-br from-navy-600 via-navy-500 to-teal-500 px-5 py-4 text-white shadow-lg shadow-navy-300/40">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, white 0%, transparent 60%)" }} />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-lg font-bold tracking-tight">{firstName ? t("dashboard.index.greetingName").replace("{name}", firstName) : t("dashboard.index.greetingFallback")}</h1>
              {subscription?.isActive && <PlanBadge plan={subscription.plan} />}
            </div>
            <p className="text-white/75 text-xs">
              {isNewUser
                ? t("dashboard.index.subtitleNewUser")
                : subscription?.isActive
                  ? t("dashboard.index.subtitlePlanActive")
                      .replace("{plan}", subscription.plan === "monthly_pro" ? "Pro" : subscription.plan === "monthly_elite" ? "Elite" : "Starter")
                      .replace("{quotesInfo}", subscription.plan === "monthly_starter" ? t("dashboard.index.quotesPerMonth") : t("dashboard.index.unlimitedQuotes"))
                  : t("dashboard.index.subtitleTotalQuotes").replace("{count}", String(stats?.total ?? 0))}
            </p>
          </div>
          <Link href="/dashboard/new" className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-card/20 hover:bg-card/30 text-white text-xs font-semibold transition-colors backdrop-blur-sm border border-white/20">
            <Plus className="h-3.5 w-3.5" />
            {t("nav.new")}
          </Link>
        </div>
      </div>

      {/* ── div 2: AI bar + client section ── */}
      <DashboardQuickBar />

      {/* ── Trial banner ── */}
      {trialStatus?.isTrialActive && !subscription?.isActive && (
        <TrialBanner
          downloadsUsed={trialStatus.trialDownloadsUsed}
          downloadsLimit={trialStatus.trialDownloadsLimit}
          daysLeft={trialStatus.trialDaysLeft}
        />
      )}

      {/* ── Onboarding vs normal view ── */}
      {isNewUser ? (
        <OnboardingView />
      ) : (
        <div className="space-y-4">
          {/* Stat cards */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {STAT_CARDS.map(({ key, label, icon: Icon, color, accent, border, isCurrency }) => {
              const raw = stats?.[key] ?? 0;
              const value = isCurrency ? formatCurrency(raw as number) : String(raw);
              return (
                <div key={key} className={`bg-card rounded-2xl border ${border} p-3 card-soft transition-all`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">{label}</span>
                    <div className={`h-7 w-7 rounded-lg ${accent} flex items-center justify-center`}>
                      <Icon className={`h-3.5 w-3.5 ${color}`} />
                    </div>
                  </div>
                  <div className="text-xl font-extrabold text-foreground truncate">{value}</div>
                </div>
              );
            })}
          </div>

          {/* Subscription upsell */}
          {!subscription?.isActive && (
            <div className="bg-gradient-to-r from-navy-50 to-teal-50 border border-navy-100 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-navy-100 flex items-center justify-center shrink-0">
                  <Crown className="h-4 w-4 text-navy-500" />
                </div>
                <div>
                  <div className="font-semibold text-foreground text-sm">{t("dashboard.index.unlockAll.title")}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t("dashboard.index.unlockAll.desc")}</div>
                </div>
              </div>
              <Link href="/dashboard/billing" className="shrink-0 btn-gradient inline-flex h-8 items-center justify-center px-3 text-xs font-semibold">
                {t("dashboard.index.unlockAll.cta")}
              </Link>
            </div>
          )}

          {/* Starter → Pro upsell */}
          {subscription?.isActive && subscription?.plan === "monthly_starter" && <StarterUpgradeCard />}

          {/* Recent quotes */}
          <div className="bg-card rounded-2xl border border-border card-soft overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold text-foreground">{t("dashboard.index.recentQuotes.title")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.index.recentQuotes.subtitle").replace("{count}", String(recentQuotes.length))}</p>
              </div>
              <Link href="/dashboard/quotes" className="inline-flex items-center gap-1 text-xs font-semibold text-navy-600 hover:text-navy-700 transition-colors">
                {t("dashboard.index.recentQuotes.viewAll")} <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div>
              {recentQuotes.map((quote, idx) => (
                <Link
                  key={quote.id}
                  href={`/dashboard/quotes/${quote.id}`}
                  className={`flex items-center justify-between px-4 py-2.5 hover:bg-accent transition-colors cursor-pointer ${idx !== recentQuotes.length - 1 ? "border-b border-border" : ""}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.10), rgba(6,182,212,0.10))" }}>
                      <FileText className="h-3 w-3 text-navy-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-foreground text-sm truncate">{quote.clientData?.nome || t("dashboard.quotesList.clientNotSpecified")}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <StatusBadge status={quote.status} />
                        <span className="text-[10px] text-muted-foreground">{new Date(quote.createdAt).toLocaleDateString("en-CA")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-3">
                    <span className="font-bold text-sm text-foreground">
                      {new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(quote.totale)}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Link href="/dashboard/new" className="bg-card border border-border rounded-2xl p-3 flex items-center gap-2.5 hover:border-navy-200 hover:bg-navy-50/30 transition-all group card-soft">
              <div className="h-7 w-7 rounded-lg bg-navy-100 flex items-center justify-center"><Plus className="h-3.5 w-3.5 text-navy-500" /></div>
              <span className="text-sm font-medium text-foreground group-hover:text-navy-700">{t("dashboard.index.quickActions.newQuote")}</span>
            </Link>
            <Link href="/dashboard/quotes" className="bg-card border border-border rounded-2xl p-3 flex items-center gap-2.5 hover:border-blue-200 hover:bg-blue-50/30 transition-all group card-soft">
              <div className="h-7 w-7 rounded-lg bg-blue-100 flex items-center justify-center"><FileText className="h-3.5 w-3.5 text-blue-500" /></div>
              <span className="text-sm font-medium text-foreground group-hover:text-blue-700">{t("dashboard.index.quickActions.allQuotes")}</span>
            </Link>
            <Link href="/dashboard/profile" className="bg-card border border-border rounded-2xl p-3 flex items-center gap-2.5 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all group card-soft">
              <div className="h-7 w-7 rounded-lg bg-emerald-100 flex items-center justify-center"><Sparkles className="h-3.5 w-3.5 text-emerald-500" /></div>
              <span className="text-sm font-medium text-foreground group-hover:text-emerald-700">{t("dashboard.index.quickActions.companyProfile")}</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
