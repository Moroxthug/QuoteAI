import { useParams, useSearch } from "wouter";
import { useGetQuote, useGetBusinessProfile, useGenerateQuotePdf, useGetPlans, useUpdateQuote, useCreateCheckoutSession, useVerifyPayment, useGetSubscription, useUnlockQuoteWithSubscription, useCreateCustomerPortalSession, useRegenerateQuote, useDuplicateQuote, useUpgradeToCapitolatoPro, useGenerateQuotePdfPro, useGetTrialStatus, useListClients, useSendQuotePdfEmail, useListQuoteVariants, useCreateQuoteVariant, useUpdateQuoteVariant, useDeleteQuoteVariant, getGetQuoteQueryKey, getVerifyPaymentQueryKey, getListQuotesQueryKey, getGetTrialStatusQueryKey, getListQuoteVariantsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Download, Lock, CheckCircle2, Edit2, Save, FileText, FileSpreadsheet, ImageIcon, ChevronDown, ChevronRight, Plus, Trash2, X, Pencil, Sparkles, AlertTriangle, RefreshCw, Loader2, Copy, Star, FileDown, LayoutTemplate, Users, Mail, Hammer } from "lucide-react";
import { useState, useRef, useEffect, Fragment } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { PaymentScheduleCard } from "@/components/payment-schedule-card";
import { QuoteContractCard } from "@/components/quote-contract-card";
import { jobsApi } from "@/lib/jobs-api";
import { hasFeature } from "@/lib/plans";
import type { PaymentSchedule } from "@/lib/payment-schedule";

function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

type EditVoce = {
  descrizione: string;
  um: string;
  quantita: number;
  prezzoUnitario: number;
};

type EditCapitolo = {
  lettera: string;
  titolo: string;
  osservazione: string;
  voci: EditVoce[];
};

