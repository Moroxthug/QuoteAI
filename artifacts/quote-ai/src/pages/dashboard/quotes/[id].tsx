import { localDay } from "@/lib/local-day";
import { Link, useParams, useSearch } from "wouter";
import { useGetQuote, useGetBusinessProfile, useGenerateQuotePdf, useGetPlans, useUpdateQuote, useCreateCheckoutSession, useVerifyPayment, useGetSubscription, useUnlockQuoteWithSubscription, useCreateCustomerPortalSession, useRegenerateQuote, useDuplicateQuote, useUpgradeToCapitolatoPro, useGenerateQuotePdfPro, useGetTrialStatus, useListClients, useSendQuotePdfEmail, useListQuoteVariants, useCreateQuoteVariant, useUpdateQuoteVariant, useDeleteQuoteVariant, getGetQuoteQueryKey, getVerifyPaymentQueryKey, getListQuotesQueryKey, getGetTrialStatusQueryKey, getListQuoteVariantsQueryKey } from "@workspace/api-client-react";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Download, Lock, CheckCircle2, Edit2, Save, FileText, FileSpreadsheet, ImageIcon, ChevronDown, ChevronRight, Plus, Trash2, X, Pencil, Sparkles, AlertTriangle, RefreshCw, Loader2, Copy, Star, FileDown, LayoutTemplate, Mail, Hammer } from "lucide-react";
import { useState, useRef, useEffect, Fragment } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { taxLineLabel } from "@/lib/tax-display";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";
import { PaymentScheduleCard } from "@/components/payment-schedule-card";
import { QuoteContractCard } from "@/components/quote-contract-card";
import { PriceCheckCard } from "@/components/quotes/price-check-card";
import { jobsApi } from "@/lib/jobs-api";
import { hasFeature } from "@/lib/plans";
import type { PaymentSchedule } from "@/lib/payment-schedule";
import { formatCad } from "@/lib/money";

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
const can = useCan();
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
      (quote?.status === "draft" || quote?.status === "pending_payment") &&
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
  const [editIvaPerc, setEditIvaPerc] = useState(0);
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
        // Sending unlocks a draft (trial or subscription) — refresh status + trial counter.
        queryClient.invalidateQueries({ queryKey: getGetQuoteQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetTrialStatusQueryKey() });
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
    } catch {
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
        plannedStart: localDay(),
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
    setEditIvaPerc(quote.ivaPercentuale ?? 0);
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
  // …and once the client has accepted: the accepted amount is what the contract is built on.
  // Phase 80: foreman/viewer (quotes:view) get the read-only page; the server refuses their edits anyway.
  const isEditLocked = !!quote.pdfDownloadedAt || quote.status === "accepted" || !can("quotes", "edit");
  const formatCurrency = (amount: number) => formatCad(amount);

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

  const templateName = localTemplateId === "arosio"
    ? t("dashboard.quoteDetail.templateProfessionalName")
    : localTemplateId === "mariagrazia"
      ? t("dashboard.quoteDetail.templateElegantName")
      : t("dashboard.quoteDetail.templateStandardName");

  // Description cell for the two "pro" templates: first line is the brief
  // title, the rest is the AI-written professional description.
  const renderProDesc = (ci: number, vi: number, descrizione: string) => {
    const parts = descrizione.split("\n");
    const title = parts[0];
    const professionalDesc = parts.slice(1).join("\n");
    const isRegenerating = regeneratingVoceKey === `${ci}-${vi}`;
    return (
      <>
        <div className="ttl">
          <span>{title}</span>
          <button
            type="button"
            className="ic-btn"
            onClick={() => handleRegenerateSingleVoce(ci, vi, title)}
            disabled={isRegenerating}
            title={t("dashboard.quoteDetail.regenerateProDescTitle")}
            aria-label={t("dashboard.quoteDetail.regenerateProDescTitle")}
          >
            {isRegenerating ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          </button>
        </div>
        {professionalDesc ? (
          <p className="pro">{professionalDesc}</p>
        ) : (
          <button type="button" className="text-link" onClick={() => handleRegenerateSingleVoce(ci, vi, title)} disabled={isRegenerating}>
            <Sparkles /> {t("dashboard.quoteDetail.addAiProDescription")}
          </button>
        )}
      </>
    );
  };

  // One editable line-item row, shared by the three edit-mode tables.
  const renderEditVoceRow = (ci: number, vi: number, voce: EditVoce, num?: string) => {
    const vTot = Number(voce.quantita) * Number(voce.prezzoUnitario);
    return (
      <tr key={vi}>
        {num !== undefined && <td className="c faint">{num}</td>}
        <td>
          <input value={voce.descrizione} onChange={e => updateVoce(ci, vi, "descrizione", e.target.value)} className="inl" placeholder={t("dashboard.quoteDetail.itemDescriptionPlaceholder")} aria-label={t("dashboard.quoteDetail.colDescription")} />
        </td>
        <td><input value={voce.um} onChange={e => updateVoce(ci, vi, "um", e.target.value)} className="inl c" aria-label={t("dashboard.quoteDetail.colUnit")} /></td>
        <td><input type="number" value={voce.quantita} onChange={e => updateVoce(ci, vi, "quantita", e.target.value === "" ? 0 : Number(e.target.value))} className="inl c" min={0} step={0.01} aria-label={t("dashboard.quoteDetail.colQty")} /></td>
        <td><input type="number" value={voce.prezzoUnitario} onChange={e => updateVoce(ci, vi, "prezzoUnitario", e.target.value === "" ? 0 : Number(e.target.value))} className="inl r" min={0} step={0.01} aria-label={t("dashboard.quoteDetail.colUnitPrice")} /></td>
        <td className="r amt">{formatCurrency(vTot)}</td>
        <td>
          <button type="button" onClick={() => removeVoce(ci, vi)} className="ic-btn danger" title={t("dashboard.quoteDetail.deleteItem")} aria-label={t("dashboard.quoteDetail.deleteItem")}><X /></button>
        </td>
      </tr>
    );
  };

  const editHeadCells = (withNum: boolean) => (
    <tr>
      {withNum && <th className="c w-num">{t("dashboard.quoteDetail.colNo")}</th>}
      <th>{t("dashboard.quoteDetail.colDescription")}</th>
      <th className="c w-um">{t("dashboard.quoteDetail.colUnit")}</th>
      <th className="c w-qty">{t("dashboard.quoteDetail.colQty")}</th>
      <th className="r w-price">{t("dashboard.quoteDetail.colUnitPrice")}</th>
      <th className="r w-tot">{t("dashboard.quoteDetail.colTotal")}</th>
      <th className="w-act"></th>
    </tr>
  );

  const templateChoices = [
    { id: "standard", label: t("dashboard.quoteDetail.templateStandardName"), desc: t("dashboard.quoteDetail.templateStandardDesc"), proOnly: false },
    { id: "arosio", label: t("dashboard.quoteDetail.templateProfessionalName"), desc: t("dashboard.quoteDetail.templateProfessionalDesc"), proOnly: true },
    { id: "mariagrazia", label: t("dashboard.quoteDetail.templateElegantName"), desc: t("dashboard.quoteDetail.templateElegantDesc"), proOnly: true },
  ] as const;

  return (
    <div className="animate-in fade-in duration-300" style={{ maxWidth: 1120, marginInline: "auto" }}>
      <Link href="/dashboard/quotes" className="back-link"><ArrowLeft /> {t("dashboard.quoteDetail.backToList")}</Link>

      {/* Page head */}
      <div className="page-head">
        <div className="min-w-0">
          <div className="title-row">
            <h1><FileText /> {t("dashboard.quoteDetail.title")}</h1>
            {isLocked ? (
              <span className="chip chip-grey"><Lock className="h-3 w-3 mr-1" /> {t("dashboard.quoteDetail.statusDraftLocked")}</span>
            ) : (
              <span className="chip chip-green"><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.quoteDetail.statusUnlocked")}</span>
            )}
            {quote.status === "accepted" && (
              <span className="chip chip-green"><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.quoteDetail.acceptedByPrefix")} {quote.acceptedByName}</span>
            )}
            {quote.capitolatoPro && (
              <span className="chip chip-purple"><Star className="h-3 w-3 mr-1" /> {t("dashboard.quoteDetail.proSpecBadge")}</span>
            )}
            <span className="chip chip-grey"><LayoutTemplate className="h-3 w-3 mr-1" /> {templateName}</span>
          </div>
          <div className="meta">
            <span>{t("dashboard.quoteDetail.createdOnPrefix")} {format(new Date(quote.createdAt), "dd MMMM yyyy", { locale: dateLocale })}</span>
            {quote.numeroPreventivoData && <span>{quote.numeroPreventivoData}</span>}
          </div>
        </div>
        <div className="head-actions">
          {!isEditLocked && (
            <button type="button" className={cn("btn btn-sm", isEditMode ? "btn-navy" : "btn-outline-navy")} onClick={isEditMode ? () => setIsEditMode(false) : enterEditMode}>
              {isEditMode ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              {isEditMode ? t("dashboard.quoteDetail.closeEditor") : t("dashboard.quoteDetail.edit")}
            </button>
          )}
          {!isEditLocked && (
            <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setIsRegenOpen(true)}>
              <Sparkles className="h-4 w-4" /> {t("dashboard.quoteDetail.regenerate")}
            </button>
          )}
          <button type="button" onClick={isLocked ? handleUnlock : handleDownload} disabled={generatePdf.isPending} className={cn("btn btn-sm", isLocked ? "btn-navy" : "btn-outline-navy")}>
            {generatePdf.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : isLocked ? <Lock className="h-4 w-4" /> : <Download className="h-4 w-4" />}
            {t("dashboard.quoteDetail.downloadPdf")}
          </button>
          {!isLocked && can("quotes", "edit") && (
            <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setIsEmailDialogOpen(true)} disabled={sendPdfEmail.isPending}>
              {sendPdfEmail.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {t("dashboard.quoteDetail.sendByEmail")}
            </button>
          )}
          {!isLocked && (quote?.status === "unlocked" || quote?.status === "accepted") && (
            <button type="button" className="btn btn-sm btn-outline-navy" onClick={handleCopyPublicLink}>
              <Copy className="h-4 w-4" /> {t("dashboard.quoteDetail.copyClientLink")}
            </button>
          )}
          {!isLocked && quote?.status === "unlocked" && can("jobs", "edit") && (
            <button type="button" className="btn btn-sm btn-navy" style={{ background: "var(--green)" }} onClick={handleAvviaCantiere} disabled={avviandoCantiere}>
              {avviandoCantiere ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hammer className="h-4 w-4" />}
              {t("dashboard.quoteDetail.startCrmProject")}
            </button>
          )}
          {!quote.capitolatoPro && can("quotes", "edit") && (
            <button type="button" className="btn btn-sm btn-outline-navy" onClick={handleUpgradeToCapitolato} disabled={upgradeToCapitolato.isPending}>
              {upgradeToCapitolato.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
              {isPro ? t("dashboard.quoteDetail.upgradeToProSpec") : t("dashboard.quoteDetail.proSpec")}
              {!isPro && <Lock className="h-3 w-3 opacity-60" />}
            </button>
          )}
          {quote.capitolatoPro && isPro && quote.status === "unlocked" && (
            <button type="button" className="btn btn-sm btn-outline-navy" onClick={handleDownloadProPdf} disabled={generatePdfPro.isPending}>
              {generatePdfPro.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              {t("dashboard.quoteDetail.downloadProPdf")}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main preview card */}
        <div className="lg:col-span-2">
          <section className="card" style={{ overflow: "hidden" }}>

            {/* Edit mode top banner */}
            {isEditMode && !isEditLocked && (
              <div className="edit-bar">
                <b><Pencil /> {t("dashboard.quoteDetail.editModeBanner")}</b>
                <div className="actions">
                  <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setIsEditMode(false)}>
                    <X className="h-3.5 w-3.5" /> {t("dashboard.quoteDetail.cancel")}
                  </button>
                  <button type="button" className="btn btn-sm btn-navy" onClick={handleSaveEdit} disabled={updateQuote.isPending}>
                    <Save className="h-3.5 w-3.5" />
                    {updateQuote.isPending ? t("dashboard.quoteDetail.saving") : t("dashboard.quoteDetail.saveChanges")}
                  </button>
                </div>
              </div>
            )}

            {/* Template-reactive preview banner */}
            {localTemplateId !== "standard" && (
              <div className={cn("tpl-bar", localTemplateId === "arosio" ? "pro" : "elegant")}>
                <LayoutTemplate />
                {localTemplateId === "arosio" ? t("dashboard.quoteDetail.templateProfessionalPreview") : t("dashboard.quoteDetail.templateElegantPreview")}
                <small>{t("dashboard.quoteDetail.previewNote")}</small>
              </div>
            )}

            <div className={cn("doc-view paper", !isEditMode && "readonly")}>
              {/* Company header */}
              <div className="paper-head">
                <div>
                  {companyLogoUrl && <img src={companyLogoUrl} alt={t("a11y.companyLogo")} />}
                  <h2>{companyName}</h2>
                  {companyVat && <small>{t("dashboard.quoteDetail.taxIdLabel")} {companyVat}</small>}
                  {companyAddress && <small>{companyAddress}</small>}
                  {companyPhone && <small>{companyPhone}</small>}
                  {companyEmail && <small>{companyEmail}</small>}
                </div>
                <div className="num">
                  <span className="eyebrow">{t("dashboard.quoteDetail.quoteLabel")}</span>
                  {quote.numeroPreventivoData && <b>{quote.numeroPreventivoData}</b>}
                  <small>{t("dashboard.quoteDetail.dateLabel")} {format(new Date(quote.createdAt), "yyyy-MM-dd")}</small>
                </div>
              </div>

              {/* Document title */}
              {isEditMode ? (
                <div className="paper-title">
                  <input value={editTitolo1} onChange={e => setEditTitolo1(e.target.value)} className="inl t1" placeholder={t("dashboard.quoteDetail.titlePlaceholder")} aria-label={t("dashboard.quoteDetail.titlePlaceholder")} />
                  <input value={editTitolo2} onChange={e => setEditTitolo2(e.target.value)} className="inl t2" placeholder={t("dashboard.quoteDetail.subtitlePlaceholder")} aria-label={t("dashboard.quoteDetail.subtitlePlaceholder")} />
                </div>
              ) : (
                quote.titoloPreventivoRiga1 && (
                  <div className="paper-title">
                    <b>{quote.titoloPreventivoRiga1}</b>
                    {quote.titoloPreventivoRiga2 && <i>{quote.titoloPreventivoRiga2}</i>}
                  </div>
                )
              )}

              {/* Client section */}
              <div className="paper-sec">
                <span className="eyebrow">{t("dashboard.quoteDetail.billTo")}</span>
                {isEditMode ? (
                  <div className="paper-box edit">
                    {/* Saved client selector */}
                    {savedClients && savedClients.length > 0 && (
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
                        className="inp-sm full"
                        aria-label={t("dashboard.quoteDetail.selectSavedClient")}
                      >
                        <option value="" disabled>{t("dashboard.quoteDetail.selectSavedClient")}</option>
                        {savedClients.map(c => (
                          <option key={c.id} value={c.id}>{c.clientName}{c.city ? ` — ${c.city}` : ""}</option>
                        ))}
                      </select>
                    )}
                    <input value={editClientNome} onChange={e => setEditClientNome(e.target.value)} placeholder={t("dashboard.quoteDetail.nameBusinessNamePlaceholder")} className="inp-sm full" aria-label={t("dashboard.quoteDetail.nameBusinessNamePlaceholder")} />
                    <input value={editClientIndirizzo} onChange={e => setEditClientIndirizzo(e.target.value)} placeholder={t("dashboard.quoteDetail.streetPlaceholder")} className="inp-sm full" aria-label={t("dashboard.quoteDetail.streetPlaceholder")} />
                    <input value={editClientCity} onChange={e => setEditClientCity(e.target.value)} placeholder={t("dashboard.new.client.city")} className="inp-sm" aria-label={t("dashboard.new.client.city")} />
                    <div className="two">
                      <input value={editClientProvince} onChange={e => setEditClientProvince(e.target.value.toUpperCase())} placeholder={t("a11y.provincePlaceholder")} maxLength={2} className="inp-sm" aria-label={t("contracts.detail.province")} />
                      <input value={editClientPostalCode} onChange={e => setEditClientPostalCode(e.target.value.toUpperCase())} placeholder={t("dashboard.new.client.postalCode")} maxLength={7} className="inp-sm" aria-label={t("dashboard.new.client.postalCode")} />
                    </div>
                    <input value={editClientBusinessNumber} onChange={e => setEditClientBusinessNumber(e.target.value.toUpperCase())} placeholder={t("dashboard.new.client.businessNumber")} maxLength={16} className="inp-sm" aria-label={t("dashboard.new.client.businessNumber")} />
                    <input value={editClientPIVA} onChange={e => setEditClientPIVA(e.target.value)} placeholder={t("admin.gstHstNumber")} maxLength={15} className="inp-sm" aria-label={t("admin.gstHstNumber")} />
                  </div>
                ) : isEditingClient ? (
                  <div className="paper-box">
                    <div className="stack-sm">
                      <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder={t("dashboard.quoteDetail.nameBusinessNamePlaceholder")} className="inp-sm" aria-label={t("dashboard.quoteDetail.nameBusinessNamePlaceholder")} />
                      <input value={clientAddress} onChange={e => setClientAddress(e.target.value)} placeholder={t("dashboard.quoteDetail.addressPlaceholder")} className="inp-sm" aria-label={t("dashboard.quoteDetail.addressPlaceholder")} />
                    </div>
                    <div className="actions">
                      <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setIsEditingClient(false)}>{t("dashboard.quoteDetail.cancel")}</button>
                      <button type="button" className="btn btn-sm btn-navy" onClick={handleSaveClient} disabled={updateQuote.isPending}><Save className="h-4 w-4" /> {t("dashboard.quoteDetail.save")}</button>
                    </div>
                  </div>
                ) : (
                  <div className="paper-box">
                    <div className="who">{quote.clientData?.nome || "——"}</div>
                    {quote.clientData?.indirizzo && <div className="line">{quote.clientData.indirizzo}</div>}
                    {quote.clientData?.city && (
                      <div className="line faint">
                        {[quote.clientData.city, quote.clientData.province, quote.clientData.postalCode].filter(Boolean).join(" ")}
                      </div>
                    )}
                    {(quote.clientData?.businessNumber || quote.clientData?.partitaIva) && (
                      <div className="line faint">
                        {quote.clientData.businessNumber && `BN: ${quote.clientData.businessNumber}`}
                        {quote.clientData.businessNumber && quote.clientData.partitaIva && " · "}
                        {quote.clientData.partitaIva && `GST/HST: ${quote.clientData.partitaIva}`}
                      </div>
                    )}
                    {!isEditLocked && (
                      <button type="button" className="ic-btn hover-act" onClick={() => setIsEditingClient(true)} aria-label={t("dashboard.quoteDetail.edit")}>
                        <Edit2 />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Attachments */}
              {quote.attachments && quote.attachments.length > 0 && (
                <div className="paper-sec">
                  <span className="eyebrow">{t("dashboard.quoteDetail.attachments")}</span>
                  <div className="flex flex-wrap gap-2">
                    {quote.attachments.map(att => {
                      const isImage = att.mimeType?.startsWith("image/");
                      const isXlsx = att.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                      const icon = isImage ? <ImageIcon className="ic" /> : isXlsx ? <FileSpreadsheet className="ic" /> : <FileText className="ic" />;
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
                          className="att-doc link"
                          title={att.fileName}
                        >
                          {icon}
                          <span>{att.fileName}</span>
                          {sizeLabel && <small>{sizeLabel}</small>}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quadro Sintetico — shown for Standard template in edit mode or view mode */}
              {localTemplateId === "standard" && (isEditMode ? editCapitoli.length > 0 : hasCapitoli) && (
                <div className="paper-sec">
                  <span className="eyebrow">{t("dashboard.quoteDetail.summaryOverview")}</span>
                  <div className="paper-tw" tabIndex={0}>
                    <table className="ptbl">
                      <thead>
                        <tr>
                          <th>{t("dashboard.quoteDetail.chapterCol")}</th>
                          <th className="r w-tot">{t("dashboard.quoteDetail.netAmountCol")}</th>
                          <th className="hidden sm:table-cell">{t("dashboard.quoteDetail.noteCol")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(isEditMode ? editCapitoli : capitoli).map((cap) => {
                          const sub = isEditMode
                            ? (cap as typeof editCapitoli[0]).voci.reduce((s, v) => s + Number(v.quantita) * Number(v.prezzoUnitario), 0)
                            : (cap as typeof capitoli[0]).subtotale;
                          return (
                            <tr key={cap.lettera}>
                              <td>{cap.lettera}. {cap.titolo}</td>
                              <td className="r amt">{formatCurrency(sub)}</td>
                              <td className="note hidden sm:table-cell">{cap.osservazione ?? t("dashboard.quoteDetail.ordinaryItemDefault")}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Chapter detail sections — branched by template */}
              {isEditMode && localTemplateId === "arosio" ? (
                /* ── AROSIO EDITOR: numbered sections, navy headers, subtotals ── */
                <div className="paper-sec">
                  <div className="paper-tw" tabIndex={0}>
                    <table className="ptbl">
                      <thead>{editHeadCells(true)}</thead>
                      <tbody>
                        {editCapitoli.map((cap, ci) => {
                          const capSub = cap.voci.reduce((s, v) => s + Number(v.quantita) * Number(v.prezzoUnitario), 0);
                          return (
                            <Fragment key={ci}>
                              <tr className="chap">
                                <td colSpan={7}>
                                  <div className="row">
                                    <span>{String(ci + 1).padStart(2, "0")}_</span>
                                    <input value={cap.titolo} onChange={e => updateCapitolo(ci, "titolo", e.target.value)} className="inl light" placeholder={t("dashboard.quoteDetail.chapterTitlePlaceholder")} aria-label={t("dashboard.quoteDetail.chapterTitlePlaceholder")} />
                                    <span className="amt">{formatCurrency(capSub)}</span>
                                    <button type="button" onClick={() => removeCapitolo(ci)} className="ic-btn" title={t("dashboard.quoteDetail.deleteChapter")} aria-label={t("dashboard.quoteDetail.deleteChapter")}><Trash2 /></button>
                                  </div>
                                </td>
                              </tr>
                              {cap.voci.map((voce, vi) => renderEditVoceRow(ci, vi, voce, `${ci + 1}.${vi + 1}`))}
                              <tr className="sum">
                                <td colSpan={5}>
                                  <button type="button" onClick={() => addVoce(ci)} className="text-link"><Plus /> {t("dashboard.quoteDetail.addItem")}</button>
                                </td>
                                <td className="r amt">{formatCurrency(capSub)}</td>
                                <td></td>
                              </tr>
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <button type="button" onClick={addCapitolo} className="add-dashed"><Plus /> {t("dashboard.quoteDetail.addChapter")}</button>
                </div>
              ) : isEditMode && localTemplateId === "mariagrazia" ? (
                /* ── MARIAGRAZIA EDITOR: grouped by chapter, flat numbering ── */
                <div className="paper-sec">
                  <div className="paper-tw" tabIndex={0}>
                    <table className="ptbl">
                      <thead>{editHeadCells(true)}</thead>
                      <tbody>
                        {(() => {
                          let globalIdx = 0;
                          return editCapitoli.map((cap, ci) => {
                            const capSub = cap.voci.reduce((s, v) => s + Number(v.quantita) * Number(v.prezzoUnitario), 0);
                            return (
                              <Fragment key={ci}>
                                <tr className="chap soft">
                                  <td colSpan={7}>
                                    <div className="row">
                                      <input value={cap.titolo} onChange={e => updateCapitolo(ci, "titolo", e.target.value)} className="inl" placeholder={t("dashboard.quoteDetail.chapterTitlePlaceholderLower")} aria-label={t("dashboard.quoteDetail.chapterTitlePlaceholderLower")} />
                                      <span className="amt">{formatCurrency(capSub)}</span>
                                      <button type="button" onClick={() => removeCapitolo(ci)} className="ic-btn danger" title={t("dashboard.quoteDetail.deleteChapter")} aria-label={t("dashboard.quoteDetail.deleteChapter")}><Trash2 /></button>
                                    </div>
                                  </td>
                                </tr>
                                {cap.voci.map((voce, vi) => renderEditVoceRow(ci, vi, voce, String(++globalIdx)))}
                                <tr className="sum">
                                  <td colSpan={7}>
                                    <button type="button" onClick={() => addVoce(ci)} className="text-link"><Plus /> {t("dashboard.quoteDetail.addItem")}</button>
                                  </td>
                                </tr>
                              </Fragment>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                  <button type="button" onClick={addCapitolo} className="add-dashed"><Plus /> {t("dashboard.quoteDetail.addChapter")}</button>
                </div>
              ) : isEditMode ? (
                /* ── STANDARD INLINE EDIT MODE ── */
                <div className="paper-sec">
                  <span className="eyebrow">{t("dashboard.quoteDetail.detailedBreakdown")}</span>
                  <div>
                    {editCapitoli.map((cap, capIdx) => {
                      const capSub = cap.voci.reduce((s, v) => s + Number(v.quantita) * Number(v.prezzoUnitario), 0);
                      return (
                        <div key={capIdx} className="chap-block edit">
                          {/* Chapter header — editable */}
                          <div className="chap-head">
                            <span className="let">{cap.lettera}.</span>
                            <input value={cap.titolo} onChange={e => updateCapitolo(capIdx, "titolo", e.target.value)} className="inl" placeholder={t("dashboard.quoteDetail.chapterTitlePlaceholderLower")} aria-label={t("dashboard.quoteDetail.chapterTitlePlaceholderLower")} />
                            <input value={cap.osservazione ?? ""} onChange={e => updateCapitolo(capIdx, "osservazione", e.target.value)} className="inl obs" placeholder={t("dashboard.quoteDetail.notePlaceholder")} aria-label={t("dashboard.quoteDetail.notePlaceholder")} />
                            <span className="amt">{formatCurrency(capSub)}</span>
                            <button type="button" onClick={() => removeCapitolo(capIdx)} className="ic-btn danger" title={t("dashboard.quoteDetail.deleteChapter")} aria-label={t("dashboard.quoteDetail.deleteChapter")}><Trash2 /></button>
                          </div>
                          {/* Voci — stacked cards on phones, table from 640px up */}
                          <div className="chap-mobile">
                            {cap.voci.map((voce, vi) => {
                              const vTot = Number(voce.quantita) * Number(voce.prezzoUnitario);
                              return (
                                <div key={vi} className="li">
                                  <div className="row">
                                    <input value={voce.descrizione} onChange={e => updateVoce(capIdx, vi, "descrizione", e.target.value)} className="inp-sm" placeholder={t("dashboard.quoteDetail.itemDescriptionPlaceholder")} aria-label={t("dashboard.quoteDetail.colDescription")} />
                                    <button type="button" onClick={() => removeVoce(capIdx, vi)} className="ic-btn danger" title={t("dashboard.quoteDetail.deleteItem")} aria-label={t("dashboard.quoteDetail.deleteItem")}><X /></button>
                                  </div>
                                  <div className="grid3">
                                    <label>{t("dashboard.quoteDetail.colUnit")}<input value={voce.um} onChange={e => updateVoce(capIdx, vi, "um", e.target.value)} className="inp-sm c" /></label>
                                    <label>{t("dashboard.quoteDetail.colQty")}<input type="number" value={voce.quantita} onChange={e => updateVoce(capIdx, vi, "quantita", e.target.value === "" ? 0 : Number(e.target.value))} className="inp-sm c" min={0} step={0.01} /></label>
                                    <label>{t("dashboard.quoteDetail.colUnitPrice")}<input type="number" value={voce.prezzoUnitario} onChange={e => updateVoce(capIdx, vi, "prezzoUnitario", e.target.value === "" ? 0 : Number(e.target.value))} className="inp-sm r" min={0} step={0.01} /></label>
                                  </div>
                                  <div className="tot"><span>{t("dashboard.quoteDetail.colTotal")}</span><b>{formatCurrency(vTot)}</b></div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="chap-desk paper-tw">
                            <table className="ptbl soft">
                              <thead>{editHeadCells(false)}</thead>
                              <tbody>
                                {cap.voci.map((voce, vi) => renderEditVoceRow(capIdx, vi, voce))}
                              </tbody>
                            </table>
                          </div>
                          {/* Chapter footer */}
                          <div className="chap-foot">
                            <button type="button" onClick={() => addVoce(capIdx)} className="text-link"><Plus /> {t("dashboard.quoteDetail.addItem")}</button>
                            <span>{t("dashboard.quoteDetail.subtotalPrefix")} {formatCurrency(capSub)}</span>
                          </div>
                        </div>
                      );
                    })}
                    {/* Add chapter */}
                    <button type="button" onClick={addCapitolo} className="add-dashed" style={{ marginTop: 12 }}><Plus /> {t("dashboard.quoteDetail.addChapter")}</button>
                  </div>
                </div>
              ) : localTemplateId === "arosio" && hasCapitoli ? (
                /* ── AROSIO VIEW: numbered sections, navy headers, subtotals ── */
                <div className="paper-sec paper-tw">
                  <table className="ptbl" style={{ minWidth: 560 }}>
                    <thead>
                      <tr>
                        <th className="c w-num">{t("dashboard.quoteDetail.colNo")}</th>
                        <th>{t("dashboard.quoteDetail.colDescription")}</th>
                        <th className="c w-um">{t("dashboard.quoteDetail.colUnit")}</th>
                        <th className="r w-price">{t("dashboard.quoteDetail.colUnitPriceShort")}</th>
                        <th className="r w-tot">{t("dashboard.quoteDetail.colTotal")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {capitoli.map((cap, ci) => (
                        <Fragment key={cap.lettera}>
                          <tr className="chap"><td colSpan={5}>{String(ci + 1).padStart(2, "0")}_ {cap.titolo.toUpperCase()}</td></tr>
                          {cap.voci.map((voce, vi) => (
                            <tr key={`${cap.lettera}-${vi}`}>
                              <td className="c faint">{ci + 1}.{vi + 1}</td>
                              <td className="desc">{renderProDesc(ci, vi, voce.descrizione)}</td>
                              <td className="c faint">{voce.um}</td>
                              <td className="r">{formatCurrency(voce.prezzoUnitario)}</td>
                              <td className="r amt">{formatCurrency(voce.totale)}</td>
                            </tr>
                          ))}
                          <tr className="sum">
                            <td colSpan={4} className="r">{String.fromCharCode(65 + ci)}{t("dashboard.quoteDetail.totalTaxExcludedSuffix")}</td>
                            <td className="r amt">{formatCurrency(cap.subtotale)}</td>
                          </tr>
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : localTemplateId === "mariagrazia" && hasCapitoli ? (
                /* ── MARIAGRAZIA VIEW: flat numbered list across all chapters ── */
                <div className="paper-sec paper-tw">
                  <table className="ptbl soft" style={{ minWidth: 600 }}>
                    <thead>
                      <tr>
                        <th className="c w-num">{t("dashboard.quoteDetail.colNo")}</th>
                        <th>{t("dashboard.quoteDetail.colDescription")}</th>
                        <th className="c w-um">{t("dashboard.quoteDetail.colUnit")}</th>
                        <th className="c w-qty">{t("dashboard.quoteDetail.colQty")}</th>
                        <th className="r w-price">{t("dashboard.quoteDetail.colUnitPriceShort")}</th>
                        <th className="r w-tot">{t("dashboard.quoteDetail.colTotal")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {capitoli.flatMap((cap, ci) => cap.voci.map((v, vi) => ({ ...v, chapter: cap.titolo, ci, vi }))).map((row, i) => (
                        <tr key={i}>
                          <td className="c faint">{i + 1}</td>
                          <td className="desc">{renderProDesc(row.ci, row.vi, row.descrizione)}</td>
                          <td className="c faint">{row.um}</td>
                          <td className="c faint">{row.quantita}</td>
                          <td className="r">{formatCurrency(row.prezzoUnitario)}</td>
                          <td className="r amt">{formatCurrency(row.totale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : hasCapitoli ? (
                /* ── STANDARD VIEW: collapsible chapters ── */
                <div className="paper-sec">
                  <span className="eyebrow">{t("dashboard.quoteDetail.detailedBreakdown")}</span>
                  <div>
                    {capitoli.map(cap => {
                      const isExpanded = expandedChapters.has(cap.lettera);
                      return (
                        <div key={cap.lettera} className="chap-block">
                          <button type="button" className="chap-head" onClick={() => toggleChapter(cap.lettera)} aria-expanded={isExpanded}>
                            <b>{cap.lettera}. {cap.titolo}</b>
                            <span className="amt">{formatCurrency(cap.subtotale)}</span>
                            {isExpanded ? <ChevronDown className="chev" /> : <ChevronRight className="chev" />}
                          </button>
                          {isExpanded && (
                            <div className="paper-tw" tabIndex={0}>
                              <table className="ptbl soft" style={{ minWidth: 480 }}>
                                <thead>
                                  <tr>
                                    <th>{t("dashboard.quoteDetail.colDescription")}</th>
                                    <th className="c w-um">{t("dashboard.quoteDetail.colUnit")}</th>
                                    <th className="c w-qty">{t("dashboard.quoteDetail.colQty")}</th>
                                    <th className="r w-price">{t("dashboard.quoteDetail.colUnitPriceShort")}</th>
                                    <th className="r w-tot">{t("dashboard.quoteDetail.colTotal")}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {cap.voci.map((voce, vi) => (
                                    <tr key={vi}>
                                      <td className="desc">{voce.descrizione}</td>
                                      <td className="c faint">{voce.um}</td>
                                      <td className="c faint">{voce.quantita}</td>
                                      <td className="r">{formatCurrency(voce.prezzoUnitario)}</td>
                                      <td className="r amt">{formatCurrency(voce.totale)}</td>
                                    </tr>
                                  ))}
                                  <tr className="sum">
                                    <td colSpan={4} className="r">{t("dashboard.quoteDetail.subtotalChapterPrefix")} {cap.lettera}</td>
                                    <td className="r amt">{formatCurrency(cap.subtotale)}</td>
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
                <div className="paper-sec paper-tw">
                  <table className="ptbl soft" style={{ minWidth: 520 }}>
                    <thead>
                      <tr>
                        <th>{t("dashboard.quoteDetail.colDescription")}</th>
                        <th className="c w-um">{t("dashboard.quoteDetail.colUnit")}</th>
                        <th className="r w-qty">{t("dashboard.quoteDetail.colQty")}</th>
                        <th className="r w-price">{t("dashboard.quoteDetail.colUnitPriceShort")}</th>
                        <th className="r w-tot">{t("dashboard.quoteDetail.colTotal")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quote.items.map((item, i) => (
                        <tr key={i}>
                          <td className="desc">{item.descrizione}</td>
                          <td className="c faint">{item.unita}</td>
                          <td className="r faint">{item.quantita}</td>
                          <td className="r">{formatCurrency(item.prezzoUnitario)}</td>
                          <td className="r amt">{formatCurrency(item.totale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Totals */}
              <div className="paper-totals">
                <div className="box">
                  {isEditMode ? (() => {
                    const editSub = editCapitoli.reduce((s, cap) => s + cap.voci.reduce((cs, v) => cs + Number(v.quantita) * Number(v.prezzoUnitario), 0), 0);
                    const editImponibile = editScontoPerc > 0 ? editSub * (1 - editScontoPerc / 100) : editSub;
                    const editIvaVal = editImponibile * (editIvaPerc / 100);
                    const editTot = editImponibile + editIvaVal;
                    return (
                      <>
                        <div className="kv"><span>{t("dashboard.quoteDetail.taxableTotal")}</span><b>{formatCurrency(editSub)}</b></div>
                        <div className="kv">
                          <span>{t("dashboard.quoteDetail.discountPercent")}</span>
                          <input type="number" value={editScontoPerc} onChange={e => setEditScontoPerc(Math.max(0, Math.min(100, Number(e.target.value))))} className="inp-sm r" min={0} max={100} step={1} aria-label={t("dashboard.quoteDetail.discountPercent")} />
                        </div>
                        {editScontoPerc > 0 && (
                          <div className="kv ok"><span>{t("dashboard.quoteDetail.taxableAfterDiscount")}</span><b>{formatCurrency(editImponibile)}</b></div>
                        )}
                        <div className="kv">
                          <span>{t("dashboard.quoteDetail.taxPercent")}</span>
                          <input type="number" value={editIvaPerc} onChange={e => setEditIvaPerc(Math.max(0, Number(e.target.value)))} className="inp-sm r" min={0} step={1} aria-label={t("dashboard.quoteDetail.taxPercent")} />
                        </div>
                        <div className="kv"><span>{t("dashboard.quoteDetail.taxLabel")}</span><b>{formatCurrency(editIvaVal)}</b></div>
                        <div className="kv grand"><span>{t("dashboard.quoteDetail.total")}</span><b>{formatCurrency(editTot)}</b></div>
                      </>
                    );
                  })() : (
                    <>
                      <div className="kv"><span>{t("dashboard.quoteDetail.taxableTotal")}</span><b>{formatCurrency(quote.subtotale)}</b></div>
                      {sconto && sconto.percentuale > 0 && (
                        <>
                          <div className="kv ok"><span>{t("dashboard.quoteDetail.discountLabelPrefix")} ({sconto.percentuale}%):</span><b>−{formatCurrency(quote.subtotale - sconto.importoScontato)}</b></div>
                          <div className="kv"><span>{t("dashboard.quoteDetail.taxableAfterDiscount")}</span><b>{formatCurrency(sconto.importoScontato)}</b></div>
                        </>
                      )}
                      {(quote.taxLines ?? []).length === 0 ? (
                        <div className="kv"><span>{t("dashboard.quoteDetail.taxLabelPrefix")} ({quote.ivaPercentuale}%):</span><b>{formatCurrency(quote.ivaValore)}</b></div>
                      ) : quote.taxLines!.map((line) => (
                        <div className="kv" key={line.code}><span>{taxLineLabel(line, lang, t("dashboard.quoteDetail.taxLabelPrefix"))}:</span><b>{formatCurrency(line.amount)}</b></div>
                      ))}
                      <div className="kv grand"><span>{t("dashboard.quoteDetail.total")}</span><b>{formatCurrency(quote.totale)}</b></div>
                    </>
                  )}
                </div>
              </div>

              {/* Condizioni di pagamento */}
              {isEditMode ? (
                <div className="paper-sec">
                  <span className="eyebrow row">
                    {t("dashboard.quoteDetail.paymentTerms")}
                    <button type="button" onClick={() => setEditCondizioniPagamento(prev => [...prev, ""])} className="text-link"><Plus /> {t("dashboard.quoteDetail.add")}</button>
                  </span>
                  <div className="paper-box">
                    {editCondizioniPagamento.map((cond, i) => (
                      <div key={i} className="term-row">
                        <input value={cond} onChange={e => setEditCondizioniPagamento(prev => prev.map((c, ci) => ci === i ? e.target.value : c))} placeholder={t("dashboard.quoteDetail.paymentTermPlaceholder")} className="inp-sm" aria-label={t("dashboard.quoteDetail.paymentTermPlaceholder")} />
                        <button type="button" onClick={() => setEditCondizioniPagamento(prev => prev.filter((_, ci) => ci !== i))} className="ic-btn danger" aria-label={t("dashboard.quoteDetail.deleteItem")}><X /></button>
                      </div>
                    ))}
                    {editCondizioniPagamento.length === 0 && (
                      <p className="hint">{t("dashboard.quoteDetail.noConditionsHint")}</p>
                    )}
                  </div>
                </div>
              ) : condizioniPagamento.length > 0 ? (
                <div className="paper-sec">
                  <span className="eyebrow">{t("dashboard.quoteDetail.paymentTerms")}</span>
                  <div className="paper-box">
                    <ul>
                      {condizioniPagamento.map((cond, i) => (
                        <li key={i}><CheckCircle2 /><span>{cond}</span></li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}

              {/* Descrizione Generale / Oggetto */}
              {isEditMode ? (
                <div className="paper-foot">
                  <span className="eyebrow">{t("dashboard.quoteDetail.generalDescriptionLabel")}</span>
                  <textarea value={editDescrizioneGenerale} onChange={e => setEditDescrizioneGenerale(e.target.value)} className="inp-sm" placeholder={t("dashboard.quoteDetail.generalDescriptionPlaceholder")} aria-label={t("dashboard.quoteDetail.generalDescriptionLabel")} />
                </div>
              ) : (
                quote.descrizioneGenerale && (
                  <div className="paper-foot" style={{ fontStyle: "italic" }}>
                    <b>{t("dashboard.quoteDetail.subjectPrefix")}</b>{quote.descrizioneGenerale}
                  </div>
                )
              )}

              {/* Notes */}
              {isEditMode ? (
                <div className="paper-foot">
                  <span className="eyebrow">{t("dashboard.quoteDetail.finalNotesLabel")}</span>
                  <textarea value={editNote} onChange={e => setEditNote(e.target.value)} className="inp-sm" placeholder={t("dashboard.quoteDetail.finalNotesPlaceholder")} aria-label={t("dashboard.quoteDetail.finalNotesLabel")} />
                </div>
              ) : (
                quote.note && (
                  <div className="paper-foot">
                    <b>{t("dashboard.quoteDetail.notePrefix")}</b>{quote.note}
                  </div>
                )
              )}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="stack">
          <section className="card">
            <div className="card-head"><div><h2>{t("dashboard.quoteDetail.actionsTitle")}</h2></div></div>
            <div className="act-list">
              <button type="button" onClick={isLocked ? handleUnlock : handleDownload} disabled={generatePdf.isPending} className={cn("btn btn-sm", isLocked ? "btn-navy" : "btn-outline-navy")}>
                {generatePdf.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : isLocked ? <Lock className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                {t("dashboard.quoteDetail.downloadPdf")}
              </button>
              {!isLocked && can("quotes", "edit") && (
                <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setIsEmailDialogOpen(true)} disabled={sendPdfEmail.isPending}>
                  {sendPdfEmail.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  {t("dashboard.quoteDetail.sendByEmail")}
                </button>
              )}
              {!isEditLocked && (
                <>
                  <button type="button" className="btn btn-sm btn-outline-navy" onClick={isEditMode ? () => setIsEditMode(false) : enterEditMode}>
                    <Pencil className="h-4 w-4" />
                    {isEditMode ? t("dashboard.quoteDetail.closeEditor") : t("dashboard.quoteDetail.editQuote")}
                  </button>
                  <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setIsRegenOpen(true)}>
                    <Sparkles className="h-4 w-4" />
                    {t("dashboard.quoteDetail.regenerateWithAi")}
                  </button>
                </>
              )}
              {can("quotes", "edit") && <button
                type="button"
                className="btn btn-sm btn-outline-navy"
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
              </button>}
              {isEditLocked && can("quotes", "edit") && (
                <div className="notice warn">
                  <AlertTriangle />
                  <span className="grow">{t(quote.status === "accepted" ? "dashboard.quoteDetail.acceptedWarning" : "dashboard.quoteDetail.downloadedWarning")}</span>
                </div>
              )}
            </div>
          </section>

          {/* Phase 79: catalog / receipt prices that moved since this quote was priced */}
          {!isEditLocked && !!id && <PriceCheckCard quoteId={id} enabled={hasCapitoli} />}

          {/* Phase 22: Good/Better/Best tiered quotes */}
          {!isEditLocked && quote?.status !== "accepted" && (
            <section className="card">
              <div className="card-head">
                <div>
                  <h2 className="flex items-center gap-2"><Star className="h-4 w-4" style={{ color: "var(--faint)" }} /> {t("dashboard.quoteDetail.variants.title")}</h2>
                  <p className="sub">{t("dashboard.quoteDetail.variants.subtitle")}</p>
                </div>
              </div>
              <div className="act-body">
                {variants.map((v) => (
                  <div key={v.id} className="var-block">
                    <div className="row">
                      <input
                        defaultValue={v.label}
                        placeholder={t("dashboard.quoteDetail.variants.labelPlaceholder")}
                        className="inp-sm"
                        aria-label={t("dashboard.quoteDetail.variants.labelPlaceholder")}
                        onBlur={(e) => {
                          if (e.target.value === v.label) return;
                          updateVariant.mutate({ id: id!, variantId: v.id, data: { label: e.target.value } }, {
                            onSuccess: () => queryClient.invalidateQueries({ queryKey: getListQuoteVariantsQueryKey(id!) }),
                          });
                        }}
                      />
                      <button
                        type="button"
                        className="ic-btn danger"
                        disabled={deleteVariant.isPending}
                        aria-label={t("dashboard.quoteDetail.deleteItem")}
                        onClick={() => {
                          deleteVariant.mutate({ id: id!, variantId: v.id }, {
                            onSuccess: () => queryClient.invalidateQueries({ queryKey: getListQuoteVariantsQueryKey(id!) }),
                            onError: () => toast({ title: t("dashboard.quoteDetail.variants.errorDelete"), variant: "destructive" }),
                          });
                        }}
                      >
                        <Trash2 />
                      </button>
                    </div>
                    <textarea
                      defaultValue={v.description}
                      placeholder={t("dashboard.quoteDetail.variants.descriptionPlaceholder")}
                      rows={2}
                      className="inp-sm"
                      style={{ minHeight: 0 }}
                      aria-label={t("dashboard.quoteDetail.variants.descriptionPlaceholder")}
                      onBlur={(e) => {
                        if (e.target.value === v.description) return;
                        updateVariant.mutate({ id: id!, variantId: v.id, data: { description: e.target.value } }, {
                          onSuccess: () => queryClient.invalidateQueries({ queryKey: getListQuoteVariantsQueryKey(id!) }),
                        });
                      }}
                    />
                    <div className="row">
                      <span>{t("dashboard.quoteDetail.variants.totalLabel")}</span>
                      <input
                        type="number"
                        step="0.01"
                        defaultValue={v.totale}
                        className="inp-sm r"
                        aria-label={t("dashboard.quoteDetail.variants.totalLabel")}
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
                <button
                  type="button"
                  className="add-dashed"
                  style={{ marginTop: variants.length ? 10 : 0 }}
                  disabled={createVariant.isPending || variants.length >= 3}
                  onClick={() => {
                    if (!id) return;
                    createVariant.mutate({ id, data: {} }, {
                      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListQuoteVariantsQueryKey(id) }),
                      onError: () => toast({ title: t("dashboard.quoteDetail.variants.errorCreate"), variant: "destructive" }),
                    });
                  }}
                >
                  <Plus />
                  {variants.length >= 3 ? t("dashboard.quoteDetail.variants.maxReached") : t("dashboard.quoteDetail.variants.addOption")}
                </button>
              </div>
            </section>
          )}

          {/* Template picker */}
          <section className="card">
            <div className="card-head">
              <div>
                <h2 className="flex items-center gap-2"><LayoutTemplate className="h-4 w-4" style={{ color: "var(--faint)" }} /> {t("dashboard.quoteDetail.pdfTemplateTitle")}</h2>
                <p className="sub">{isEditLocked ? t(quote.status === "accepted" ? "dashboard.quoteDetail.acceptedWarning" : "dashboard.quoteDetail.lockedAfterDownload") : t("dashboard.quoteDetail.chooseYourPdfLayout")}</p>
              </div>
            </div>
            <div className="src-list">
              {templateChoices.map(tmpl => {
                const isActive = localTemplateId === tmpl.id;
                const requiresPro = tmpl.proOnly && !isPro;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    disabled={isEditLocked}
                    onClick={() => {
                      if (isEditLocked) return;
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
                    className={cn("src sm", isActive && "on")}
                  >
                    <b>
                      {isActive && <CheckCircle2 />}
                      {tmpl.label}
                      {requiresPro && <span className="chip chip-yellow">PRO</span>}
                      {isEditLocked && <Lock className="h-3.5 w-3.5 ml-auto" style={{ color: "var(--faint)" }} />}
                    </b>
                    <p>{tmpl.desc}</p>
                  </button>
                );
              })}
            </div>
            {isEditLocked && (
              <div className="card-foot"><span className="foot-note" style={{ color: "var(--yellow-dark)" }}>{t("dashboard.quoteDetail.templateLockedAfterDownload")}</span></div>
            )}
          </section>

          {/* Contract (Phase 1) */}
          <QuoteContractCard quoteId={quote.id} quoteStatus={quote.status} hasContractsFeature={hasFeature(profile as never, "contracts")} />

          {/* Payment schedule (Phase 0: drives contract terms + invoicing) */}
          <PaymentScheduleCard
            quoteId={quote.id}
            schedule={(quote as unknown as { paymentSchedule?: PaymentSchedule | null }).paymentSchedule ?? null}
            total={quote.totale}
            // PATCH /quotes/:id is quotes:edit — Phase 83: "Edit schedule" was
            // offered to a foreman, who could only get a 403 out of Save.
            locked={isEditMode || !can("quotes", "edit")}
          />

          {/* Summary card */}
          {hasCapitoli && (
            <section className="card">
              <div className="card-head"><div><h2>{t("dashboard.quoteDetail.chapterSummary")}</h2></div></div>
              <div className="kv-list">
                {capitoli.map(cap => (
                  <div key={cap.lettera} className="kv"><span className="truncate">{cap.lettera}. {cap.titolo}</span><b>{formatCurrency(cap.subtotale)}</b></div>
                ))}
                <div className="kv total"><span>{t("dashboard.quoteDetail.total")}</span><b>{formatCurrency(quote.totale)}</b></div>
              </div>
            </section>
          )}

          <section className="card">
            <div className="card-head"><div><h2 className="flex items-center gap-2"><FileText className="h-4 w-4" style={{ color: "var(--faint)" }} /> {t("dashboard.quoteDetail.originalInput")}</h2></div></div>
            <div className="act-body">
              <p className="foot-note" style={{ fontStyle: "italic", fontWeight: 500 }}>"{quote.rawInput}"</p>
            </div>
          </section>
        </div>
      </div>

      {/* ── CAPITOLATO PRO DIALOG ── */}
      <Dialog open={isCapitolatoDialogOpen} onOpenChange={setIsCapitolatoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle><Star /> {t("dashboard.quoteDetail.upgradeProSpecTitle")}</DialogTitle>
            <DialogDescription>{t("dashboard.quoteDetail.upgradeProSpecDesc")}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="notice info" style={{ display: "block" }}>
              <p>{t("dashboard.quoteDetail.whatWillUpdate")}</p>
              <ul style={{ listStyle: "disc", paddingLeft: 18, marginTop: 6, fontWeight: 600, color: "var(--muted-mk)" }}>
                <li>{t("dashboard.quoteDetail.updateItem1")}</li>
                <li>{t("dashboard.quoteDetail.updateItem2")}</li>
                <li>{t("dashboard.quoteDetail.updateItem3")}</li>
              </ul>
            </div>
          </DialogBody>
          <DialogFooter>
            <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setIsCapitolatoDialogOpen(false)} disabled={upgradeToCapitolato.isPending}>{t("dashboard.quoteDetail.cancel")}</button>
            <button type="button" className="btn btn-sm btn-navy" onClick={handleConfirmCapitolatoUpgrade} disabled={upgradeToCapitolato.isPending}>
              {upgradeToCapitolato.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
              {upgradeToCapitolato.isPending ? t("dashboard.quoteDetail.upgradingInProgress") : t("dashboard.quoteDetail.upgradeNow")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AI REGEN DIALOG ── */}
      <Dialog open={isRegenOpen} onOpenChange={setIsRegenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle><Sparkles /> {t("dashboard.quoteDetail.regenerateWithAiTitle")}</DialogTitle>
            <DialogDescription>{t("dashboard.quoteDetail.regenerateWithAiDesc")}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="quote-box">"{quote.rawInput}"</div>
            <div className="field">
              <label>{t("dashboard.quoteDetail.newInstructions")}</label>
              <textarea
                value={regenDescription}
                onChange={e => setRegenDescription(e.target.value)}
                placeholder={t("dashboard.quoteDetail.regenerateExamplePlaceholder")}
                rows={4}
                style={{ resize: "none" }}
                disabled={regenerateQuote.isPending}
              />
              <div className="field-hint">{t("dashboard.quoteDetail.regenerateHint")}</div>
            </div>
          </DialogBody>
          <DialogFooter>
            <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => { setIsRegenOpen(false); setRegenDescription(""); }} disabled={regenerateQuote.isPending}>{t("dashboard.quoteDetail.cancel")}</button>
            <button type="button" className="btn btn-sm btn-navy" onClick={handleRegenerate} disabled={regenerateQuote.isPending}>
              {regenerateQuote.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> {t("dashboard.quoteDetail.generatingInProgress")}</>
              ) : (
                <><RefreshCw className="h-4 w-4" /> {t("dashboard.quoteDetail.regenerate")}</>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Paywall dialog */}
      <Dialog open={isPaywallOpen} onOpenChange={setIsPaywallOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            {subscription?.isActive && subscription?.plan === "monthly_starter" ? (
              <>
                <DialogTitle>{t("dashboard.quoteDetail.upgradeToProPlanTitle")}</DialogTitle>
                <DialogDescription>
                  {t("dashboard.quoteDetail.starterNoticePrefix")} <strong>Starter</strong> {t("dashboard.quoteDetail.starterNoticeMiddle")}<br/>
                  {t("dashboard.quoteDetail.starterNoticeSuffix")} <strong>Pro</strong> {t("dashboard.quoteDetail.starterNoticeEnd")}
                </DialogDescription>
              </>
            ) : (
              <>
                <DialogTitle>{t("dashboard.quoteDetail.unlockQuoteTitle")}</DialogTitle>
                <DialogDescription>{t("dashboard.quoteDetail.choosePlanToDownload")}</DialogDescription>
              </>
            )}
          </DialogHeader>

          <DialogBody>
            {/* If user is on Starter → show upgrade options */}
            {subscription?.isActive && subscription?.plan === "monthly_starter" ? (
              <>
                <div className="plan-grid two" style={{ paddingTop: 10 }}>
                  {[
                    { id: "monthly_pro", label: "Pro", price: "$49", badge: t("dashboard.quoteDetail.mostPopular"), features: [t("dashboard.quoteDetail.feature60Quotes"), t("dashboard.quoteDetail.featureNoWatermark"), t("dashboard.quoteDetail.featureAllTemplates"), t("dashboard.quoteDetail.featurePhotoUpload")], highlight: true },
                    { id: "monthly_elite", label: "Elite", price: "$59", badge: t("dashboard.quoteDetail.unlimited"), features: [t("dashboard.quoteDetail.featureUnlimitedQuotes"), t("dashboard.quoteDetail.featureNoWatermark"), t("dashboard.quoteDetail.featureAllTemplates"), t("dashboard.quoteDetail.featureDedicatedSupport")], highlight: false },
                  ].map((opt) => (
                    <div key={opt.id} className={cn("plan-opt", opt.highlight && "hot")}>
                      <span className={cn("tag", !opt.highlight && "gold")}>{opt.badge}</span>
                      <span className="nm">{opt.label}</span>
                      <span className="pr">{opt.price}<small>{t("dashboard.quoteDetail.perMonth")}</small></span>
                      <ul>
                        {opt.features.map((f, i) => <li key={i}><CheckCircle2 /> {f}</li>)}
                      </ul>
                      <button type="button" className={cn("btn btn-sm", opt.highlight ? "btn-navy" : "btn-outline-navy")} onClick={handleUpgrade} disabled={createPortal.isPending}>
                        {createPortal.isPending ? "..." : `${t("dashboard.quoteDetail.switchToPrefix")} ${opt.label} →`}
                      </button>
                    </div>
                  ))}
                </div>
                <p className="foot-note" style={{ textAlign: "center" }}>{t("dashboard.quoteDetail.managedByStripe")}</p>

                <div className="or-rule">{t("dashboard.quoteDetail.orSinglePurchase")}</div>

                <div className="plan-grid two">
                  {(Array.isArray(plans) ? plans : []).filter(p => !p.interval).map((plan) => {
                    const isClean = plan.id === "oneshot_clean";
                    return (
                      <div key={plan.id} className={cn("plan-opt flat", isClean && "hot")}>
                        <div className="txt"><span className="nm">{plan.name}</span><span className="ds">{plan.features[0]}</span></div>
                        <span className="pr">${plan.price}</span>
                        <button type="button" className={cn("btn btn-sm", isClean ? "btn-navy" : "btn-outline-navy")} onClick={() => handleCheckout(plan.id)} disabled={createCheckout.isPending}>
                          {createCheckout.isPending ? "..." : t("dashboard.quoteDetail.buy")}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                {/* Subscription plans — 3 columns */}
                <div className="plan-grid" style={{ paddingTop: 10 }}>
                  {plans?.filter(p => p.interval).map((plan) => {
                    const isPro = plan.id === "monthly_pro";
                    const isElite = plan.id === "monthly_elite";
                    return (
                      <div key={plan.id} className={cn("plan-opt plan-card-enter", isPro && "hot")}>
                        {isPro && <span className="tag">{t("dashboard.quoteDetail.popBadge")}</span>}
                        {isElite && <span className="tag gold">{t("dashboard.quoteDetail.infinityBadge")}</span>}
                        <span className="nm">{plan.name}</span>
                        <span className="pr">${plan.price}<small>{t("dashboard.quoteDetail.perMonth")}</small></span>
                        <ul>
                          {plan.features.slice(0, 3).map((feature, i) => <li key={i}><CheckCircle2 /> {feature}</li>)}
                        </ul>
                        <button type="button" className={cn("btn btn-sm", isPro || isElite ? "btn-navy" : "btn-outline-navy")} onClick={() => handleCheckout(plan.id)} disabled={createCheckout.isPending}>
                          {createCheckout.isPending ? "..." : `${t("dashboard.quoteDetail.choosePrefix")} ${plan.name}`}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="or-rule">{t("dashboard.quoteDetail.orSinglePurchase")}</div>

                <div className="plan-grid two">
                  {plans?.filter(p => !p.interval).map((plan) => {
                    const isClean = plan.id === "oneshot_clean";
                    return (
                      <div key={plan.id} className={cn("plan-opt flat plan-card-enter", isClean && "hot")}>
                        <div className="txt"><span className="nm">{plan.name}</span><span className="ds">{plan.features[0]}</span></div>
                        <span className="pr">${plan.price}</span>
                        <button type="button" className={cn("btn btn-sm", isClean ? "btn-navy" : "btn-outline-navy")} onClick={() => handleCheckout(plan.id)} disabled={createCheckout.isPending}>
                          {createCheckout.isPending ? "..." : t("dashboard.quoteDetail.buy")}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Email send dialog */}
      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t("dashboard.quoteDetail.sendQuoteByEmailTitle")}</DialogTitle>
            <DialogDescription>{t("dashboard.quoteDetail.sendQuoteByEmailDesc")}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="field">
              <label htmlFor="emailTo">{t("dashboard.quoteDetail.recipientEmailLabel")}</label>
              <input
                id="emailTo"
                type="email"
                placeholder="client@example.com"
                value={emailTo}
                onChange={e => setEmailTo(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSendEmail(); }}
              />
              {quote?.clientData && (
                <div className="field-hint">
                  {t("dashboard.quoteDetail.recipientPrefix")} <b style={{ color: "var(--navy)" }}>{(quote.clientData as { nome?: string })?.nome || t("dashboard.quoteDetail.clientFallback")}</b>
                </div>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setIsEmailDialogOpen(false)}>{t("dashboard.quoteDetail.cancel")}</button>
            <button type="button" className="btn btn-sm btn-navy" onClick={handleSendEmail} disabled={!emailTo.trim().includes("@") || sendPdfEmail.isPending}>
              {sendPdfEmail.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {t("dashboard.quoteDetail.send")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
