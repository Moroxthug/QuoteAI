import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import {
  ArrowLeft, FileSignature, Send, Download, Ban, Pencil, Save, X, Loader2, CheckCircle2, Clock, AlertTriangle, Lock, Sparkles, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { contractsApi, type ContractDto } from "@/lib/contracts-api";
import { SignaturePad, type SignatureValue } from "@/components/signature-pad";

const formatCad = (n: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);

export const STATUS_STYLES: Record<ContractDto["status"], string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-blue-100 text-blue-700",
  viewed: "bg-indigo-100 text-indigo-700",
  signed: "bg-emerald-100 text-emerald-700",
  declined: "bg-red-100 text-red-700",
  voided: "bg-slate-200 text-slate-500",
  expired: "bg-amber-100 text-amber-700",
};

export function ContractStatusBadge({ status }: { status: ContractDto["status"] }) {
  const { t } = useLanguage();
  return <Badge className={cn("font-medium border-0", STATUS_STYLES[status])}>{t(`contracts.status.${status}`)}</Badge>;
}

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const locale = lang === "fr" ? frCA : enCA;

  const { data, isLoading, error } = useQuery({ queryKey: ["contract", id], queryFn: () => contractsApi.get(id!), enabled: !!id });
  const contract = data?.contract;

  const [editing, setEditing] = useState(false);
  const [sectionDrafts, setSectionDrafts] = useState<Record<string, string>>({});
  const [vars, setVars] = useState<{ startDate: string; estimatedDurationWeeks: string; warrantyMonths: string; directAgreement: boolean; englishRequestedInQuebec: boolean; holdbackEnabled: boolean; holdbackPercent: string; customerEmail: string; customerName: string } | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [signature, setSignature] = useState<SignatureValue>(null);
  const [signName, setSignName] = useState("");
  const [consent, setConsent] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendMessage, setSendMessage] = useState("");
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");

  useEffect(() => {
    if (!contract) return;
    setVars({
      startDate: contract.variables.startDate ?? "",
      estimatedDurationWeeks: contract.variables.estimatedDurationWeeks?.toString() ?? "",
      warrantyMonths: String(contract.variables.warrantyMonths ?? 12),
      directAgreement: contract.variables.directAgreement,
      englishRequestedInQuebec: contract.variables.englishRequestedInQuebec,
      holdbackEnabled: contract.variables.paymentSchedule.holdback.enabled,
      holdbackPercent: String(contract.variables.paymentSchedule.holdback.percent),
      customerEmail: contract.variables.customer.email ?? "",
      customerName: contract.variables.customer.name ?? "",
    });
    setSectionDrafts(Object.fromEntries(contract.document.sections.filter((s) => s.editable).map((s) => [s.key, s.body])));
    setSignName(contract.variables.contractor.name);
  }, [contract]);

  const refresh = (next: { contract: ContractDto; html?: string }) => {
    queryClient.setQueryData(["contract", id], (prev: typeof data) => (prev ? { ...prev, contract: next.contract, html: next.html ?? prev.html } : prev));
    queryClient.invalidateQueries({ queryKey: ["contracts"] });
    if (!next.html) queryClient.invalidateQueries({ queryKey: ["contract", id] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!contract || !vars) throw new Error("no contract");
      const sections = contract.document.sections.filter((s) => s.editable && sectionDrafts[s.key] !== undefined && sectionDrafts[s.key] !== s.body).map((s) => ({ key: s.key, body: sectionDrafts[s.key] }));
      return contractsApi.update(contract.id, {
        sections,
        variables: {
          startDate: vars.startDate || null,
          estimatedDurationWeeks: vars.estimatedDurationWeeks ? Number(vars.estimatedDurationWeeks) : null,
          warrantyMonths: Number(vars.warrantyMonths) || 0,
          directAgreement: vars.directAgreement,
          englishRequestedInQuebec: vars.englishRequestedInQuebec,
          holdbackEnabled: vars.holdbackEnabled,
          holdbackPercent: Number(vars.holdbackPercent) || 0,
          ...(vars.customerEmail ? { customerEmail: vars.customerEmail } : {}),
          ...(vars.customerName ? { customerName: vars.customerName } : {}),
        },
      });
    },
    onSuccess: (res) => {
      refresh(res);
      setEditing(false);
      toast({ title: t("contracts.saved") });
    },
    onError: (e: Error) => toast({ title: t("contracts.saveError"), description: e.message, variant: "destructive" }),
  });

  const sign = useMutation({
    mutationFn: async () => {
      if (!contract || !signature) throw new Error("no signature");
      return contractsApi.sign(contract.id, { signatureType: signature.type, signatureData: signature.data, name: signName.trim(), consent: true });
    },
    onSuccess: async (res) => {
      const full = await contractsApi.get(res.contract.id);
      queryClient.setQueryData(["contract", id], full);
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setSignOpen(false);
      setSignature(null);
      setConsent(false);
      toast({ title: t("contracts.signedToast") });
    },
    onError: (e: Error) => toast({ title: t("contracts.signError"), description: e.message, variant: "destructive" }),
  });

  const send = useMutation({
    mutationFn: async () => contractsApi.send(contract!.id, { message: sendMessage.trim() || undefined }),
    onSuccess: (res) => {
      refresh(res);
      setSendOpen(false);
      setSendMessage("");
      toast({ title: t("contracts.sentToast"), description: t("contracts.sentToastDesc").replace("{email}", res.contract.variables.customer.email ?? "") });
    },
    onError: (e: Error & { code?: string }) => toast({ title: e.code === "SIGN_FIRST" ? t("contracts.signFirst") : e.code === "CUSTOMER_EMAIL_MISSING" ? t("contracts.emailMissing") : t("contracts.sendError"), description: e.message, variant: "destructive" }),
  });

  const voidContract = useMutation({
    mutationFn: async () => contractsApi.void(contract!.id, voidReason.trim() || undefined),
    onSuccess: (res) => {
      refresh(res);
      setVoidOpen(false);
      toast({ title: t("contracts.voidedToast") });
    },
    onError: (e: Error) => toast({ title: t("contracts.voidError"), description: e.message, variant: "destructive" }),
  });

  const contractorSigner = contract?.signers.find((s) => s.role === "contractor");
  const customerSigner = contract?.signers.find((s) => s.role === "customer");
  const isDraft = contract?.status === "draft";
  const isOpen = contract && ["draft", "sent", "viewed"].includes(contract.status);
  const canSend = isOpen && contractorSigner?.status === "signed";

  const steps = useMemo(() => {
    if (!contract) return [];
    return [
      { key: "review", label: t("contracts.step.review"), done: contract.status !== "draft" || contractorSigner?.status === "signed" },
      { key: "sign", label: t("contracts.step.sign"), done: contractorSigner?.status === "signed" },
      { key: "send", label: t("contracts.step.send"), done: !!contract.sentAt },
      { key: "customer", label: t("contracts.step.customer"), done: customerSigner?.status === "signed" },
    ];
  }, [contract, contractorSigner, customerSigner, t]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full rounded-xl" />
      </div>
    );
  }
  if (error || !contract || !vars) {
    return (
      <div className="rounded-2xl border bg-card p-12 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
        <p className="text-slate-700 font-medium">{t("contracts.notFound")}</p>
        <Link href="/dashboard/contracts" className="text-violet-600 text-sm mt-2 inline-block">{t("contracts.backToList")}</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={contract.kind === "change_order" && contract.projectId ? `/dashboard/jobs/${contract.projectId}?tab=changes` : "/dashboard/contracts"} className="text-sm text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 mb-2">
            <ArrowLeft className="h-3.5 w-3.5" /> {contract.kind === "change_order" ? t("contracts.backToJob") : t("contracts.backToList")}
          </Link>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            <FileSignature className="h-7 w-7 text-violet-600" />
            {contract.contractNumber}
            <ContractStatusBadge status={contract.status} />
            {contract.kind === "change_order" && <Badge className="font-medium border-0 bg-amber-100 text-amber-800">{t("contracts.changeOrder")}</Badge>}
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            {contract.variables.customer.name} · {contract.variables.projectTitle} · <strong className="text-slate-700">{formatCad(contract.variables.total)}</strong>
            {contract.quoteId && <> · <Link href={`/dashboard/quotes/${contract.quoteId}`} className="text-violet-600 hover:underline">{t("contracts.viewQuote")} {contract.variables.quoteNumber}</Link></>}
            {contract.projectId && <> · <Link href={`/dashboard/jobs/${contract.projectId}`} className="text-violet-600 hover:underline">{t("contracts.openJob")}</Link></>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={contractsApi.pdfUrl(contract.id, true)} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5"><Download className="h-4 w-4" /> {contract.hasSignedPdf ? t("contracts.downloadSigned") : t("contracts.downloadPdf")}</Button>
          </a>
          {isOpen && !editing && (
            <Button variant="outline" size="sm" className="gap-1.5 text-red-600 hover:text-red-700" onClick={() => setVoidOpen(true)}><Ban className="h-4 w-4" /> {t("contracts.void")}</Button>
          )}
        </div>
      </div>

      {/* Progress */}
      {isOpen && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {steps.map((s, i) => (
            <div key={s.key} className={cn("rounded-xl border px-3 py-2.5 flex items-center gap-2 text-sm", s.done ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-card border-slate-200 text-slate-500")}>
              {s.done ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> : <span className="h-5 w-5 rounded-full border border-slate-300 text-[11px] flex items-center justify-center shrink-0">{i + 1}</span>}
              {s.label}
            </div>
          ))}
        </div>
      )}

      {contract.status === "declined" && customerSigner?.declineReason && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>{t("contracts.declinedReason")}:</strong> {customerSigner.declineReason}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Document */}
        <div className="lg:col-span-2 space-y-4">
          {isDraft && (
            <div className="flex items-center justify-between rounded-xl border border-violet-200 dark:border-violet-800/40 bg-violet-50 dark:bg-violet-500/15 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-violet-900 dark:text-violet-300">
                <Sparkles className="h-4 w-4 text-violet-600" />
                {t("contracts.draftHint")}
              </div>
              {editing ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={save.isPending}><X className="h-4 w-4 mr-1" /> {t("contracts.cancel")}</Button>
                  <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} {t("contracts.save")}</Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4 mr-1" /> {t("contracts.edit")}</Button>
              )}
            </div>
          )}

          {editing ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("contracts.editTitle")}</CardTitle>
                <CardDescription>{t("contracts.editDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t("contracts.field.customerName")}</Label>
                    <Input value={vars.customerName} onChange={(e) => setVars({ ...vars, customerName: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("contracts.field.customerEmail")}</Label>
                    <Input type="email" value={vars.customerEmail} onChange={(e) => setVars({ ...vars, customerEmail: e.target.value })} placeholder="client@email.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("contracts.field.startDate")}</Label>
                    <Input type="date" value={vars.startDate} onChange={(e) => setVars({ ...vars, startDate: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("contracts.field.duration")}</Label>
                    <Input type="number" min={1} value={vars.estimatedDurationWeeks} onChange={(e) => setVars({ ...vars, estimatedDurationWeeks: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("contracts.field.warranty")}</Label>
                    <Input type="number" min={0} value={vars.warrantyMonths} onChange={(e) => setVars({ ...vars, warrantyMonths: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("contracts.field.holdback")}</Label>
                    <div className="flex items-center gap-3 h-10">
                      <Switch checked={vars.holdbackEnabled} onCheckedChange={(v) => setVars({ ...vars, holdbackEnabled: v })} />
                      {vars.holdbackEnabled && <Input type="number" min={0} max={50} className="w-20" value={vars.holdbackPercent} onChange={(e) => setVars({ ...vars, holdbackPercent: e.target.value })} />}
                      {vars.holdbackEnabled && <span className="text-sm text-slate-500">%</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-start justify-between rounded-lg border px-4 py-3 gap-4">
                  <div>
                    <div className="text-sm font-medium">{t("contracts.field.directAgreement")}</div>
                    <div className="text-xs text-slate-500">{t("contracts.field.directAgreementHint")}</div>
                  </div>
                  <Switch checked={vars.directAgreement} onCheckedChange={(v) => setVars({ ...vars, directAgreement: v })} />
                </div>
                {contract.province === "QC" && contract.language === "en" && (
                  <div className="flex items-start justify-between rounded-lg border px-4 py-3 gap-4">
                    <div>
                      <div className="text-sm font-medium">{t("contracts.field.englishQc")}</div>
                      <div className="text-xs text-slate-500">{t("contracts.field.englishQcHint")}</div>
                    </div>
                    <Switch checked={vars.englishRequestedInQuebec} onCheckedChange={(v) => setVars({ ...vars, englishRequestedInQuebec: v })} />
                  </div>
                )}

                {contract.document.sections.filter((s) => s.editable).map((s) => (
                  <div key={s.key} className="space-y-1.5">
                    <Label className="flex items-center gap-2">{s.heading} <Badge variant="secondary" className="text-[10px] gap-1"><Sparkles className="h-3 w-3" /> {t("contracts.aiDrafted")}</Badge></Label>
                    <Textarea value={sectionDrafts[s.key] ?? ""} onChange={(e) => setSectionDrafts({ ...sectionDrafts, [s.key]: e.target.value })} rows={s.key === "scope" ? 14 : 5} className="font-mono text-xs leading-relaxed" />
                    <p className="text-[11px] text-slate-400">{t("contracts.markdownHint")}</p>
                  </div>
                ))}

                <div className="rounded-lg bg-slate-50 border px-4 py-3 text-xs text-slate-500 flex items-start gap-2">
                  <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {t("contracts.lockedHint")}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <CardContent className="p-6 md:p-10">
                <style dangerouslySetInnerHTML={{ __html: data!.css }} />
                <div dangerouslySetInnerHTML={{ __html: data!.html }} />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("contracts.nextStep")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {contract.status === "signed" ? (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-3 text-sm text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>{t("contracts.executed").replace("{date}", contract.signedAt ? format(new Date(contract.signedAt), "PPP", { locale }) : "")}</div>
                </div>
              ) : !isOpen ? (
                <p className="text-sm text-slate-500">{t("contracts.closedHint")}</p>
              ) : contractorSigner?.status !== "signed" ? (
                <Button className="w-full gap-2" onClick={() => setSignOpen(true)} disabled={editing}><FileSignature className="h-4 w-4" /> {t("contracts.signAsCompany")}</Button>
              ) : !contract.sentAt ? (
                <Button className="w-full gap-2" onClick={() => setSendOpen(true)} disabled={!canSend || editing}><Send className="h-4 w-4" /> {t("contracts.sendToCustomer")}</Button>
              ) : (
                <>
                  <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-3 text-sm text-blue-800 flex items-start gap-2">
                    <Clock className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>{t("contracts.waitingCustomer").replace("{email}", customerSigner?.email ?? "")}{contract.expiresAt && <div className="text-xs mt-1 text-blue-600">{t("contracts.expires")} {format(new Date(contract.expiresAt), "PPP", { locale })}</div>}</div>
                  </div>
                  <Button variant="outline" className="w-full gap-2" onClick={() => setSendOpen(true)}><RefreshCw className="h-4 w-4" /> {t("contracts.resend")}</Button>
                </>
              )}
              {isDraft && contractorSigner?.status === "signed" && (
                <p className="text-xs text-slate-500 text-center">{t("contracts.editInvalidates")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">{t("contracts.signers")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {contract.signers.map((s) => (
                <div key={s.id} className="flex items-start justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 truncate">{s.name || "—"}</div>
                    <div className="text-xs text-slate-500 truncate">{t(`contracts.role.${s.role}`)}{s.email ? ` · ${s.email}` : ""}</div>
                  </div>
                  <Badge variant="secondary" className={cn("shrink-0 text-[10px]", s.status === "signed" && "bg-emerald-100 text-emerald-700", s.status === "declined" && "bg-red-100 text-red-700")}>{t(`contracts.signerStatus.${s.status}`)}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">{t("contracts.details")}</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <Row label={t("contracts.detail.province")} value={contract.province} />
              <Row label={t("contracts.detail.language")} value={contract.language === "fr" ? "Français" : "English"} />
              <Row label={t("contracts.detail.template")} value={`${contract.templateKey} v${contract.document.templateVersion}`} />
              <Row label={t("contracts.detail.subtotal")} value={formatCad(contract.variables.subtotal)} />
              <Row label={t("contracts.detail.tax")} value={formatCad(contract.variables.taxTotal)} />
              <Row label={t("contracts.detail.total")} value={formatCad(contract.variables.total)} bold />
              {contract.variables.paymentSchedule.holdback.enabled && <Row label={t("contracts.detail.holdback")} value={`${contract.variables.paymentSchedule.holdback.percent}%`} />}
              {contract.signedPdfHash && <div className="pt-2 text-[10px] text-slate-400 break-all"><span className="font-semibold">SHA-256:</span> {contract.signedPdfHash}</div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">{t("contracts.activity")}</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-2.5">
                {[...contract.events].reverse().map((e) => (
                  <li key={e.id} className="flex items-start gap-2 text-xs">
                    <span className={cn("h-1.5 w-1.5 rounded-full mt-1.5 shrink-0", e.type === "completed" || e.type === "signed" ? "bg-emerald-500" : e.type === "declined" || e.type === "voided" ? "bg-red-500" : "bg-slate-300")} />
                    <div>
                      <div className="text-slate-700">{t(`contracts.event.${e.type}`)}</div>
                      <div className="text-slate-400">{format(new Date(e.createdAt), "PPp", { locale })}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sign dialog */}
      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t("contracts.signDialogTitle")}</DialogTitle>
            <DialogDescription>{t("contracts.signDialogDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("contracts.signName")}</Label>
              <Input value={signName} onChange={(e) => setSignName(e.target.value)} />
            </div>
            <SignaturePad value={signature} onChange={setSignature} defaultName={signName} />
            <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
              <span>{t("contracts.consentCompany")}</span>
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSignOpen(false)}>{t("contracts.cancel")}</Button>
              <Button onClick={() => sign.mutate()} disabled={!signature || !consent || signName.trim().length < 2 || sign.isPending} className="gap-2">
                {sign.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} {t("contracts.signConfirm")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{contract.sentAt ? t("contracts.resend") : t("contracts.sendToCustomer")}</DialogTitle>
            <DialogDescription>{t("contracts.sendDialogDesc").replace("{email}", contract.variables.customer.email ?? "—")}</DialogDescription>
          </DialogHeader>
          {!contract.variables.customer.email && <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">{t("contracts.emailMissing")}</div>}
          <div className="space-y-1.5">
            <Label>{t("contracts.sendMessage")}</Label>
            <Textarea value={sendMessage} onChange={(e) => setSendMessage(e.target.value)} rows={3} placeholder={t("contracts.sendMessagePlaceholder")} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSendOpen(false)}>{t("contracts.cancel")}</Button>
            <Button onClick={() => send.mutate()} disabled={send.isPending || !contract.variables.customer.email} className="gap-2">
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t("contracts.sendConfirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Void dialog */}
      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{t("contracts.voidDialogTitle")}</DialogTitle>
            <DialogDescription>{t("contracts.voidDialogDesc")}</DialogDescription>
          </DialogHeader>
          <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} rows={2} placeholder={t("contracts.voidReason")} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setVoidOpen(false)}>{t("contracts.cancel")}</Button>
            <Button variant="destructive" onClick={() => voidContract.mutate()} disabled={voidContract.isPending}>{t("contracts.voidConfirm")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className={cn("text-slate-800", bold && "font-bold")}>{value}</span>
    </div>
  );
}