export default function QuoteDetail() {
  const { t, lang } = useLanguage();
  const dateLocale = lang === "fr" ? frCA : enCA;
  const { id } = useParams();
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const paymentResult = searchParams.get("payment");

  const { data: quote, isLoading: isLoadingQuote } = useGetQuote(id || "");
  const { data: profile, isLoading: isLoadingProfile } = useGetBusinessProfile();
  const { data: plans } = useGetPlans();
  const { data: savedClients } = useListClients();
  const generatePdf = useGenerateQuotePdf();
  const updateQuote = useUpdateQuote();
  const createCheckout = useCreateCheckoutSession();
  const upgradeToCapitolato = useUpgradeToCapitolatoPro();
  const generatePdfPro = useGenerateQuotePdfPro();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Subscription status
  const { data: subscription } = useGetSubscription();
  const { data: trialStatus } = useGetTrialStatus();
  const unlockWithSub = useUnlockQuoteWithSubscription();
  const createPortal = useCreateCustomerPortalSession();
  const regenerateQuote = useRegenerateQuote();
  const duplicateQuote = useDuplicateQuote();
  const [, navigate] = useLocation();

  // Phase 22: Good/Better/Best tiered quotes
  const { data: variantsData } = useListQuoteVariants(id || "");
  const variants = variantsData?.variants ?? [];
  const createVariant = useCreateQuoteVariant();
  const updateVariant = useUpdateQuoteVariant();
  const deleteVariant = useDeleteQuoteVariant();

  // Regen panel state
  const [isRegenOpen, setIsRegenOpen] = useState(false);
  const [regenDescription, setRegenDescription] = useState("");

  const handleUpgrade = () => {
    createPortal.mutate(undefined, {
      onSuccess: (result) => { window.open(result.url, "_blank"); },
      onError: () => {
        toast({ title: t("dashboard.quoteDetail.error"), description: t("dashboard.quoteDetail.errorOpenPortal"), variant: "destructive" });
      }
    });
  };

  // Auto-unlock if user has active subscription and quote is locked
  const [subUnlockDone, setSubUnlockDone] = useState(false);
  useEffect(() => {
    if (
      subscription?.isActive &&
      quote?.status !== "unlocked" &&
      id &&
      !subUnlockDone
    ) {
      setSubUnlockDone(true);
      unlockWithSub.mutate({ data: { quoteId: id } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetQuoteQueryKey(id) });
        },
      });
    }
  }, [subscription, quote?.status, id, subUnlockDone, unlockWithSub, queryClient]);

  // When returning from Stripe with ?payment=success, verify and unlock the quote
  const [verifyDone, setVerifyDone] = useState(false);
  const verifyEnabled = !!id && paymentResult === "success" && !verifyDone && quote?.status !== "unlocked";
  const { data: verifyData } = useVerifyPayment(id || "", {
    query: {
      queryKey: getVerifyPaymentQueryKey(id || ""),
      enabled: verifyEnabled,
      refetchInterval: verifyEnabled ? 2000 : false,
    },
  });

  useEffect(() => {
    if (verifyData?.status === "unlocked" && !verifyDone) {
      setVerifyDone(true);
      queryClient.invalidateQueries({ queryKey: getGetQuoteQueryKey(id || "") });
      toast({ title: t("dashboard.quoteDetail.paymentConfirmed"), description: t("dashboard.quoteDetail.paymentConfirmedDesc") });
    }
  }, [verifyData, verifyDone, id, queryClient, toast]);

  const [localTemplateId, setLocalTemplateId] = useState<string>("standard");

  useEffect(() => {
    setLocalTemplateId(quote?.templateId ?? "standard");
  }, [quote?.templateId]);

  const [isCapitolatoDialogOpen, setIsCapitolatoDialogOpen] = useState(false);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  const handleCopyPublicLink = async () => {
    if (!id) return;
    const url = `${window.location.origin}/p/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: t("dashboard.quoteDetail.linkCopied"), description: t("dashboard.quoteDetail.linkCopiedDesc") });
    } catch {
      toast({ title: t("dashboard.quoteDetail.error"), description: t("dashboard.quoteDetail.errorCopyLink"), variant: "destructive" });
    }
  };

  const [isEditMode, setIsEditMode] = useState(false);
  const [editTitolo1, setEditTitolo1] = useState("");
  const [editTitolo2, setEditTitolo2] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editDescrizioneGenerale, setEditDescrizioneGenerale] = useState("");
  const [editScontoPerc, setEditScontoPerc] = useState(0);
  const [editIvaPerc, setEditIvaPerc] = useState(22);
  const [editCapitoli, setEditCapitoli] = useState<EditCapitolo[]>([]);
  const [editCondizioniPagamento, setEditCondizioniPagamento] = useState<string[]>([]);
  const [editClientNome, setEditClientNome] = useState("");
  const [editClientIndirizzo, setEditClientIndirizzo] = useState("");
  const [editClientCity, setEditClientCity] = useState("");
  const [editClientPostalCode, setEditClientPostalCode] = useState("");
  const [editClientProvince, setEditClientProvince] = useState("");
  const [editClientBusinessNumber, setEditClientBusinessNumber] = useState("");
  const [editClientPIVA, setEditClientPIVA] = useState("");

  const initializedForId = useRef<string | null>(null);

  useEffect(() => {
    if (quote && initializedForId.current !== id) {
      initializedForId.current = id || null;
      setClientName(quote.clientData?.nome || "");
      setClientAddress(quote.clientData?.indirizzo || "");
      if (quote.capitoli && quote.capitoli.length > 0) {
        setExpandedChapters(new Set(quote.capitoli.map(c => c.lettera)));
      }
    }
  }, [quote, id]);

  const toggleChapter = (lettera: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(lettera)) next.delete(lettera);
      else next.add(lettera);
      return next;
    });
  };

  const handleSaveClient = () => {
    if (!id) return;
    updateQuote.mutate({
      id,
      data: { clientData: { nome: clientName, indirizzo: clientAddress } }
    }, {
      onSuccess: (updatedQuote) => {
        setIsEditingClient(false);
        toast({ title: t("dashboard.quoteDetail.clientDataUpdated") });
        queryClient.setQueryData(getGetQuoteQueryKey(id), updatedQuote);
      }
    });
  };

  const downloadPdfFromUrl = async (pdfUrl: string, filename: string) => {
    try {
      const fullUrl = pdfUrl.startsWith("/api") ? pdfUrl : `/api/storage${pdfUrl}`;
      const response = await fetch(fullUrl, { credentials: "include" });
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      toast({ title: t("dashboard.quoteDetail.error"), description: t("dashboard.quoteDetail.errorDownloadPdf"), variant: "destructive" });
    }
  };

  const handleDownload = () => {
    if (!id || !quote) return;
    generatePdf.mutate({ id }, {
      onSuccess: (result) => {
        const numero = quote.numeroPreventivoData
          ? quote.numeroPreventivoData.replace(/\//g, "_")
          : `N\u00b0 ${quote.id.slice(0, 4).toUpperCase()} - ${new Date(quote.createdAt || Date.now()).toLocaleDateString("en-CA").replace(/\//g, "_")}`;
        const filename = `${t("dashboard.quoteDetail.filenamePrefix")} ${numero}.pdf`;
        if (result.pdfUrl) {
          downloadPdfFromUrl(result.pdfUrl, filename);
        } else {
          toast({ title: t("dashboard.quoteDetail.error"), description: t("dashboard.quoteDetail.errorDownloadPdf"), variant: "destructive" });
        }
        queryClient.invalidateQueries({ queryKey: getGetQuoteQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetTrialStatusQueryKey() });
      },
      onError: (err: unknown) => {
        const status = (err as { status?: number })?.status;
        if (status === 402) {
          setIsPaywallOpen(true);
        } else {
          toast({ title: t("dashboard.quoteDetail.error"), description: t("dashboard.quoteDetail.errorGeneratePdf"), variant: "destructive" });
        }
      }
    });
  };

  const sendPdfEmail = useSendQuotePdfEmail();

  const handleSendEmail = () => {
    if (!id || !quote || !emailTo.trim()) return;
    sendPdfEmail.mutate({
      id,
      data: { toEmail: emailTo.trim(), clientName: (quote.clientData as { nome?: string })?.nome || "" }
    }, {
      onSuccess: () => {
        setIsEmailDialogOpen(false);
        setEmailTo("");
        toast({ title: t("dashboard.quoteDetail.emailSent"), description: fmt(t("dashboard.quoteDetail.emailSentDesc"), { email: emailTo.trim() }) });
      },
      onError: (err: unknown) => {
        const status = (err as { status?: number })?.status;
        const msg = (err as { data?: { error?: string } })?.data?.error;
        if (status === 402) {
          setIsEmailDialogOpen(false);
          setIsPaywallOpen(true);
        } else {
          toast({ title: t("dashboard.quoteDetail.error"), description: msg || t("dashboard.quoteDetail.errorSendEmail"), variant: "destructive" });
        }
      }
    });
  };
  const [regeneratingVoceKey, setRegeneratingVoceKey] = useState<string | null>(null);

  const handleRegenerateSingleVoce = async (chapterIdx: number, voceIdx: number, briefTitle: string) => {
    if (!id || !quote) return;
    const key = `${chapterIdx}-${voceIdx}`;
    setRegeneratingVoceKey(key);
    try {
      const res = await fetch("/api/quotes/suggest-item-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: briefTitle }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const newDesc = `${briefTitle}\n${data.description}`;

      // Update local capitoli
      const updatedCapitoli = (quote.capitoli ?? []).map((cap, cIdx) => {
        if (cIdx !== chapterIdx) return cap;
        return {
          ...cap,
          voci: cap.voci.map((v, vIdx) => {
            if (vIdx !== voceIdx) return v;
            return { ...v, descrizione: newDesc };
          })
        };
      });

      updateQuote.mutate({
        id,
        data: { capitoli: updatedCapitoli }
      }, {
        onSuccess: (updatedQuote) => {
          queryClient.setQueryData(getGetQuoteQueryKey(id), updatedQuote);
          toast({ title: t("dashboard.quoteDetail.descriptionUpdated"), description: t("dashboard.quoteDetail.descriptionUpdatedDesc") });
        }
      });
    } catch (err) {
      toast({ title: t("dashboard.quoteDetail.error"), description: t("dashboard.quoteDetail.errorRegenerateDesc"), variant: "destructive" });
    } finally {
      setRegeneratingVoceKey(null);
    }
  };

  
  const [avviandoCantiere, setAvviandoCantiere] = useState(false);

  const handleAvviaCantiere = async () => {
    if (!quote || !id || avviandoCantiere) return;
    const clientName = (quote.clientData as { nome?: string })?.nome || t("dashboard.quoteDetail.genericClient");
    setAvviandoCantiere(true);
    try {
      // Phase 2: jobs live at /dashboard/jobs. Creating from a quote is
      // idempotent server-side (one job per quote); signed contracts create
      // the job automatically with milestones imported from the quote.
      const res = await jobsApi.create({
        name: `${quote.titoloPreventivoRiga2 || t("dashboard.quoteDetail.projectNamePrefix")} – ${clientName}`.slice(0, 200),
        quoteId: id,
        plannedStart: new Date().toISOString().split("T")[0],
      });
      toast({ title: res.created ? t("dashboard.quoteDetail.projectStarted") : t("dashboard.quoteDetail.projectAlreadyStarted"), description: res.created ? t("dashboard.quoteDetail.projectStartedDesc") : t("dashboard.quoteDetail.projectAlreadyStartedDesc") });
      navigate(`/dashboard/jobs/${res.job.id}`);
    } catch (err) {
      const e = err as Error & { code?: string };
      toast({ title: e.code === "PLAN_REQUIRED" ? t("jobs.planRequired") : t("dashboard.quoteDetail.error"), description: e.code === "PLAN_REQUIRED" ? e.message : t("dashboard.quoteDetail.errorStartProject"), variant: "destructive" });
    } finally {
      setAvviandoCantiere(false);
    }
  };

  const handleRegenerate = () => {
    if (!id) return;
    regenerateQuote.mutate({
      id,
      data: {
        newDescription: regenDescription.trim() || undefined,
        keepClientData: true,
      },
    }, {
      onSuccess: (updatedQuote) => {
        setIsRegenOpen(false);
        setRegenDescription("");
        setIsEditMode(false);
        initializedForId.current = null; // force re-init of edit state
        queryClient.setQueryData(getGetQuoteQueryKey(id), updatedQuote);
        toast({ title: t("dashboard.quoteDetail.quoteRegenerated"), description: t("dashboard.quoteDetail.quoteRegeneratedDesc") });
      },
      onError: () => {
        toast({ title: t("dashboard.quoteDetail.errorRegenerateTitle"), description: t("dashboard.quoteDetail.errorRegenerateQuote"), variant: "destructive" });
      },
    });
  };

  const handleUpgradeToCapitolato = () => {
    if (!id) return;
    if (!isPro) { setIsPaywallOpen(true); return; }
    setIsCapitolatoDialogOpen(true);
  };

  const handleConfirmCapitolatoUpgrade = () => {
    if (!id) return;
    upgradeToCapitolato.mutate({ id }, {
      onSuccess: (updatedQuote) => {
        setIsCapitolatoDialogOpen(false);
        queryClient.setQueryData(getGetQuoteQueryKey(id), updatedQuote);
        toast({ title: t("dashboard.quoteDetail.proSpecActivated"), description: t("dashboard.quoteDetail.proSpecActivatedDesc") });
      },
      onError: (err: unknown) => {
        setIsCapitolatoDialogOpen(false);
        const msg = (err as { data?: { error?: string } })?.data?.error ?? t("dashboard.quoteDetail.errorEnrichQuote");
        toast({ title: t("dashboard.quoteDetail.error"), description: msg, variant: "destructive" });
      },
    });
  };

  const handleDownloadProPdf = () => {
    if (!id || !quote) return;
    generatePdfPro.mutate({ id }, {
      onSuccess: (result) => {
        const pdfFullUrl = result.pdfUrl.startsWith("/api") ? result.pdfUrl : `/api/storage${result.pdfUrl}`;
        window.open(pdfFullUrl, "_blank");
        queryClient.invalidateQueries({ queryKey: getGetQuoteQueryKey(id) });
        toast({ title: t("dashboard.quoteDetail.proPdfGenerated"), description: t("dashboard.quoteDetail.proPdfGeneratedDesc") });
      },
      onError: () => {
        toast({ title: t("dashboard.quoteDetail.error"), description: t("dashboard.quoteDetail.errorGenerateProPdf"), variant: "destructive" });
      },
    });
  };

  const handleUnlock = () => { setIsPaywallOpen(true); };

  const handleCheckout = (planType: string) => {
    if (!id) return;
    createCheckout.mutate({
      data: { quoteId: id, planType: planType as Parameters<typeof createCheckout.mutate>[0]["data"]["planType"] }
    }, {
      onSuccess: (result) => { window.open(result.url, "_blank"); }
    });
  };

  const enterEditMode = () => {
    if (!quote) return;
    setEditTitolo1(quote.titoloPreventivoRiga1 || "");
    setEditTitolo2(quote.titoloPreventivoRiga2 || "");
    setEditNote(quote.note || "");
    setEditDescrizioneGenerale(quote.descrizioneGenerale || "");
    setEditScontoPerc(quote.sconto?.percentuale ?? 0);
    setEditIvaPerc(quote.ivaPercentuale ?? 22);
    setEditCapitoli(
      (quote.capitoli ?? []).map(cap => ({
        lettera: cap.lettera,
        titolo: cap.titolo,
        osservazione: cap.osservazione ?? "",
        voci: cap.voci.map(v => ({
          descrizione: v.descrizione,
          um: v.um,
          quantita: v.quantita,
          prezzoUnitario: v.prezzoUnitario,
        })),
      }))
    );
    setEditCondizioniPagamento(
      Array.isArray(quote.condizioniPagamento) ? [...quote.condizioniPagamento] : []
    );
    setEditClientNome(quote.clientData?.nome || "");
    setEditClientIndirizzo(quote.clientData?.indirizzo || "");
    setEditClientCity(quote.clientData?.city || "");
    setEditClientPostalCode(quote.clientData?.postalCode || "");
    setEditClientProvince(quote.clientData?.province || "");
    setEditClientBusinessNumber(quote.clientData?.businessNumber || "");
    setEditClientPIVA(quote.clientData?.partitaIva || "");
    setIsEditMode(true);
  };

  const handleSaveEdit = () => {
    if (!id) return;
    const newCapitoli = editCapitoli.map(cap => ({
      lettera: cap.lettera,
      titolo: cap.titolo,
      osservazione: cap.osservazione,
      voci: cap.voci.map(v => ({
        descrizione: v.descrizione,
        um: v.um,
        quantita: Number(v.quantita),
        prezzoUnitario: Number(v.prezzoUnitario),
        totale: Number(v.quantita) * Number(v.prezzoUnitario),
      })),
      subtotale: cap.voci.reduce((s, v) => s + Number(v.quantita) * Number(v.prezzoUnitario), 0),
    }));

    const subtotale = newCapitoli.reduce((s, cap) => s + cap.subtotale, 0);
    const imponibile = editScontoPerc > 0 ? subtotale * (1 - editScontoPerc / 100) : subtotale;
    const ivaValore = imponibile * (editIvaPerc / 100);
    const totale = imponibile + ivaValore;
    const sconto = editScontoPerc > 0
      ? { percentuale: editScontoPerc, importoScontato: imponibile }
      : null;

    const updatedClientData = {
      nome: editClientNome.trim() || (quote?.clientData?.nome ?? ""),
      indirizzo: editClientIndirizzo.trim() || (quote?.clientData?.indirizzo ?? ""),
      ...(editClientCity.trim() && { city: editClientCity.trim() }),
      ...(editClientPostalCode.trim() && { postalCode: editClientPostalCode.trim() }),
      ...(editClientProvince.trim() && { province: editClientProvince.trim() }),
      ...(editClientBusinessNumber.trim() && { businessNumber: editClientBusinessNumber.trim() }),
      ...(editClientPIVA.trim() && { partitaIva: editClientPIVA.trim() }),
    };

    updateQuote.mutate({
      id,
      data: {
        capitoli: newCapitoli,
        titoloPreventivoRiga1: editTitolo1 || null,
        titoloPreventivoRiga2: editTitolo2 || null,
        note: editNote,
        descrizioneGenerale: editDescrizioneGenerale,
        sconto,
        subtotale,
        ivaPercentuale: editIvaPerc,
        ivaValore,
        totale,
        condizioniPagamento: editCondizioniPagamento,
        clientData: updatedClientData,
      }
    }, {
      onSuccess: (updatedQuote) => {
        setIsEditMode(false);
        toast({ title: t("dashboard.quoteDetail.quoteUpdatedSuccess") });
        queryClient.setQueryData(getGetQuoteQueryKey(id), updatedQuote);
      },
      onError: () => {
        toast({ title: t("dashboard.quoteDetail.error"), description: t("dashboard.quoteDetail.errorSaveChanges"), variant: "destructive" });
      }
    });
  };

  const updateVoce = (capIdx: number, voceIdx: number, field: keyof EditVoce, value: string | number) => {
    setEditCapitoli(prev => prev.map((cap, ci) =>
      ci !== capIdx ? cap : {
        ...cap,
        voci: cap.voci.map((v, vi) =>
          vi !== voceIdx ? v : { ...v, [field]: value }
        )
      }
    ));
  };

  const addVoce = (capIdx: number) => {
    setEditCapitoli(prev => prev.map((cap, ci) =>
      ci !== capIdx ? cap : {
        ...cap,
        voci: [...cap.voci, { descrizione: "", um: "a.c.", quantita: 1, prezzoUnitario: 0 }]
      }
    ));
  };

  const removeVoce = (capIdx: number, voceIdx: number) => {
    setEditCapitoli(prev => prev.map((cap, ci) =>
      ci !== capIdx ? cap : { ...cap, voci: cap.voci.filter((_, vi) => vi !== voceIdx) }
    ));
  };

  const updateCapitolo = (capIdx: number, field: keyof Omit<EditCapitolo, "voci">, value: string) => {
    setEditCapitoli(prev => prev.map((cap, ci) =>
      ci !== capIdx ? cap : { ...cap, [field]: value }
    ));
  };

  const addCapitolo = () => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const usedLetters = new Set(editCapitoli.map(c => c.lettera));
    const nextLetter =
      [...letters].find(l => !usedLetters.has(l)) ??
      String(editCapitoli.length + 1);
    setEditCapitoli(prev => [
      ...prev,
      { lettera: nextLetter, titolo: t("dashboard.quoteDetail.newChapterDefault"), osservazione: t("dashboard.quoteDetail.ordinaryItemDefault"), voci: [] }
    ]);
  };

  const removeCapitolo = (capIdx: number) => {
    setEditCapitoli(prev => prev.filter((_, ci) => ci !== capIdx));
  };

  if (isLoadingQuote || isLoadingProfile) {
    return <div className="p-8 space-y-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!quote) return <div>{t("dashboard.quoteDetail.quoteNotFound")}</div>;

  const isPro = subscription?.isActive && (subscription?.plan === "monthly_pro" || subscription?.plan === "monthly_elite");
  const isTrialActive = trialStatus?.isTrialActive ?? false;
  // Pro/Elite subscribers and active trial users can always download
  const isLocked = quote.status !== "unlocked" && !isPro && !isTrialActive;
  // Editing is permanently locked once the PDF has been downloaded
  const isEditLocked = !!quote.pdfDownloadedAt;
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(amount);

  const hasCapitoli = Array.isArray(quote.capitoli) && quote.capitoli.length > 0;
  const capitoli = hasCapitoli ? quote.capitoli : [];
  const sconto = quote.sconto;
  const condizioniPagamento = Array.isArray(quote.condizioniPagamento) ? quote.condizioniPagamento : [];

  const companyName = quote.companySnapshot?.companyName || profile?.companyName || t("dashboard.quoteDetail.yourCompanyFallback");
  const companyVat = quote.companySnapshot?.vatNumber || profile?.vatNumber;
  const companyAddress = quote.companySnapshot?.address || profile?.address;
  const companyPhone = quote.companySnapshot?.phone || profile?.phone;
  const companyEmail = quote.companySnapshot?.email || profile?.email;
  const companyLogoUrl = quote.companySnapshot?.logoUrl || profile?.logoUrl || "";

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("dashboard.quoteDetail.title")}</h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {isLocked ? (
              <Badge variant="outline" className="text-muted-foreground"><Lock className="h-3 w-3 mr-1" /> {t("dashboard.quoteDetail.statusDraftLocked")}</Badge>
            ) : (
              <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.quoteDetail.statusUnlocked")}</Badge>
            )}
            {quote.status === "accepted" && (
              <Badge variant="default" className="bg-emerald-600 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {t("dashboard.quoteDetail.acceptedByPrefix")} {quote.acceptedByName}
              </Badge>
            )}
            {quote.capitolatoPro && (
              <Badge className="bg-navy-600 text-white gap-1">
                <Star className="h-3 w-3" />
                {t("dashboard.quoteDetail.proSpecBadge")}
              </Badge>
            )}
            <Badge variant="outline" className="gap-1 text-slate-500">
              <LayoutTemplate className="h-3 w-3" />
              {localTemplateId === "arosio" ? t("dashboard.quoteDetail.templateProfessionalName") : localTemplateId === "mariagrazia" ? t("dashboard.quoteDetail.templateElegantName") : t("dashboard.quoteDetail.templateStandardName")}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {t("dashboard.quoteDetail.createdOnPrefix")} {format(new Date(quote.createdAt), "dd MMMM yyyy", { locale: dateLocale })}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {!isEditLocked && (
            <button
              className={cn(
                "inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-semibold",
                isEditMode ? "btn-gradient" : "btn-gradient-outline"
              )}
              onClick={isEditMode ? () => setIsEditMode(false) : enterEditMode}
            >
              {isEditMode ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              {isEditMode ? t("dashboard.quoteDetail.closeEditor") : t("dashboard.quoteDetail.edit")}
            </button>
          )}
          {!isEditLocked && (
            <button
              className="btn-gradient-outline inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-semibold"
              onClick={() => setIsRegenOpen(true)}
            >
              <Sparkles className="h-4 w-4" />
              {t("dashboard.quoteDetail.regenerate")}
            </button>
          )}
          <button
            onClick={isLocked ? handleUnlock : handleDownload}
            disabled={generatePdf.isPending}
            className={cn(
              "inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-semibold disabled:opacity-50 disabled:pointer-events-none",
              isLocked ? "btn-gradient" : "btn-gradient-outline"
            )}
          >
            {generatePdf.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : isLocked ? <Lock className="h-4 w-4" /> : <Download className="h-4 w-4" />}
            {t("dashboard.quoteDetail.downloadPdf")}
          </button>
          {!isLocked && quote?.status === "unlocked" && (
            <button
              className="btn-gradient-outline inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-semibold disabled:opacity-50 disabled:pointer-events-none"
              onClick={() => setIsEmailDialogOpen(true)}
              disabled={sendPdfEmail.isPending}
            >
              {sendPdfEmail.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Mail className="h-4 w-4" />}
              {t("dashboard.quoteDetail.sendByEmail")}
            </button>
          )}
          {!isLocked && (quote?.status === "unlocked" || quote?.status === "accepted") && (
            <button
              className="btn-gradient-outline inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-semibold"
              onClick={handleCopyPublicLink}
            >
              <Copy className="h-4 w-4" />
              {t("dashboard.quoteDetail.copyClientLink")}
            </button>
          )}
          {!isLocked && quote?.status === "unlocked" && (
            <button
              className="btn-gradient inline-flex items-center justify-center gap-2 h-10 px-5 text-sm font-semibold disabled:opacity-50 disabled:pointer-events-none"
              onClick={handleAvviaCantiere}
              disabled={avviandoCantiere}
            >
              {avviandoCantiere
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Hammer className="h-4 w-4" />}
              {t("dashboard.quoteDetail.startCrmProject")}
            </button>
          )}
          {!quote.capitolatoPro && (
            <button
              className="btn-gradient-outline inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-semibold disabled:opacity-50 disabled:pointer-events-none"
              onClick={handleUpgradeToCapitolato}
              disabled={upgradeToCapitolato.isPending}
            >
              {upgradeToCapitolato.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Star className="h-4 w-4" />}
              {isPro ? t("dashboard.quoteDetail.upgradeToProSpec") : t("dashboard.quoteDetail.proSpec")}
              {!isPro && <Lock className="h-3 w-3 -ml-1 opacity-60" />}
            </button>
          )}
          {quote.capitolatoPro && isPro && quote.status === "unlocked" && (
            <button
              className="btn-gradient-outline inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-semibold disabled:opacity-50 disabled:pointer-events-none"
              onClick={handleDownloadProPdf}
              disabled={generatePdfPro.isPending}
            >
              {generatePdfPro.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <FileDown className="h-4 w-4" />}
              {t("dashboard.quoteDetail.downloadProPdf")}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main preview card */}
        <div className="md:col-span-2 relative">
          <Card className="overflow-hidden bg-white text-black border shadow-lg relative">
  
            {/* Edit mode top banner */}
            {isEditMode && !isEditLocked && (
              <div className="bg-navy-50 border-b-2 border-navy-200 px-5 py-3 flex items-center justify-between gap-4 sticky top-0 z-20">
                <span className="text-xs font-semibold text-navy-700 flex items-center gap-1.5">
                  <Pencil className="h-3.5 w-3.5" />
                  {t("dashboard.quoteDetail.editModeBanner")}
                </span>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setIsEditMode(false)} className="h-7 text-xs gap-1">
                    <X className="h-3 w-3" /> {t("dashboard.quoteDetail.cancel")}
                  </Button>
                  <Button size="sm" onClick={handleSaveEdit} disabled={updateQuote.isPending} className="h-7 text-xs gap-1">
                    <Save className="h-3 w-3" />
                    {updateQuote.isPending ? t("dashboard.quoteDetail.saving") : t("dashboard.quoteDetail.saveChanges")}
                  </Button>
                </div>
              </div>
            )}

            {/* Template-reactive preview banner */}
            {localTemplateId !== "standard" && (
              <div className={cn(
                "px-5 py-2 flex items-center gap-2 text-xs font-semibold border-b",
                localTemplateId === "arosio"
                  ? "bg-slate-900 text-white border-slate-700"
                  : "bg-amber-50 text-amber-900 border-amber-200"
              )}>
                <LayoutTemplate className="h-3.5 w-3.5 shrink-0" />
                {localTemplateId === "arosio"
                  ? t("dashboard.quoteDetail.templateProfessionalPreview")
                  : t("dashboard.quoteDetail.templateElegantPreview")}
                <span className="ml-auto opacity-60 font-normal">{t("dashboard.quoteDetail.previewNote")}</span>
              </div>
            )}

            <div className={cn("p-8 sm:p-10", !isEditMode && "pointer-events-none select-none")}>
              {/* Company header */}
              <div className={cn(
                "flex justify-between items-start pb-6 mb-6 border-b-2",
                localTemplateId === "arosio" ? "border-slate-900" : "border-slate-800"
              )}>
                <div>
                  {companyLogoUrl && (
                    <img
                      src={companyLogoUrl}
                      alt="Logo"
                      className="max-h-14 max-w-[160px] object-contain mb-2"
                    />
                  )}
                  <h2 className="text-xl font-bold text-slate-800">{companyName}</h2>
                  {companyVat && <div className="text-slate-500 text-xs mt-1">{t("dashboard.quoteDetail.taxIdLabel")} {companyVat}</div>}
                  {companyAddress && <div className="text-slate-500 text-xs">{companyAddress}</div>}
                  {companyPhone && <div className="text-slate-500 text-xs">{companyPhone}</div>}
                  {companyEmail && <div className="text-slate-500 text-xs">{companyEmail}</div>}
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{t("dashboard.quoteDetail.quoteLabel")}</div>
                  {quote.numeroPreventivoData && (
                    <div className="text-sm font-bold text-slate-700 mt-1">{quote.numeroPreventivoData}</div>
                  )}
                  <div className="text-xs text-slate-500 mt-1">{t("dashboard.quoteDetail.dateLabel")} {format(new Date(quote.createdAt), "yyyy-MM-dd")}</div>
                </div>
              </div>

              {/* Document title */}
              {isEditMode ? (
                <div className="text-center mb-2 space-y-1">
                  <input
                    value={editTitolo1}
                    onChange={e => setEditTitolo1(e.target.value)}
                    className="w-full text-sm font-bold uppercase tracking-wide text-slate-800 text-center bg-transparent border border-transparent rounded px-1 py-0.5 hover:border-navy-300 focus:border-navy-400 focus:outline-none"
                    placeholder={t("dashboard.quoteDetail.titlePlaceholder")}
                  />
                  <input
                    value={editTitolo2}
                    onChange={e => setEditTitolo2(e.target.value)}
                    className="w-full text-xs text-slate-500 italic text-center bg-transparent border border-transparent rounded px-1 py-0.5 hover:border-navy-300 focus:border-navy-400 focus:outline-none"
                    placeholder={t("dashboard.quoteDetail.subtitlePlaceholder")}
                  />
                </div>
              ) : (
                quote.titoloPreventivoRiga1 && (
                  <div className="text-center mb-1">
                    <div className="text-sm font-bold uppercase tracking-wide text-slate-800">{quote.titoloPreventivoRiga1}</div>
                    {quote.titoloPreventivoRiga2 && (
                      <div className="text-xs text-slate-500 italic mt-0.5">{quote.titoloPreventivoRiga2}</div>
                    )}
                  </div>
                )
              )}

              {/* Client section */}
              <div className="mt-5 mb-6">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">{t("dashboard.quoteDetail.billTo")}</div>
                {isEditMode ? (
                  <div className="space-y-2 bg-navy-50/60 border border-navy-200 rounded-lg p-3">
                    {/* Saved client selector */}
                    {savedClients && savedClients.length > 0 && (
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="h-3.5 w-3.5 text-navy-500 shrink-0" />
                        <select
                          value=""
                          onChange={e => {
                            const client = savedClients.find(c => c.id === e.target.value);
                            if (client) {
                              setEditClientNome(client.clientName || "");
                              setEditClientIndirizzo(client.indirizzo || "");
                              setEditClientCity(client.city || "");
                              setEditClientPostalCode(client.postalCode || "");
                              setEditClientProvince(client.province || "");
                              setEditClientBusinessNumber(client.businessNumber || "");
                              setEditClientPIVA(client.partitaIva || "");
                            }
                          }}
                          className="flex-1 text-xs text-slate-700 bg-white border border-navy-200 rounded px-2 py-1.5 focus:outline-none focus:border-navy-400"
                        >
                          <option value="" disabled>{t("dashboard.quoteDetail.selectSavedClient")}</option>
                          {savedClients.map(c => (
                            <option key={c.id} value={c.id}>{c.clientName}{c.city ? ` — ${c.city}` : ""}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={editClientNome}
                        onChange={e => setEditClientNome(e.target.value)}
                        placeholder={t("dashboard.quoteDetail.nameBusinessNamePlaceholder")}
                        className="col-span-2 text-sm text-slate-800 bg-white border border-navy-200 rounded px-2 py-1.5 focus:outline-none focus:border-navy-400"
                      />
                      <input
                        value={editClientIndirizzo}
                        onChange={e => setEditClientIndirizzo(e.target.value)}
                        placeholder={t("dashboard.quoteDetail.streetPlaceholder")}
                        className="col-span-2 text-xs text-slate-700 bg-white border border-navy-200 rounded px-2 py-1.5 focus:outline-none focus:border-navy-400"
                      />
                      <input
                        value={editClientCity}
                        onChange={e => setEditClientCity(e.target.value)}
                        placeholder="City"
                        className="text-xs text-slate-700 bg-white border border-navy-200 rounded px-2 py-1.5 focus:outline-none focus:border-navy-400"
                      />
                      <div className="flex gap-1">
                        <input
                          value={editClientProvince}
                          onChange={e => setEditClientProvince(e.target.value.toUpperCase())}
                          placeholder="Prov"
                          maxLength={2}
                          className="w-14 text-xs text-slate-700 bg-white border border-navy-200 rounded px-2 py-1.5 focus:outline-none focus:border-navy-400"
                        />
                        <input
                          value={editClientPostalCode}
                          onChange={e => setEditClientPostalCode(e.target.value.toUpperCase())}
                          placeholder="Postal Code"
                          maxLength={7}
                          className="w-24 text-xs text-slate-700 bg-white border border-navy-200 rounded px-2 py-1.5 focus:outline-none focus:border-navy-400"
                        />
                      </div>
                      <input
                        value={editClientBusinessNumber}
                        onChange={e => setEditClientBusinessNumber(e.target.value.toUpperCase())}
                        placeholder="Business Number"
                        maxLength={16}
                        className="text-xs text-slate-700 bg-white border border-navy-200 rounded px-2 py-1.5 focus:outline-none focus:border-navy-400"
                      />
                      <input
                        value={editClientPIVA}
                        onChange={e => setEditClientPIVA(e.target.value)}
                        placeholder="GST/HST Number"
                        maxLength={15}
                        className="text-xs text-slate-700 bg-white border border-navy-200 rounded px-2 py-1.5 focus:outline-none focus:border-navy-400"
                      />
                    </div>
                  </div>
                ) : isEditingClient ? (
                  <div className="space-y-2 bg-slate-50 p-4 rounded border border-slate-200">
                    <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder={t("dashboard.quoteDetail.nameBusinessNamePlaceholder")} className="bg-white" />
                    <Input value={clientAddress} onChange={e => setClientAddress(e.target.value)} placeholder={t("dashboard.quoteDetail.addressPlaceholder")} className="bg-white" />
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => setIsEditingClient(false)}>{t("dashboard.quoteDetail.cancel")}</Button>
                      <Button size="sm" onClick={handleSaveClient} disabled={updateQuote.isPending}><Save className="h-4 w-4 mr-2" />{t("dashboard.quoteDetail.save")}</Button>
                    </div>
                  </div>
                ) : (
                  <div className="group relative flex items-start gap-2 bg-slate-50 border border-slate-200 rounded px-4 py-3">
                    <div className="flex-1">
                      <div className="font-semibold text-slate-800">{quote.clientData?.nome || "——"}</div>
                      {quote.clientData?.indirizzo && <div className="text-slate-500 text-sm">{quote.clientData.indirizzo}</div>}
                      {quote.clientData?.city && (
                        <div className="text-slate-400 text-xs mt-0.5">
                          {[quote.clientData.city, quote.clientData.province, quote.clientData.postalCode].filter(Boolean).join(" ")}
                        </div>
                      )}
                      {(quote.clientData?.businessNumber || quote.clientData?.partitaIva) && (
                        <div className="text-slate-400 text-xs">
                          {quote.clientData.businessNumber && `BN: ${quote.clientData.businessNumber}`}
                          {quote.clientData.businessNumber && quote.clientData.partitaIva && " · "}
                          {quote.clientData.partitaIva && `GST/HST: ${quote.clientData.partitaIva}`}
                        </div>
                      )}
                    </div>
                    {!isEditLocked && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={() => setIsEditingClient(true)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Attachments */}
              {quote.attachments && quote.attachments.length > 0 && (
                <div className="mb-6">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t("dashboard.quoteDetail.attachments")}</div>
                  <div className="flex flex-wrap gap-2">
                    {quote.attachments.map(att => {
                      const isImage = att.mimeType?.startsWith("image/");
                      const isPdf = att.mimeType === "application/pdf";
                      const isXlsx = att.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                      const icon = isImage ? <ImageIcon className="h-3.5 w-3.5 text-blue-500" /> :
                        isPdf ? <FileText className="h-3.5 w-3.5 text-red-500" /> :
                        isXlsx ? <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" /> :
                        <FileText className="h-3.5 w-3.5 text-blue-600" />;
                      const sizeLabel = att.fileSize
                        ? att.fileSize < 1024
                          ? `${att.fileSize} B`
                          : att.fileSize < 1024 * 1024
                            ? `${(att.fileSize / 1024).toFixed(1)} KB`
                            : `${(att.fileSize / (1024 * 1024)).toFixed(1)} MB`
                        : "";
                      return (
                        <a
                          key={att.id}
                          href={`/api/storage/objects/${att.fileUrl.replace(/^\/objects\//, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-muted text-xs text-foreground hover:border-navy-300 hover:text-navy-600 transition-colors shrink-0"
                          title={att.fileName}
                        >
                          {icon}
                          <span className="truncate max-w-[140px]">{att.fileName}</span>
                          {sizeLabel && <span className="text-muted-foreground">{sizeLabel}</span>}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quadro Sintetico — shown for Standard template in edit mode or view mode */}
              {localTemplateId === "standard" && (isEditMode ? editCapitoli.length > 0 : hasCapitoli) && (
                <div className="mb-6">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t("dashboard.quoteDetail.summaryOverview")}</div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-800 text-white">
                        <th className="py-2 px-3 text-left font-semibold">{t("dashboard.quoteDetail.chapterCol")}</th>
                        <th className="py-2 px-3 text-right font-semibold">{t("dashboard.quoteDetail.netAmountCol")}</th>
                        <th className="py-2 px-3 text-left font-semibold hidden sm:table-cell">{t("dashboard.quoteDetail.noteCol")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(isEditMode ? editCapitoli : capitoli).map((cap, i) => {
                        const sub = isEditMode
                          ? (cap as typeof editCapitoli[0]).voci.reduce((s, v) => s + Number(v.quantita) * Number(v.prezzoUnitario), 0)
                          : (cap as typeof capitoli[0]).subtotale;
                        return (
                          <tr key={cap.lettera} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                            <td className="py-2 px-3 text-slate-700">{cap.lettera}. {cap.titolo}</td>
                            <td className="py-2 px-3 text-right font-medium text-slate-800 whitespace-nowrap">{formatCurrency(sub)}</td>
                            <td className="py-2 px-3 text-slate-400 italic hidden sm:table-cell">{cap.osservazione ?? t("dashboard.quoteDetail.ordinaryItemDefault")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Chapter detail sections — branched by template */}
              {isEditMode && localTemplateId === "arosio" ? (
                /* ── AROSIO EDITOR: dark navy headers, numbered items, subtotals ── */
                <div className="mb-6">
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-white">
                          <th className="py-2 px-3 text-center w-10 font-semibold">{t("dashboard.quoteDetail.colNo")}</th>
                          <th className="py-2 px-3 text-left font-semibold">{t("dashboard.quoteDetail.colDescription")}</th>
                          <th className="py-2 px-1 text-center w-12 font-semibold">{t("dashboard.quoteDetail.colUnit")}</th>
                          <th className="py-2 px-1 text-center w-12 font-semibold">{t("dashboard.quoteDetail.colQty")}</th>
                          <th className="py-2 px-1 text-right w-24 font-semibold">{t("dashboard.quoteDetail.colUnitPrice")}</th>
                          <th className="py-2 px-3 text-right w-24 font-semibold">{t("dashboard.quoteDetail.colTotal")}</th>
                          <th className="w-6"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {editCapitoli.map((cap, ci) => {
                          const capSub = cap.voci.reduce((s, v) => s + Number(v.quantita) * Number(v.prezzoUnitario), 0);
                          return (
                            <Fragment key={ci}>
                              <tr>
                                <td colSpan={7} className="py-0 px-0 bg-slate-800">
                                  <div className="flex items-center gap-2 px-3 py-1.5">
                                    <span className="text-white font-bold text-xs whitespace-nowrap">
                                      {String(ci + 1).padStart(2, "0")}_
                                    </span>
                                    <input
                                      value={cap.titolo}
                                      onChange={e => updateCapitolo(ci, "titolo", e.target.value)}
                                      className="flex-1 text-white font-bold text-xs uppercase bg-transparent border border-transparent rounded px-1 py-0.5 hover:border-slate-500 focus:border-slate-300 focus:outline-none placeholder-slate-400 tracking-wider min-w-0"
                                      placeholder={t("dashboard.quoteDetail.chapterTitlePlaceholder")}
                                    />
                                    <span className="text-slate-300 text-xs whitespace-nowrap shrink-0">{formatCurrency(capSub)}</span>
                                    <button
                                      onClick={() => removeCapitolo(ci)}
                                      className="text-slate-400 hover:text-red-400 p-0.5 rounded transition-colors shrink-0"
                                      title={t("dashboard.quoteDetail.deleteChapter")}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {cap.voci.map((voce, vi) => {
                                const vTot = Number(voce.quantita) * Number(voce.prezzoUnitario);
                                return (
                                  <tr key={vi} className={vi % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                    <td className="py-1 px-3 text-center text-slate-500 font-medium whitespace-nowrap">{ci + 1}.{vi + 1}</td>
                                    <td className="py-1 px-2">
                                      <input
                                        value={voce.descrizione}
                                        onChange={e => updateVoce(ci, vi, "descrizione", e.target.value)}
                                        className="w-full bg-transparent border border-transparent rounded px-1 py-0.5 hover:border-navy-200 focus:border-navy-400 focus:outline-none text-slate-700"
                                        placeholder={t("dashboard.quoteDetail.descriptionPlaceholder")}
                                      />
                                    </td>
                                    <td className="py-1 px-1">
                                      <input
                                        value={voce.um}
                                        onChange={e => updateVoce(ci, vi, "um", e.target.value)}
                                        className="w-full text-center bg-transparent border border-transparent rounded px-1 py-0.5 hover:border-navy-200 focus:border-navy-400 focus:outline-none text-slate-600"
                                      />
                                    </td>
                                    <td className="py-1 px-1">
                                      <input
                                        type="number"
                                        value={voce.quantita}
                                        onChange={e => updateVoce(ci, vi, "quantita", e.target.value === "" ? 0 : Number(e.target.value))}
                                        className="w-full text-center bg-transparent border border-transparent rounded px-1 py-0.5 hover:border-navy-200 focus:border-navy-400 focus:outline-none text-slate-600"
                                        min={0} step={0.01}
                                      />
                                    </td>
                                    <td className="py-1 px-1">
                                      <input
                                        type="number"
                                        value={voce.prezzoUnitario}
                                        onChange={e => updateVoce(ci, vi, "prezzoUnitario", e.target.value === "" ? 0 : Number(e.target.value))}
                                        className="w-full text-right bg-transparent border border-transparent rounded px-1 py-0.5 hover:border-navy-200 focus:border-navy-400 focus:outline-none text-slate-600"
                                        min={0} step={0.01}
                                      />
                                    </td>
                                    <td className="py-1 px-3 text-right font-medium text-slate-800 whitespace-nowrap">{formatCurrency(vTot)}</td>
                                    <td className="py-1 px-1">
                                      <button
                                        onClick={() => removeVoce(ci, vi)}
                                        className="text-red-300 hover:text-red-500 p-0.5 rounded hover:bg-red-50 transition-colors"
                                        title={t("dashboard.quoteDetail.deleteItem")}
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                              <tr className="bg-slate-200 border-t border-slate-300">
                                <td colSpan={5} className="py-1.5 px-3">
                                  <button
                                    onClick={() => addVoce(ci)}
                                    className="text-xs text-navy-600 hover:text-navy-800 font-medium flex items-center gap-1"
                                  >
                                    <Plus className="h-3 w-3" /> {t("dashboard.quoteDetail.addItem")}
                                  </button>
                                </td>
                                <td className="py-1.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">{formatCurrency(capSub)}</td>
                                <td></td>
                              </tr>
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <button
                    onClick={addCapitolo}
                    className="mt-3 w-full py-2.5 text-xs text-navy-600 hover:text-navy-800 font-medium border-2 border-dashed border-navy-200 hover:border-navy-400 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" /> {t("dashboard.quoteDetail.addChapter")}
                  </button>
                </div>
              ) : isEditMode && localTemplateId === "mariagrazia" ? (
                /* ── MARIAGRAZIA EDITOR: grouped by chapter, flat table style ── */
                <div className="mb-6">
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-700 text-white">
                          <th className="py-2 px-2 text-center w-8 font-semibold">{t("dashboard.quoteDetail.colNo")}</th>
                          <th className="py-2 px-3 text-left font-semibold">{t("dashboard.quoteDetail.colDescription")}</th>
                          <th className="py-2 px-1 text-center w-12 font-semibold">{t("dashboard.quoteDetail.colUnit")}</th>
                          <th className="py-2 px-1 text-center w-12 font-semibold">{t("dashboard.quoteDetail.colQty")}</th>
                          <th className="py-2 px-1 text-right w-24 font-semibold">{t("dashboard.quoteDetail.colUnitPrice")}</th>
                          <th className="py-2 px-3 text-right w-24 font-semibold">{t("dashboard.quoteDetail.colTotal")}</th>
                          <th className="w-6"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          let globalIdx = 0;
                          return editCapitoli.map((cap, ci) => {
                            const capSub = cap.voci.reduce((s, v) => s + Number(v.quantita) * Number(v.prezzoUnitario), 0);
                            return (
                              <Fragment key={ci}>
                                <tr>
                                  <td colSpan={7} className="py-0 px-0 bg-slate-600">
                                    <div className="flex items-center gap-2 px-3 py-1.5">
                                      <input
                                        value={cap.titolo}
                                        onChange={e => updateCapitolo(ci, "titolo", e.target.value)}
                                        className="flex-1 text-white font-semibold text-xs bg-transparent border border-transparent rounded px-1 py-0.5 hover:border-slate-400 focus:border-slate-200 focus:outline-none placeholder-slate-300 min-w-0"
                                        placeholder={t("dashboard.quoteDetail.chapterTitlePlaceholderLower")}
                                      />
                                      <span className="text-slate-200 text-xs whitespace-nowrap shrink-0">{formatCurrency(capSub)}</span>
                                      <button
                                        onClick={() => removeCapitolo(ci)}
                                        className="text-slate-400 hover:text-red-400 p-0.5 rounded transition-colors shrink-0"
                                        title={t("dashboard.quoteDetail.deleteChapter")}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                                {cap.voci.map((voce, vi) => {
                                  const rowNum = ++globalIdx;
                                  const vTot = Number(voce.quantita) * Number(voce.prezzoUnitario);
                                  return (
                                    <tr key={vi} className={vi % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                      <td className="py-1 px-2 text-center font-semibold text-slate-500">{rowNum}</td>
                                      <td className="py-1 px-2">
                                        <input
                                          value={voce.descrizione}
                                          onChange={e => updateVoce(ci, vi, "descrizione", e.target.value)}
                                          className="w-full bg-transparent border border-transparent rounded px-1 py-0.5 hover:border-navy-200 focus:border-navy-400 focus:outline-none text-slate-700"
                                          placeholder={t("dashboard.quoteDetail.descriptionPlaceholder")}
                                        />
                                      </td>
                                      <td className="py-1 px-1">
                                        <input
                                          value={voce.um}
                                          onChange={e => updateVoce(ci, vi, "um", e.target.value)}
                                          className="w-full text-center bg-transparent border border-transparent rounded px-1 py-0.5 hover:border-navy-200 focus:border-navy-400 focus:outline-none text-slate-600"
                                        />
                                      </td>
                                      <td className="py-1 px-1">
                                        <input
                                          type="number"
                                          value={voce.quantita}
                                          onChange={e => updateVoce(ci, vi, "quantita", e.target.value === "" ? 0 : Number(e.target.value))}
                                          className="w-full text-center bg-transparent border border-transparent rounded px-1 py-0.5 hover:border-navy-200 focus:border-navy-400 focus:outline-none text-slate-600"
                                          min={0} step={0.01}
                                        />
                                      </td>
                                      <td className="py-1 px-1">
                                        <input
                                          type="number"
                                          value={voce.prezzoUnitario}
                                          onChange={e => updateVoce(ci, vi, "prezzoUnitario", e.target.value === "" ? 0 : Number(e.target.value))}
                                          className="w-full text-right bg-transparent border border-transparent rounded px-1 py-0.5 hover:border-navy-200 focus:border-navy-400 focus:outline-none text-slate-600"
                                          min={0} step={0.01}
                                        />
                                      </td>
                                      <td className="py-1 px-3 text-right font-medium text-slate-800 whitespace-nowrap">{formatCurrency(vTot)}</td>
                                      <td className="py-1 px-1">
                                        <button
                                          onClick={() => removeVoce(ci, vi)}
                                          className="text-red-300 hover:text-red-500 p-0.5 rounded hover:bg-red-50 transition-colors"
                                          title={t("dashboard.quoteDetail.deleteItem")}
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                                <tr className="bg-slate-100 border-t border-slate-200">
                                  <td colSpan={6} className="py-1.5 px-3">
                                    <button
                                      onClick={() => addVoce(ci)}
                                      className="text-xs text-navy-600 hover:text-navy-800 font-medium flex items-center gap-1"
                                    >
                                      <Plus className="h-3 w-3" /> {t("dashboard.quoteDetail.addItem")}
                                    </button>
                                  </td>
                                  <td></td>
                                </tr>
                              </Fragment>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                  <button
                    onClick={addCapitolo}
                    className="mt-3 w-full py-2.5 text-xs text-navy-600 hover:text-navy-800 font-medium border-2 border-dashed border-navy-200 hover:border-navy-400 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" /> {t("dashboard.quoteDetail.addChapter")}
                  </button>
                </div>
              ) : isEditMode ? (
                /* ── STANDARD INLINE EDIT MODE ── */
                <div className="mb-6">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">{t("dashboard.quoteDetail.detailedBreakdown")}</div>
                  <div className="space-y-4">
                    {editCapitoli.map((cap, capIdx) => {
                      const capSub = cap.voci.reduce((s, v) => s + Number(v.quantita) * Number(v.prezzoUnitario), 0);
                      return (
                        <div key={capIdx} className="border-2 border-navy-200 rounded-lg overflow-hidden">
                          {/* Chapter header — editable */}
                          <div className="bg-navy-50 px-3 py-2 flex items-center gap-2 border-b border-navy-100">
                            <span className="text-sm font-bold text-slate-400 shrink-0">{cap.lettera}.</span>
                            <input
                              value={cap.titolo}
                              onChange={e => updateCapitolo(capIdx, "titolo", e.target.value)}
                              className="flex-1 text-sm font-semibold text-slate-800 bg-transparent border border-transparent rounded px-1 py-0.5 hover:border-navy-300 focus:border-navy-400 focus:outline-none min-w-0"
                              placeholder={t("dashboard.quoteDetail.chapterTitlePlaceholderLower")}
                            />
                            <input
                              value={cap.osservazione ?? ""}
                              onChange={e => updateCapitolo(capIdx, "osservazione", e.target.value)}
                              className="w-28 text-xs text-slate-500 bg-transparent border border-transparent rounded px-1 py-0.5 hover:border-navy-300 focus:border-navy-400 focus:outline-none hidden sm:block"
                              placeholder={t("dashboard.quoteDetail.notePlaceholder")}
                            />
                            <span className="text-xs font-semibold text-slate-600 whitespace-nowrap shrink-0">{formatCurrency(capSub)}</span>
                            <button
                              onClick={() => removeCapitolo(capIdx)}
                              className="text-red-300 hover:text-red-500 hover:bg-red-50 rounded p-1 transition-colors shrink-0"
                              title={t("dashboard.quoteDetail.deleteChapter")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {/* Voci — stacked cards on mobile, table from sm: up */}
                          <div className="sm:hidden divide-y divide-slate-100">
                            {cap.voci.map((voce, vi) => {
                              const vTot = Number(voce.quantita) * Number(voce.prezzoUnitario);
                              return (
                                <div key={vi} className={cn("p-3 space-y-2", vi % 2 === 0 ? "bg-white" : "bg-slate-50/60")}>
                                  <div className="flex items-start gap-2">
                                    <input
                                      value={voce.descrizione}
                                      onChange={e => updateVoce(capIdx, vi, "descrizione", e.target.value)}
                                      className="flex-1 min-w-0 bg-transparent border border-slate-200 rounded px-2 py-1.5 text-sm focus:border-navy-400 focus:outline-none text-slate-700"
                                      placeholder={t("dashboard.quoteDetail.itemDescriptionPlaceholder")}
                                    />
                                    <button
                                      onClick={() => removeVoce(capIdx, vi)}
                                      className="text-red-300 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors shrink-0"
                                      title={t("dashboard.quoteDetail.deleteItem")}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <label className="text-[10px] text-slate-400 uppercase tracking-wide">
                                      {t("dashboard.quoteDetail.colUnit")}
                                      <input
                                        value={voce.um}
                                        onChange={e => updateVoce(capIdx, vi, "um", e.target.value)}
                                        className="mt-0.5 w-full text-center bg-transparent border border-slate-200 rounded px-1 py-1.5 text-sm focus:border-navy-400 focus:outline-none text-slate-600 normal-case"
                                      />
                                    </label>
                                    <label className="text-[10px] text-slate-400 uppercase tracking-wide">
                                      {t("dashboard.quoteDetail.colQty")}
                                      <input
                                        type="number"
                                        value={voce.quantita}
                                        onChange={e => updateVoce(capIdx, vi, "quantita", e.target.value === "" ? 0 : Number(e.target.value))}
                                        className="mt-0.5 w-full text-center bg-transparent border border-slate-200 rounded px-1 py-1.5 text-sm focus:border-navy-400 focus:outline-none text-slate-600 normal-case"
                                        min={0} step={0.01}
                                      />
                                    </label>
                                    <label className="text-[10px] text-slate-400 uppercase tracking-wide">
                                      {t("dashboard.quoteDetail.colUnitPrice")}
                                      <input
                                        type="number"
                                        value={voce.prezzoUnitario}
                                        onChange={e => updateVoce(capIdx, vi, "prezzoUnitario", e.target.value === "" ? 0 : Number(e.target.value))}
                                        className="mt-0.5 w-full text-right bg-transparent border border-slate-200 rounded px-1 py-1.5 text-sm focus:border-navy-400 focus:outline-none text-slate-600 normal-case"
                                        min={0} step={0.01}
                                      />
                                    </label>
                                  </div>
                                  <div className="flex items-center justify-between text-xs pt-0.5">
                                    <span className="text-slate-400">{t("dashboard.quoteDetail.colTotal")}</span>
                                    <span className="font-medium text-slate-800">{formatCurrency(vTot)}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-slate-700 text-white">
                                  <th className="py-1.5 px-3 text-left font-medium">{t("dashboard.quoteDetail.colDescription")}</th>
                                  <th className="py-1.5 px-1 text-center font-medium w-14">{t("dashboard.quoteDetail.colUnit")}</th>
                                  <th className="py-1.5 px-1 text-center font-medium w-16">{t("dashboard.quoteDetail.colQty")}</th>
                                  <th className="py-1.5 px-1 text-right font-medium w-24">{t("dashboard.quoteDetail.colUnitPrice")}</th>
                                  <th className="py-1.5 px-3 text-right font-medium w-20">{t("dashboard.quoteDetail.colTotal")}</th>
                                  <th className="w-6"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {cap.voci.map((voce, vi) => {
                                  const vTot = Number(voce.quantita) * Number(voce.prezzoUnitario);
                                  return (
                                    <tr key={vi} className={vi % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                                      <td className="py-1 px-2">
                                        <input
                                          value={voce.descrizione}
                                          onChange={e => updateVoce(capIdx, vi, "descrizione", e.target.value)}
                                          className="w-full bg-transparent border border-transparent rounded px-1 py-0.5 hover:border-navy-200 focus:border-navy-400 focus:outline-none text-slate-700"
                                          placeholder={t("dashboard.quoteDetail.itemDescriptionPlaceholder")}
                                        />
                                      </td>
                                      <td className="py-1 px-1">
                                        <input
                                          value={voce.um}
                                          onChange={e => updateVoce(capIdx, vi, "um", e.target.value)}
                                          className="w-full text-center bg-transparent border border-transparent rounded px-1 py-0.5 hover:border-navy-200 focus:border-navy-400 focus:outline-none text-slate-600"
                                        />
                                      </td>
                                      <td className="py-1 px-1">
                                        <input
                                          type="number"
                                          value={voce.quantita}
                                          onChange={e => updateVoce(capIdx, vi, "quantita", e.target.value === "" ? 0 : Number(e.target.value))}
                                          className="w-full text-center bg-transparent border border-transparent rounded px-1 py-0.5 hover:border-navy-200 focus:border-navy-400 focus:outline-none text-slate-600"
                                          min={0} step={0.01}
                                        />
                                      </td>
                                      <td className="py-1 px-1">
                                        <input
                                          type="number"
                                          value={voce.prezzoUnitario}
                                          onChange={e => updateVoce(capIdx, vi, "prezzoUnitario", e.target.value === "" ? 0 : Number(e.target.value))}
                                          className="w-full text-right bg-transparent border border-transparent rounded px-1 py-0.5 hover:border-navy-200 focus:border-navy-400 focus:outline-none text-slate-600"
                                          min={0} step={0.01}
                                        />
                                      </td>
                                      <td className="py-1 px-3 text-right font-medium text-slate-800 whitespace-nowrap">
                                        {formatCurrency(vTot)}
                                      </td>
                                      <td className="py-1 px-1">
                                        <button
                                          onClick={() => removeVoce(capIdx, vi)}
                                          className="text-red-300 hover:text-red-500 p-0.5 rounded hover:bg-red-50 transition-colors"
                                          title={t("dashboard.quoteDetail.deleteItem")}
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          {/* Chapter footer */}
                          <div className="bg-slate-50 border-t border-slate-100 px-3 py-2 flex items-center justify-between">
                            <button
                              onClick={() => addVoce(capIdx)}
                              className="text-xs text-navy-600 hover:text-navy-800 font-medium flex items-center gap-1 hover:bg-navy-50 rounded px-2 py-1 transition-colors"
                            >
                              <Plus className="h-3 w-3" /> {t("dashboard.quoteDetail.addItem")}
                            </button>
                            <span className="text-xs font-bold text-slate-700">
                              {t("dashboard.quoteDetail.subtotalPrefix")} {formatCurrency(capSub)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {/* Add chapter */}
                    <button
                      onClick={addCapitolo}
                      className="w-full py-2.5 text-xs text-navy-600 hover:text-navy-800 font-medium border-2 border-dashed border-navy-200 hover:border-navy-400 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" /> {t("dashboard.quoteDetail.addChapter")}
                    </button>
                  </div>
                </div>
              ) : localTemplateId === "arosio" && hasCapitoli ? (
                /* ── AROSIO VIEW: numbered sections, dark navy headers, subtotals ── */
                <div className="mb-6 overflow-x-auto">
                  <table className="w-full text-xs border-collapse min-w-[560px]">
                    <thead>
                      <tr className="bg-slate-900 text-white">
                        <th className="py-2 px-3 text-center w-10 font-semibold">{t("dashboard.quoteDetail.colNo")}</th>
                        <th className="py-2 px-3 text-left font-semibold">{t("dashboard.quoteDetail.colDescription")}</th>
                        <th className="py-2 px-2 text-center w-10 font-semibold">{t("dashboard.quoteDetail.colUnit")}</th>
                        <th className="py-2 px-2 text-right w-20 font-semibold">{t("dashboard.quoteDetail.colUnitPriceShort")}</th>
                        <th className="py-2 px-3 text-right w-24 font-semibold">{t("dashboard.quoteDetail.colTotal")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {capitoli.map((cap, ci) => (
                        <Fragment key={cap.lettera}>
                          <tr>
                            <td colSpan={5} className="py-2 px-3 font-bold text-white text-xs tracking-wider uppercase bg-slate-800">
                              {String(ci + 1).padStart(2, "0")}_ {cap.titolo.toUpperCase()}
                            </td>
                          </tr>
                          {cap.voci.map((voce, vi) => (
                            <tr key={`${cap.lettera}-${vi}`} className={vi % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                              <td className="py-2 px-3 text-center text-slate-500 font-medium">{ci + 1}.{vi + 1}</td>
                              <td className="py-3 px-3 text-slate-750 max-w-[400px]">
                                {(() => {
                                  const parts = voce.descrizione.split("\n");
                                  const title = parts[0];
                                  const professionalDesc = parts.slice(1).join("\n");
                                  const isRegenerating = regeneratingVoceKey === `${ci}-${vi}`;

                                  return (
                                    <div className="space-y-1.5 group relative">
                                      <div className="font-semibold text-slate-850 flex items-start justify-between gap-2">
                                        <span>{title}</span>
                                        <button
                                          onClick={() => handleRegenerateSingleVoce(ci, vi, title)}
                                          disabled={isRegenerating}
                                          className="p-1 rounded bg-slate-100 hover:bg-navy-50 text-slate-400 hover:text-navy-600 transition opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0"
                                          title={t("dashboard.quoteDetail.regenerateProDescTitle")}
                                        >
                                          {isRegenerating ? (
                                            <Loader2 className="h-3 w-3 animate-spin text-navy-600" />
                                          ) : (
                                            <RefreshCw className="h-3 w-3" />
                                          )}
                                        </button>
                                      </div>
                                      {professionalDesc ? (
                                        <p className="text-[10px] text-slate-550 leading-relaxed font-normal italic bg-slate-50/50 p-2 rounded border border-slate-100/60">
                                          {professionalDesc}
                                        </p>
                                      ) : (
                                        <button
                                          onClick={() => handleRegenerateSingleVoce(ci, vi, title)}
                                          disabled={isRegenerating}
                                          className="text-[9px] text-navy-600 hover:text-navy-800 font-semibold flex items-center gap-1 mt-0.5 hover:underline"
                                        >
                                          <Sparkles className="h-2.5 w-2.5" /> {t("dashboard.quoteDetail.addAiProDescription")}
                                        </button>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="py-2 px-2 text-center text-slate-500">{voce.um}</td>
                              <td className="py-2 px-2 text-right text-slate-600 whitespace-nowrap">{formatCurrency(voce.prezzoUnitario)}</td>
                              <td className="py-2 px-3 text-right font-medium text-slate-800 whitespace-nowrap">{formatCurrency(voce.totale)}</td>
                            </tr>
                          ))}
                          <tr className="bg-slate-200 border-t border-slate-300">
                            <td colSpan={4} className="py-1.5 px-3 text-right font-bold text-slate-700 text-xs">
                              {String.fromCharCode(65 + ci)}{t("dashboard.quoteDetail.totalTaxExcludedSuffix")}
                            </td>
                            <td className="py-1.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">{formatCurrency(cap.subtotale)}</td>
                          </tr>
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : localTemplateId === "mariagrazia" && hasCapitoli ? (
                /* ── MARIAGRAZIA VIEW: flat numbered list across all chapters ── */
                <div className="mb-6 overflow-x-auto">
                  <table className="w-full text-xs border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-slate-700 text-white">
                        <th className="py-2 px-2 text-center w-8 font-semibold">{t("dashboard.quoteDetail.colNo")}</th>
                        <th className="py-2 px-3 text-left font-semibold">{t("dashboard.quoteDetail.colDescription")}</th>
                        <th className="py-2 px-2 text-center w-10 font-semibold">{t("dashboard.quoteDetail.colUnit")}</th>
                        <th className="py-2 px-2 text-center w-10 font-semibold">{t("dashboard.quoteDetail.colQty")}</th>
                        <th className="py-2 px-2 text-right w-20 font-semibold">{t("dashboard.quoteDetail.colUnitPriceShort")}</th>
                        <th className="py-2 px-3 text-right w-24 font-semibold">{t("dashboard.quoteDetail.colTotal")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {capitoli.flatMap((cap, ci) => cap.voci.map((v, vi) => ({ ...v, chapter: cap.titolo, ci, vi }))).map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          <td className="py-2 px-2 text-center font-semibold text-slate-500">{i + 1}</td>
                          <td className="py-3 px-3 text-slate-750 max-w-[400px]">
                            {(() => {
                              const parts = row.descrizione.split("\n");
                              const title = parts[0];
                              const professionalDesc = parts.slice(1).join("\n");
                              const isRegenerating = regeneratingVoceKey === `${row.ci}-${row.vi}`;

                              return (
                                <div className="space-y-1.5 group relative">
                                  <div className="font-semibold text-slate-850 flex items-start justify-between gap-2">
                                    <span>{title}</span>
                                    <button
                                      onClick={() => handleRegenerateSingleVoce(row.ci, row.vi, title)}
                                      disabled={isRegenerating}
                                      className="p-1 rounded bg-slate-100 hover:bg-navy-50 text-slate-400 hover:text-navy-600 transition opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0"
                                      title={t("dashboard.quoteDetail.regenerateProDescTitle")}
                                    >
                                      {isRegenerating ? (
                                        <Loader2 className="h-3 w-3 animate-spin text-navy-600" />
                                      ) : (
                                        <RefreshCw className="h-3 w-3" />
                                      )}
                                    </button>
                                  </div>
                                  {professionalDesc ? (
                                    <p className="text-[10px] text-slate-550 leading-relaxed font-normal italic bg-slate-50/50 p-2 rounded border border-slate-100/60">
                                      {professionalDesc}
                                    </p>
                                  ) : (
                                    <button
                                      onClick={() => handleRegenerateSingleVoce(row.ci, row.vi, title)}
                                      disabled={isRegenerating}
                                      className="text-[9px] text-navy-600 hover:text-navy-800 font-semibold flex items-center gap-1 mt-0.5 hover:underline"
                                    >
                                      <Sparkles className="h-2.5 w-2.5" /> {t("dashboard.quoteDetail.addAiProDescription")}
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="py-2 px-2 text-center text-slate-500">{row.um}</td>
                          <td className="py-2 px-2 text-center text-slate-500">{row.quantita}</td>
                          <td className="py-2 px-2 text-right text-slate-600 whitespace-nowrap">{formatCurrency(row.prezzoUnitario)}</td>
                          <td className="py-2 px-3 text-right font-medium text-slate-800 whitespace-nowrap">{formatCurrency(row.totale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : hasCapitoli ? (
                /* ── STANDARD VIEW: collapsible chapters ── */
                <div className="mb-6">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">{t("dashboard.quoteDetail.detailedBreakdown")}</div>
                  <div className="space-y-4">
                    {capitoli.map(cap => {
                      const isExpanded = expandedChapters.has(cap.lettera);
                      return (
                        <div key={cap.lettera} className="border border-slate-200 rounded overflow-hidden">
                          <button
                            className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-100 text-left hover:bg-slate-200 transition-colors"
                            onClick={() => toggleChapter(cap.lettera)}
                          >
                            <span className="font-bold text-slate-800 text-sm">{cap.lettera}. {cap.titolo}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold text-slate-700">{formatCurrency(cap.subtotale)}</span>
                              {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="overflow-x-auto">
                            <table className="w-full text-xs min-w-[480px]">
                              <thead>
                                <tr className="bg-slate-700 text-white">
                                  <th className="py-1.5 px-3 text-left">{t("dashboard.quoteDetail.colDescription")}</th>
                                  <th className="py-1.5 px-2 text-center w-12">{t("dashboard.quoteDetail.colUnit")}</th>
                                  <th className="py-1.5 px-2 text-center w-12">{t("dashboard.quoteDetail.colQty")}</th>
                                  <th className="py-1.5 px-3 text-right w-24">{t("dashboard.quoteDetail.colUnitPriceShort")}</th>
                                  <th className="py-1.5 px-3 text-right w-24">{t("dashboard.quoteDetail.colTotal")}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {cap.voci.map((voce, vi) => (
                                  <tr key={vi} className={vi % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                    <td className="py-2 px-3 text-slate-700">{voce.descrizione}</td>
                                    <td className="py-2 px-2 text-center text-slate-500">{voce.um}</td>
                                    <td className="py-2 px-2 text-center text-slate-500">{voce.quantita}</td>
                                    <td className="py-2 px-3 text-right text-slate-600 whitespace-nowrap">{formatCurrency(voce.prezzoUnitario)}</td>
                                    <td className="py-2 px-3 text-right font-medium text-slate-800 whitespace-nowrap">{formatCurrency(voce.totale)}</td>
                                  </tr>
                                ))}
                                <tr className="bg-slate-200">
                                  <td colSpan={4} className="py-2 px-3 font-bold text-slate-700 text-right">{t("dashboard.quoteDetail.subtotalChapterPrefix")} {cap.lettera}</td>
                                  <td className="py-2 px-3 text-right font-bold text-slate-800 whitespace-nowrap">{formatCurrency(cap.subtotale)}</td>
                                </tr>
                              </tbody>
                            </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* ── LEGACY ITEMS (no chapters, any template) ── */
                <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="border-b-2 border-slate-800 text-slate-800">
                      <th className="py-3 text-left font-semibold">{t("dashboard.quoteDetail.colDescription")}</th>
                      <th className="py-3 text-center font-semibold w-20">{t("dashboard.quoteDetail.colUnit")}</th>
                      <th className="py-3 text-right font-semibold w-20">{t("dashboard.quoteDetail.colQty")}</th>
                      <th className="py-3 text-right font-semibold w-28">{t("dashboard.quoteDetail.colUnitPriceShort")}</th>
                      <th className="py-3 text-right font-semibold w-28">{t("dashboard.quoteDetail.colTotal")}</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 divide-y divide-slate-100">
                    {quote.items.map((item, i) => (
                      <tr key={i}>
                        <td className="py-3 pr-4">{item.descrizione}</td>
                        <td className="py-3 text-center">{item.unita}</td>
                        <td className="py-3 text-right">{item.quantita}</td>
                        <td className="py-3 text-right whitespace-nowrap">{formatCurrency(item.prezzoUnitario)}</td>
                        <td className="py-3 text-right whitespace-nowrap">{formatCurrency(item.totale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}

              {/* Totals */}
              <div className="flex justify-end pt-2 mb-6">
                <div className="w-72 border border-slate-200 rounded overflow-hidden text-sm">
                  {isEditMode ? (() => {
                    const editSub = editCapitoli.reduce((s, cap) => s + cap.voci.reduce((cs, v) => cs + Number(v.quantita) * Number(v.prezzoUnitario), 0), 0);
                    const editImponibile = editScontoPerc > 0 ? editSub * (1 - editScontoPerc / 100) : editSub;
                    const editIvaVal = editImponibile * (editIvaPerc / 100);
                    const editTot = editImponibile + editIvaVal;
                    return (
                      <>
                        <div className="flex justify-between px-4 py-2.5 text-slate-600 border-b border-slate-100">
                          <span>{t("dashboard.quoteDetail.taxableTotal")}</span>
                          <span className="font-medium">{formatCurrency(editSub)}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 gap-3">
                          <label className="text-slate-600 text-xs shrink-0">{t("dashboard.quoteDetail.discountPercent")}</label>
                          <input
                            type="number"
                            value={editScontoPerc}
                            onChange={e => setEditScontoPerc(Math.max(0, Math.min(100, Number(e.target.value))))}
                            className="w-16 text-right bg-navy-50 border border-navy-200 rounded px-2 py-0.5 text-sm focus:outline-none focus:border-navy-400"
                            min={0} max={100} step={1}
                          />
                        </div>
                        {editScontoPerc > 0 && (
                          <div className="flex justify-between px-4 py-2 text-green-700 border-b border-slate-100">
                            <span className="text-xs">{t("dashboard.quoteDetail.taxableAfterDiscount")}</span>
                            <span className="font-medium">{formatCurrency(editImponibile)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 gap-3">
                          <label className="text-slate-600 text-xs shrink-0">{t("dashboard.quoteDetail.taxPercent")}</label>
                          <input
                            type="number"
                            value={editIvaPerc}
                            onChange={e => setEditIvaPerc(Math.max(0, Number(e.target.value)))}
                            className="w-16 text-right bg-navy-50 border border-navy-200 rounded px-2 py-0.5 text-sm focus:outline-none focus:border-navy-400"
                            min={0} step={1}
                          />
                        </div>
                        <div className="flex justify-between px-4 py-2 text-slate-600 border-b border-slate-100">
                          <span className="text-xs">{t("dashboard.quoteDetail.taxLabel")}</span>
                          <span className="font-medium">{formatCurrency(editIvaVal)}</span>
                        </div>
                        <div className="flex justify-between px-4 py-3 bg-slate-800 text-white font-bold text-base">
                          <span>{t("dashboard.quoteDetail.total")}</span>
                          <span>{formatCurrency(editTot)}</span>
                        </div>
                      </>
                    );
                  })() : (
                    <>
                      <div className="flex justify-between px-4 py-2.5 text-slate-600 border-b border-slate-100">
                        <span>{t("dashboard.quoteDetail.taxableTotal")}</span>
                        <span className="font-medium">{formatCurrency(quote.subtotale)}</span>
                      </div>
                      {sconto && sconto.percentuale > 0 && (
                        <>
                          <div className="flex justify-between px-4 py-2.5 text-slate-600 border-b border-slate-100">
                            <span>{t("dashboard.quoteDetail.discountLabelPrefix")} ({sconto.percentuale}%):</span>
                            <span className="font-medium text-green-700">−{formatCurrency(quote.subtotale - sconto.importoScontato)}</span>
                          </div>
                          <div className="flex justify-between px-4 py-2.5 text-slate-600 border-b border-slate-100">
                            <span>{t("dashboard.quoteDetail.taxableAfterDiscount")}</span>
                            <span className="font-medium">{formatCurrency(sconto.importoScontato)}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between px-4 py-2.5 text-slate-600 border-b border-slate-100">
                        <span>{t("dashboard.quoteDetail.taxLabelPrefix")} ({quote.ivaPercentuale}%):</span>
                        <span className="font-medium">{formatCurrency(quote.ivaValore)}</span>
                      </div>
                      <div className="flex justify-between px-4 py-3 bg-slate-800 text-white font-bold text-base">
                        <span>{t("dashboard.quoteDetail.total")}</span>
                        <span>{formatCurrency(quote.totale)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Condizioni di pagamento */}
              {isEditMode ? (
                <div className="mb-6 border-2 border-navy-200 rounded-lg p-4 bg-navy-50/40">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center justify-between">
                    <span>{t("dashboard.quoteDetail.paymentTerms")}</span>
                    <button
                      onClick={() => setEditCondizioniPagamento(prev => [...prev, ""])}
                      className="text-xs text-navy-600 hover:text-navy-800 font-medium flex items-center gap-1 hover:bg-navy-100 rounded px-2 py-1 transition-colors"
                    >
                      <Plus className="h-3 w-3" /> {t("dashboard.quoteDetail.add")}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {editCondizioniPagamento.map((cond, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          value={cond}
                          onChange={e => setEditCondizioniPagamento(prev => prev.map((c, ci) => ci === i ? e.target.value : c))}
                          placeholder={t("dashboard.quoteDetail.paymentTermPlaceholder")}
                          className="flex-1 text-xs text-slate-700 bg-white border border-navy-200 rounded px-2 py-1.5 focus:outline-none focus:border-navy-400"
                        />
                        <button
                          onClick={() => setEditCondizioniPagamento(prev => prev.filter((_, ci) => ci !== i))}
                          className="text-red-300 hover:text-red-500 hover:bg-red-50 rounded p-1 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {editCondizioniPagamento.length === 0 && (
                      <p className="text-xs text-slate-400 italic">{t("dashboard.quoteDetail.noConditionsHint")}</p>
                    )}
                  </div>
                </div>
              ) : condizioniPagamento.length > 0 ? (
                <div className="mb-6 border border-slate-200 rounded p-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">{t("dashboard.quoteDetail.paymentTerms")}</div>
                  <ul className="space-y-1.5">
                    {condizioniPagamento.map((cond, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                        <CheckCircle2 className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="font-medium uppercase">{cond}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Descrizione Generale / Oggetto */}
              {isEditMode ? (
                <div className="pt-4 border-t border-navy-100">
                  <div className="text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">{t("dashboard.quoteDetail.generalDescriptionLabel")}</div>
                  <textarea
                    value={editDescrizioneGenerale}
                    onChange={e => setEditDescrizioneGenerale(e.target.value)}
                    className="w-full text-xs text-slate-500 bg-navy-50/50 border border-navy-200 rounded p-2 focus:outline-none focus:border-navy-400 resize-none min-h-[60px]"
                    placeholder={t("dashboard.quoteDetail.generalDescriptionPlaceholder")}
                  />
                </div>
              ) : (
                quote.descrizioneGenerale && (
                  <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 italic">
                    <strong>{t("dashboard.quoteDetail.subjectPrefix")}</strong>{quote.descrizioneGenerale}
                  </div>
                )
              )}

              {/* Notes */}
              {isEditMode ? (
                <div className="pt-4 border-t border-navy-100">
                  <div className="text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">{t("dashboard.quoteDetail.finalNotesLabel")}</div>
                  <textarea
                    value={editNote}
                    onChange={e => setEditNote(e.target.value)}
                    className="w-full text-xs text-slate-500 bg-navy-50/50 border border-navy-200 rounded p-2 focus:outline-none focus:border-navy-400 resize-none min-h-[60px]"
                    placeholder={t("dashboard.quoteDetail.finalNotesPlaceholder")}
                  />
                </div>
              ) : (
                quote.note && (
                  <div className="pt-4 border-t border-slate-100 text-xs text-slate-400">
                    <strong>{t("dashboard.quoteDetail.notePrefix")}</strong>{quote.note}
                  </div>
                )
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{t("dashboard.quoteDetail.actionsTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                onClick={isLocked ? handleUnlock : handleDownload}
                disabled={generatePdf.isPending}
                className="w-full justify-start gap-2"
                variant={isLocked ? "default" : "outline"}
              >
                {generatePdf.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : isLocked ? <Lock className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                {t("dashboard.quoteDetail.downloadPdf")}
              </Button>
              {!isLocked && quote?.status === "unlocked" && (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => setIsEmailDialogOpen(true)}
                  disabled={sendPdfEmail.isPending}
                >
                  {sendPdfEmail.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Mail className="h-4 w-4" />}
                  {t("dashboard.quoteDetail.sendByEmail")}
                </Button>
              )}
              {!isEditLocked && (
                <>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={isEditMode ? () => setIsEditMode(false) : enterEditMode}
                  >
                    <Pencil className="h-4 w-4" />
                    {isEditMode ? t("dashboard.quoteDetail.closeEditor") : t("dashboard.quoteDetail.editQuote")}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 text-navy-600 border-navy-200 hover:bg-navy-50"
                    onClick={() => setIsRegenOpen(true)}
                  >
                    <Sparkles className="h-4 w-4" />
                    {t("dashboard.quoteDetail.regenerateWithAi")}
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                disabled={duplicateQuote.isPending}
                onClick={() => {
                  if (!id) return;
                  duplicateQuote.mutate({ id }, {
                    onSuccess: (newQuote) => {
                      queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() });
                      toast({ title: t("dashboard.quoteDetail.quoteDuplicated"), description: t("dashboard.quoteDetail.quoteDuplicatedDesc") });
                      navigate(`/dashboard/quotes/${newQuote.id}`);
                    },
                    onError: () => toast({ title: t("dashboard.quoteDetail.errorDuplicate"), variant: "destructive" }),
                  });
                }}
              >
                {duplicateQuote.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                {t("dashboard.quoteDetail.duplicateQuote")}
              </Button>
              {isEditLocked && (
                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  {t("dashboard.quoteDetail.downloadedWarning")}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Phase 22: Good/Better/Best tiered quotes */}
          {!isEditLocked && quote?.status !== "accepted" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Star className="h-4 w-4 text-muted-foreground" />
                  {t("dashboard.quoteDetail.variants.title")}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t("dashboard.quoteDetail.variants.subtitle")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {variants.map((v) => (
                  <div key={v.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        defaultValue={v.label}
                        placeholder={t("dashboard.quoteDetail.variants.labelPlaceholder")}
                        className="h-8 text-sm font-medium"
                        onBlur={(e) => {
                          if (e.target.value === v.label) return;
                          updateVariant.mutate({ id: id!, variantId: v.id, data: { label: e.target.value } }, {
                            onSuccess: () => queryClient.invalidateQueries({ queryKey: getListQuoteVariantsQueryKey(id!) }),
                          });
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-red-500 hover:text-red-600"
                        disabled={deleteVariant.isPending}
                        onClick={() => {
                          deleteVariant.mutate({ id: id!, variantId: v.id }, {
                            onSuccess: () => queryClient.invalidateQueries({ queryKey: getListQuoteVariantsQueryKey(id!) }),
                            onError: () => toast({ title: t("dashboard.quoteDetail.variants.errorDelete"), variant: "destructive" }),
                          });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      defaultValue={v.description}
                      placeholder={t("dashboard.quoteDetail.variants.descriptionPlaceholder")}
                      rows={2}
                      className="text-xs resize-none"
                      onBlur={(e) => {
                        if (e.target.value === v.description) return;
                        updateVariant.mutate({ id: id!, variantId: v.id, data: { description: e.target.value } }, {
                          onSuccess: () => queryClient.invalidateQueries({ queryKey: getListQuoteVariantsQueryKey(id!) }),
                        });
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground shrink-0">{t("dashboard.quoteDetail.variants.totalLabel")}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        defaultValue={v.totale}
                        className="h-8 text-sm"
                        onBlur={(e) => {
                          const totale = Number(e.target.value);
                          if (!Number.isFinite(totale) || totale === Number(v.totale)) return;
                          const ivaPct = Number(v.ivaPercentuale);
                          const subtotale = Math.round((totale / (1 + ivaPct / 100)) * 100) / 100;
                          const ivaValore = Math.round((totale - subtotale) * 100) / 100;
                          updateVariant.mutate({ id: id!, variantId: v.id, data: { totale, subtotale, ivaValore } }, {
                            onSuccess: () => queryClient.invalidateQueries({ queryKey: getListQuoteVariantsQueryKey(id!) }),
                          });
                        }}
                      />
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  disabled={createVariant.isPending || variants.length >= 3}
                  onClick={() => {
                    if (!id) return;
                    createVariant.mutate({ id, data: {} }, {
                      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListQuoteVariantsQueryKey(id) }),
                      onError: () => toast({ title: t("dashboard.quoteDetail.variants.errorCreate"), variant: "destructive" }),
                    });
                  }}
                >
                  <Plus className="h-4 w-4" />
                  {variants.length >= 3 ? t("dashboard.quoteDetail.variants.maxReached") : t("dashboard.quoteDetail.variants.addOption")}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Template picker */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
                {t("dashboard.quoteDetail.pdfTemplateTitle")}
              </CardTitle>
              <CardDescription className="text-xs">
                {isEditLocked ? t("dashboard.quoteDetail.lockedAfterDownload") : t("dashboard.quoteDetail.chooseYourPdfLayout")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {(
                [
                  { id: "standard", label: t("dashboard.quoteDetail.templateStandardName"), desc: t("dashboard.quoteDetail.templateStandardDesc"), proOnly: false },
                  { id: "arosio", label: t("dashboard.quoteDetail.templateProfessionalName"), desc: t("dashboard.quoteDetail.templateProfessionalDesc"), proOnly: true },
                  { id: "mariagrazia", label: t("dashboard.quoteDetail.templateElegantName"), desc: t("dashboard.quoteDetail.templateElegantDesc"), proOnly: true },
                ] as const
              ).map(tmpl => {
                const isActive = localTemplateId === tmpl.id;
                const isLockable = isEditLocked;
                const requiresPro = tmpl.proOnly && !isPro;
                const isClickable = !isLockable && !requiresPro;
                const isProClickable = !isLockable && isPro;
                return (
                  <button
                    key={tmpl.id}
                    disabled={isLockable}
                    onClick={() => {
                      if (isLockable) return;
                      if (requiresPro) { setIsPaywallOpen(true); return; }
                      if (isActive || !id) return;
                      // Optimistic update
                      setLocalTemplateId(tmpl.id);
                      updateQuote.mutate({ id, data: { templateId: tmpl.id } }, {
                        onSuccess: (updated) => {
                          queryClient.setQueryData(getGetQuoteQueryKey(id), updated);
                          toast({ title: t("dashboard.quoteDetail.templateUpdated"), description: `Template "${tmpl.label}" ${t("dashboard.quoteDetail.templateSelected")}` });
                        },
                        onError: () => {
                          // Rollback
                          setLocalTemplateId(quote.templateId ?? "standard");
                          toast({ title: t("dashboard.quoteDetail.error"), description: t("dashboard.quoteDetail.errorChangeTemplate"), variant: "destructive" });
                        },
                      });
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-lg border text-xs transition-all",
                      isActive
                        ? "border-navy-400 bg-navy-50 dark:bg-navy-500/15 text-navy-900 dark:text-navy-300 ring-1 ring-navy-300"
                        : isClickable || isProClickable
                          ? "border-slate-200 hover:border-navy-300 hover:bg-slate-50 text-slate-700 cursor-pointer"
                          : requiresPro
                            ? "border-slate-200 hover:border-amber-300 hover:bg-amber-50 text-slate-600 cursor-pointer"
                            : "border-slate-200 opacity-50 text-slate-400 cursor-not-allowed"
                    )}
                  >
                    <div className="font-semibold flex items-center gap-1.5">
                      {isActive && <CheckCircle2 className="h-3 w-3 text-navy-600 shrink-0" />}
                      {tmpl.label}
                      {tmpl.proOnly && !isPro && (
                        <span className="ml-auto text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-300 rounded px-1.5 py-0.5 leading-none">PRO</span>
                      )}
                      {isEditLocked && <Lock className="h-3 w-3 ml-auto text-slate-400 shrink-0" />}
                    </div>
                    <div className="text-slate-500 mt-0.5 leading-snug">{tmpl.desc}</div>
                  </button>
                );
              })}
              {isEditLocked && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5 border border-amber-200">
                  {t("dashboard.quoteDetail.templateLockedAfterDownload")}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Contract (Phase 1) */}
          <QuoteContractCard quoteId={quote.id} quoteStatus={quote.status} hasContractsFeature={hasFeature(profile as never, "contracts")} />

          {/* Payment schedule (Phase 0: drives contract terms + invoicing) */}
          <PaymentScheduleCard
            quoteId={quote.id}
            schedule={(quote as unknown as { paymentSchedule?: PaymentSchedule | null }).paymentSchedule ?? null}
            total={quote.totale}
            locked={isEditMode}
          />

          {/* Summary card */}
          {hasCapitoli && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.quoteDetail.chapterSummary")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {capitoli.map(cap => (
                  <div key={cap.lettera} className="flex justify-between text-sm">
                    <span className="text-muted-foreground truncate mr-2">{cap.lettera}. {cap.titolo}</span>
                    <span className="font-medium shrink-0">{formatCurrency(cap.subtotale)}</span>
                  </div>
                ))}
                <div className="border-t pt-2 mt-2 flex justify-between font-bold text-sm">
                  <span>{t("dashboard.quoteDetail.total")}</span>
                  <span>{formatCurrency(quote.totale)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-muted/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                {t("dashboard.quoteDetail.originalInput")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground italic">"{quote.rawInput}"</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── CAPITOLATO PRO DIALOG ── */}
      <Dialog open={isCapitolatoDialogOpen} onOpenChange={setIsCapitolatoDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-navy-600" />
              {t("dashboard.quoteDetail.upgradeProSpecTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("dashboard.quoteDetail.upgradeProSpecDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-navy-50 dark:bg-navy-500/15 border border-navy-200 dark:border-navy-800/40 px-4 py-3 text-sm text-navy-800 dark:text-navy-300 space-y-1">
            <p className="font-semibold">{t("dashboard.quoteDetail.whatWillUpdate")}</p>
            <ul className="list-disc list-inside space-y-0.5 text-navy-700 dark:text-navy-300">
              <li>{t("dashboard.quoteDetail.updateItem1")}</li>
              <li>{t("dashboard.quoteDetail.updateItem2")}</li>
              <li>{t("dashboard.quoteDetail.updateItem3")}</li>
            </ul>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setIsCapitolatoDialogOpen(false)} disabled={upgradeToCapitolato.isPending}>
              {t("dashboard.quoteDetail.cancel")}
            </Button>
            <Button
              onClick={handleConfirmCapitolatoUpgrade}
              disabled={upgradeToCapitolato.isPending}
              className="gap-2 bg-navy-600 hover:bg-navy-700 text-white"
            >
              {upgradeToCapitolato.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
              {upgradeToCapitolato.isPending ? t("dashboard.quoteDetail.upgradingInProgress") : t("dashboard.quoteDetail.upgradeNow")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── AI REGEN DIALOG ── */}
      <Dialog open={isRegenOpen} onOpenChange={setIsRegenOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-navy-500" />
              {t("dashboard.quoteDetail.regenerateWithAiTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("dashboard.quoteDetail.regenerateWithAiDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-lg bg-muted/50 border px-4 py-3 text-sm text-muted-foreground italic">
              "{quote.rawInput}"
            </div>
            <div className="space-y-1.5">
              <Label>{t("dashboard.quoteDetail.newInstructions")}</Label>
              <Textarea
                value={regenDescription}
                onChange={e => setRegenDescription(e.target.value)}
                placeholder={t("dashboard.quoteDetail.regenerateExamplePlaceholder")}
                className="resize-none min-h-[90px]"
                disabled={regenerateQuote.isPending}
              />
              <p className="text-xs text-muted-foreground">
                {t("dashboard.quoteDetail.regenerateHint")}
              </p>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => { setIsRegenOpen(false); setRegenDescription(""); }} disabled={regenerateQuote.isPending}>
                {t("dashboard.quoteDetail.cancel")}
              </Button>
              <Button onClick={handleRegenerate} disabled={regenerateQuote.isPending} className="gap-2">
                {regenerateQuote.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> {t("dashboard.quoteDetail.generatingInProgress")}</>
                ) : (
                  <><RefreshCw className="h-4 w-4" /> {t("dashboard.quoteDetail.regenerate")}</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* Paywall dialog */}
      <Dialog open={isPaywallOpen} onOpenChange={setIsPaywallOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0">
          <div className="px-6 pt-5 pb-3 border-b shrink-0">
            <DialogHeader>
              {subscription?.isActive && subscription?.plan === "monthly_starter" ? (
                <>
                  <DialogTitle className="text-lg">{t("dashboard.quoteDetail.upgradeToProPlanTitle")}</DialogTitle>
                  <DialogDescription className="text-sm">
                    {t("dashboard.quoteDetail.starterNoticePrefix")} <strong>Starter</strong> {t("dashboard.quoteDetail.starterNoticeMiddle")}<br/>
                    {t("dashboard.quoteDetail.starterNoticeSuffix")} <strong>Pro</strong> {t("dashboard.quoteDetail.starterNoticeEnd")}
                  </DialogDescription>
                </>
              ) : (
                <>
                  <DialogTitle className="text-lg">{t("dashboard.quoteDetail.unlockQuoteTitle")}</DialogTitle>
                  <DialogDescription className="text-sm">
                    {t("dashboard.quoteDetail.choosePlanToDownload")}
                  </DialogDescription>
                </>
              )}
            </DialogHeader>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
            {/* If user is on Starter → show upgrade options */}
            {subscription?.isActive && subscription?.plan === "monthly_starter" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "monthly_pro", label: "Pro", price: `$49${t("dashboard.quoteDetail.perMonth")}`, badge: t("dashboard.quoteDetail.mostPopular"), features: [t("dashboard.quoteDetail.feature60Quotes"), t("dashboard.quoteDetail.featureNoWatermark"), t("dashboard.quoteDetail.featureAllTemplates"), t("dashboard.quoteDetail.featurePhotoUpload")], highlight: true },
                    { id: "monthly_elite", label: "Elite", price: `$59${t("dashboard.quoteDetail.perMonth")}`, badge: t("dashboard.quoteDetail.unlimited"), features: [t("dashboard.quoteDetail.featureUnlimitedQuotes"), t("dashboard.quoteDetail.featureNoWatermark"), t("dashboard.quoteDetail.featureAllTemplates"), t("dashboard.quoteDetail.featureDedicatedSupport")], highlight: false },
                  ].map((opt) => (
                    <div key={opt.id} className={`relative rounded-xl border p-4 flex flex-col ${opt.highlight ? "border-primary ring-1 ring-primary shadow-sm bg-gradient-to-br from-navy-50 to-teal-50" : "border-amber-300 bg-amber-50/30"}`}>
                      <div className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold px-2 py-0.5 rounded-full text-white whitespace-nowrap ${opt.highlight ? "bg-primary" : "bg-amber-500"}`}>
                        {opt.badge}
                      </div>
                      <div className="font-bold text-sm mb-0.5 mt-1">{opt.label}</div>
                      <div className="text-base font-extrabold text-foreground mb-2">{opt.price}</div>
                      <ul className="space-y-1 mb-3 flex-1">
                        {opt.features.map((f, i) => (
                          <li key={i} className="flex items-center gap-1.5 text-xs text-foreground">
                            <CheckCircle2 className={`h-3 w-3 shrink-0 ${opt.highlight ? "text-primary" : "text-amber-500"}`} />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <Button size="sm" className={`w-full text-xs h-8 ${opt.highlight ? "" : "bg-amber-500 hover:bg-amber-600 border-0"}`}
                        onClick={handleUpgrade} disabled={createPortal.isPending}>
                        {createPortal.isPending ? "..." : `${t("dashboard.quoteDetail.switchToPrefix")} ${opt.label} →`}
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground text-center">
                  {t("dashboard.quoteDetail.managedByStripe")}
                </p>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">{t("dashboard.quoteDetail.orSinglePurchase")}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {(Array.isArray(plans) ? plans : []).filter(p => !p.interval).map((plan) => {
                    const isClean = plan.id === "oneshot_clean";
                    return (
                      <div key={plan.id} className={`rounded-lg border p-3 flex flex-col hover:bg-muted/40 transition-colors ${isClean ? "border-primary/30" : ""}`}>
                        <div className="font-medium text-sm mb-0.5">{plan.name}</div>
                        <div className="text-xs text-muted-foreground mb-2">{plan.features[0]}</div>
                        <div className="flex items-center justify-between mt-auto">
                          <span className="font-bold text-sm">${plan.price}</span>
                          <Button size="sm" variant={isClean ? "default" : "outline"} className="h-7 text-xs px-3"
                            onClick={() => handleCheckout(plan.id)} disabled={createCheckout.isPending}>
                            {createCheckout.isPending ? "..." : t("dashboard.quoteDetail.buy")}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                {/* Subscription plans — 3 columns */}
                <div className="grid grid-cols-3 gap-2">
                  {plans?.filter(p => p.interval).map((plan, idx) => {
                    const isPro = plan.id === "monthly_pro";
                    const isElite = plan.id === "monthly_elite";
                    return (
                      <div
                        key={plan.id}
                        className={`plan-card-enter relative rounded-lg border p-3 flex flex-col ${
                          isPro ? "border-primary ring-1 ring-primary shadow-sm" : isElite ? "border-amber-300" : ""
                        }`}
                        style={{ animationDelay: `${idx * 0.05}s` }}
                      >
                        {isPro && (
                          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                            <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">{t("dashboard.quoteDetail.popBadge")}</span>
                          </div>
                        )}
                        {isElite && (
                          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                            <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{t("dashboard.quoteDetail.infinityBadge")}</span>
                          </div>
                        )}
                        <div className="font-semibold text-xs mt-1 mb-0.5">{plan.name}</div>
                        <div className="mb-1.5">
                          <span className="text-base font-bold">${plan.price}</span>
                          <span className="text-muted-foreground text-[10px]">{t("dashboard.quoteDetail.perMonth")}</span>
                        </div>
                        <ul className="space-y-0.5 mb-2.5 flex-1">
                          {plan.features.slice(0, 3).map((feature, i) => (
                            <li key={i} className="flex items-start gap-1 text-muted-foreground">
                              <CheckCircle2 className={`h-2.5 w-2.5 shrink-0 mt-0.5 ${isPro ? "text-primary" : isElite ? "text-amber-500" : "text-muted-foreground/60"}`} />
                              <span className="text-[10px] leading-snug">{feature}</span>
                            </li>
                          ))}
                        </ul>
                        <Button size="sm" className={`w-full text-[10px] h-7 ${isElite ? "bg-amber-500 hover:bg-amber-600 border-0" : ""}`}
                          variant={isPro ? "default" : isElite ? "default" : "outline"}
                          onClick={() => handleCheckout(plan.id)} disabled={createCheckout.isPending}>
                          {createCheckout.isPending ? "..." : `${t("dashboard.quoteDetail.choosePrefix")} ${plan.name}`}
                        </Button>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">{t("dashboard.quoteDetail.orSinglePurchase")}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {plans?.filter(p => !p.interval).map((plan, idx) => {
                    const isClean = plan.id === "oneshot_clean";
                    return (
                      <div key={plan.id}
                        className={`plan-card-enter rounded-lg border p-3 flex flex-col hover:bg-muted/40 transition-colors ${isClean ? "border-primary/30" : ""}`}
                        style={{ animationDelay: `${(idx + 3) * 0.05}s` }}
                      >
                        <div className="font-medium text-sm mb-0.5">{plan.name}</div>
                        <div className="text-xs text-muted-foreground mb-2">{plan.features[0]}</div>
                        <div className="flex items-center justify-between mt-auto">
                          <span className="font-bold text-sm">${plan.price}</span>
                          <Button size="sm" variant={isClean ? "default" : "outline"} className="h-7 text-xs px-3"
                            onClick={() => handleCheckout(plan.id)} disabled={createCheckout.isPending}>
                            {createCheckout.isPending ? "..." : t("dashboard.quoteDetail.buy")}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Email send dialog */}
      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-lg">{t("dashboard.quoteDetail.sendQuoteByEmailTitle")}</DialogTitle>
            <DialogDescription className="text-sm">
              {t("dashboard.quoteDetail.sendQuoteByEmailDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="emailTo">{t("dashboard.quoteDetail.recipientEmailLabel")}</Label>
              <Input
                id="emailTo"
                type="email"
                placeholder="client@example.com"
                value={emailTo}
                onChange={e => setEmailTo(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSendEmail(); }}
              />
            </div>
            {quote?.clientData && (
              <div className="text-xs text-muted-foreground">
                {t("dashboard.quoteDetail.recipientPrefix")} <strong>{(quote.clientData as { nome?: string })?.nome || t("dashboard.quoteDetail.clientFallback")}</strong>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsEmailDialogOpen(false)}>{t("dashboard.quoteDetail.cancel")}</Button>
            <Button
              onClick={handleSendEmail}
              disabled={!emailTo.trim().includes("@") || sendPdfEmail.isPending}
              className="gap-2"
            >
              {sendPdfEmail.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Mail className="h-4 w-4" />}
              {t("dashboard.quoteDetail.send")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
