import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import {
  ArrowLeft, FileSignature, Send, Download, Ban, Pencil, Save, X, Loader2, CheckCircle2, Clock, AlertTriangle, Lock, Sparkles, RefreshCw, Archive,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { MockupToggle } from "@/components/ui/mockup-toggle";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";
import { contractsApi, type ContractDto } from "@/lib/contracts-api";
import { SignaturePad, type SignatureValue } from "@/components/signature-pad";
import { formatCad } from "@/lib/money";


/** Contract status → locked `.chip-*` colour (Phase 57). */
export const STATUS_STYLES: Record<ContractDto["status"], string> = {
  draft: "chip-grey",
  sent: "chip-teal",
  viewed: "chip-purple",
  signed: "chip-green",
  declined: "chip-red",
  voided: "chip-grey",
  expired: "chip-yellow",
};

export function ContractStatusBadge({ status }: { status: ContractDto["status"] }) {
  const { t } = useLanguage();
  return <span className={cn("chip", STATUS_STYLES[status])}>{t(`contracts.status.${status}`)}</span>;
}

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useLanguage();
  const can = useCan();
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
  // Phase 66: the quote forms never collect the customer email — let the send dialog add it.
  const [sendEmail, setSendEmail] = useState("");
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
    mutationFn: async () => contractsApi.send(contract!.id, { message: sendMessage.trim() || undefined, toEmail: contract!.variables.customer.email ? undefined : sendEmail.trim() || undefined }),
    onSuccess: (res) => {
      refresh(res);
      setSendOpen(false);
      setSendMessage("");
      setSendEmail("");
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

  const archiveContract = useMutation({
    mutationFn: async () => contractsApi.archive(contract!.id),
    onSuccess: (c) => { refresh({ contract: c }); toast({ title: t("archive.archivedToast") }); },
    onError: (e: Error) => toast({ title: t("archive.restoreErrorToast"), description: e.message, variant: "destructive" }),
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
        <Skeleton className="h-[600px] w-full rounded-[var(--radius-mk)]" />
      </div>
    );
  }
  if (error || !contract || !vars) {
    return (
      <div className="card card-empty">
        <AlertTriangle style={{ color: "var(--yellow-dark)" }} />
        <p style={{ color: "var(--navy)" }}>{t("contracts.notFound")}</p>
        <Link href="/dashboard/contracts" className="text-link mt-2">{t("contracts.backToList")}</Link>
      </div>
    );
  }

  const backHref = contract.kind === "change_order" && contract.projectId ? `/dashboard/jobs/${contract.projectId}?tab=changes` : "/dashboard/contracts";

  return (
    <div className="animate-in fade-in duration-300">
      <Link href={backHref} className="back-link"><ArrowLeft /> {contract.kind === "change_order" ? t("contracts.backToJob") : t("contracts.backToList")}</Link>
      <div className="page-head">
        <div className="min-w-0">
          <div className="title-row">
            <h1><FileSignature />{contract.contractNumber}</h1>
            <ContractStatusBadge status={contract.status} />
            {contract.kind === "change_order" && <span className="chip chip-yellow">{t("contracts.changeOrder")}</span>}
          </div>
          <div className="meta">
            <span>{contract.variables.customer.name} · {contract.variables.projectTitle} · <strong style={{ color: "var(--navy)" }}>{formatCad(contract.variables.total)}</strong></span>
            {contract.quoteId && <Link href={`/dashboard/quotes/${contract.quoteId}`}>{t("contracts.viewQuote")} {contract.variables.quoteNumber}</Link>}
            {contract.projectId && <Link href={`/dashboard/jobs/${contract.projectId}`}>{t("contracts.openJob")}</Link>}
          </div>
        </div>
        <div className="head-actions">
          <a href={contractsApi.pdfUrl(contract.id, true)} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-navy">
            <Download className="h-4 w-4" /> {contract.hasSignedPdf ? t("contracts.downloadSigned") : t("contracts.downloadPdf")}
          </a>
          {isOpen && !editing && can("contracts", "full") && (
            <button type="button" className="btn btn-sm btn-outline-navy" style={{ borderColor: "var(--red)", color: "var(--red)" }} onClick={() => setVoidOpen(true)}><Ban className="h-4 w-4" /> {t("contracts.void")}</button>
          )}
          {!isOpen && !isDraft && can("contracts", "full") && (
            <button type="button" className="text-link" onClick={() => archiveContract.mutate()} disabled={archiveContract.isPending}><Archive /> {t("dashboard.quotesList.archive")}</button>
          )}
        </div>
      </div>

      {/* Progress */}
      {isOpen && (
        <div className="steps-inline">
          {steps.map((s, i) => (
            <div key={s.key} className={cn("step-pill", s.done && "done")}>
              {s.done ? <CheckCircle2 /> : <span className="num">{i + 1}</span>}
              {s.label}
            </div>
          ))}
        </div>
      )}

      {contract.status === "declined" && customerSigner?.declineReason && (
        <div className="notice danger" style={{ marginBottom: 16 }}>
          <Ban />
          <span className="grow"><strong>{t("contracts.declinedReason")}:</strong> {customerSigner.declineReason}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Document */}
        <div className="lg:col-span-2 stack">
          {isDraft && (
            <div className="notice info">
              <Sparkles />
              <span className="grow">{t("contracts.draftHint")}</span>
              <div className="actions">
                {editing ? (
                  <>
                    <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setEditing(false)} disabled={save.isPending}><X className="h-4 w-4" /> {t("contracts.cancel")}</button>
                    <button type="button" className="btn btn-sm btn-navy" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t("contracts.save")}</button>
                  </>
                ) : can("contracts", "edit") ? (
                  <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> {t("contracts.edit")}</button>
                ) : null}
              </div>
            </div>
          )}

          {editing ? (
            <section className="card">
              <div className="card-head">
                <div>
                  <h2>{t("contracts.editTitle")}</h2>
                  <p className="sub">{t("contracts.editDesc")}</p>
                </div>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label>{t("contracts.field.customerName")}</label>
                  <input value={vars.customerName} onChange={(e) => setVars({ ...vars, customerName: e.target.value })} />
                </div>
                <div className="field">
                  <label>{t("contracts.field.customerEmail")}</label>
                  <input type="email" value={vars.customerEmail} onChange={(e) => setVars({ ...vars, customerEmail: e.target.value })} placeholder="client@email.com" />
                </div>
                <div className="field">
                  <label>{t("contracts.field.startDate")}</label>
                  <input type="date" value={vars.startDate} onChange={(e) => setVars({ ...vars, startDate: e.target.value })} />
                </div>
                <div className="field">
                  <label>{t("contracts.field.duration")}</label>
                  <input type="number" min={1} value={vars.estimatedDurationWeeks} onChange={(e) => setVars({ ...vars, estimatedDurationWeeks: e.target.value })} />
                </div>
                <div className="field">
                  <label>{t("contracts.field.warranty")}</label>
                  <input type="number" min={0} value={vars.warrantyMonths} onChange={(e) => setVars({ ...vars, warrantyMonths: e.target.value })} />
                </div>
                <div className="field">
                  <label>{t("contracts.field.holdback")}</label>
                  <div className="field inline" style={{ minHeight: 44 }}>
                    <MockupToggle checked={vars.holdbackEnabled} onCheckedChange={(v) => setVars({ ...vars, holdbackEnabled: v })} label={t("contracts.field.holdback")} />
                    {vars.holdbackEnabled && <input type="number" min={0} max={50} style={{ width: 90 }} value={vars.holdbackPercent} onChange={(e) => setVars({ ...vars, holdbackPercent: e.target.value })} />}
                    {vars.holdbackEnabled && <span>%</span>}
                  </div>
                </div>
              </div>

              <div className="set-row">
                <div className="txt">
                  <b>{t("contracts.field.directAgreement")}</b>
                  <span>{t("contracts.field.directAgreementHint")}</span>
                </div>
                <MockupToggle checked={vars.directAgreement} onCheckedChange={(v) => setVars({ ...vars, directAgreement: v })} label={t("contracts.field.directAgreement")} />
              </div>
              {contract.province === "QC" && contract.language === "en" && (
                <div className="set-row">
                  <div className="txt">
                    <b>{t("contracts.field.englishQc")}</b>
                    <span>{t("contracts.field.englishQcHint")}</span>
                  </div>
                  <MockupToggle checked={vars.englishRequestedInQuebec} onCheckedChange={(v) => setVars({ ...vars, englishRequestedInQuebec: v })} label={t("contracts.field.englishQc")} />
                </div>
              )}

              <div className="form-grid" style={{ borderTop: "1px solid var(--soft)" }}>
                {contract.document.sections.filter((s) => s.editable).map((s) => (
                  <div key={s.key} className="field full">
                    <label className="flex items-center gap-2">{s.heading} <span className="chip chip-purple"><Sparkles className="h-3 w-3 mr-1" /> {t("contracts.aiDrafted")}</span></label>
                    <textarea className="mono" value={sectionDrafts[s.key] ?? ""} onChange={(e) => setSectionDrafts({ ...sectionDrafts, [s.key]: e.target.value })} rows={s.key === "scope" ? 14 : 5} />
                    <p className="field-hint">{t("contracts.markdownHint")}</p>
                  </div>
                ))}
                <div className="full notice info" style={{ marginTop: 0 }}>
                  <Lock /> <span className="grow">{t("contracts.lockedHint")}</span>
                </div>
              </div>
            </section>
          ) : (
            <section className="card doc-view">
              <style dangerouslySetInnerHTML={{ __html: data!.css }} />
              <div dangerouslySetInnerHTML={{ __html: data!.html }} />
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="stack">
          <section className="card">
            <div className="card-head"><div><h2>{t("contracts.nextStep")}</h2></div></div>
            <div className="act-body stack" style={{ gap: 10 }}>
              {contract.status === "signed" ? (
                <div className="notice ok">
                  <CheckCircle2 />
                  <span className="grow">{t("contracts.executed").replace("{date}", contract.signedAt ? format(new Date(contract.signedAt), "PPP", { locale }) : "")}</span>
                </div>
              ) : !isOpen ? (
                <p className="foot-note">{t("contracts.closedHint")}</p>
              ) : !can("contracts", "edit") ? null : contractorSigner?.status !== "signed" ? (
                <button type="button" className="btn btn-navy w-full" onClick={() => setSignOpen(true)} disabled={editing}><FileSignature className="h-4 w-4" /> {t("contracts.signAsCompany")}</button>
              ) : !contract.sentAt ? (
                <button type="button" className="btn btn-navy w-full" onClick={() => setSendOpen(true)} disabled={!canSend || editing}><Send className="h-4 w-4" /> {t("contracts.sendToCustomer")}</button>
              ) : (
                <>
                  <div className="notice teal">
                    <Clock />
                    <span className="grow">
                      {t("contracts.waitingCustomer").replace("{email}", customerSigner?.email ?? "")}
                      {contract.expiresAt && <small>{t("contracts.expires")} {format(new Date(contract.expiresAt), "PPP", { locale })}</small>}
                    </span>
                  </div>
                  <button type="button" className="btn btn-outline-navy w-full" onClick={() => setSendOpen(true)}><RefreshCw className="h-4 w-4" /> {t("contracts.resend")}</button>
                </>
              )}
              {isDraft && contractorSigner?.status === "signed" && (
                <p className="foot-note text-center">{t("contracts.editInvalidates")}</p>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-head"><div><h2>{t("contracts.signers")}</h2></div></div>
            <div>
              {contract.signers.map((s) => (
                <div key={s.id} className="item-row">
                  <div className="grow">
                    <b className="ttl">{s.name || "—"}</b>
                    <span className="sub">{t(`contracts.role.${s.role}`)}{s.email ? ` · ${s.email}` : ""}</span>
                  </div>
                  <span className={cn("chip", s.status === "signed" ? "chip-green" : s.status === "declined" ? "chip-red" : "chip-grey")}>{t(`contracts.signerStatus.${s.status}`)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="card-head"><div><h2>{t("contracts.details")}</h2></div></div>
            <div className="py-2">
              <Row label={t("contracts.detail.province")} value={contract.province} />
              <Row label={t("contracts.detail.language")} value={contract.language === "fr" ? "Français" : "English"} />
              <Row label={t("contracts.detail.template")} value={`${contract.templateKey} v${contract.document.templateVersion}`} />
              <Row label={t("contracts.detail.subtotal")} value={formatCad(contract.variables.subtotal)} />
              <Row label={t("contracts.detail.tax")} value={formatCad(contract.variables.taxTotal)} />
              <Row label={t("contracts.detail.total")} value={formatCad(contract.variables.total)} bold />
              {contract.variables.paymentSchedule.holdback.enabled && <Row label={t("contracts.detail.holdback")} value={`${contract.variables.paymentSchedule.holdback.percent}%`} />}
            </div>
            {contract.signedPdfHash && <div className="card-foot"><span className="foot-note break-all" style={{ fontSize: 11 }}><b>SHA-256:</b> {contract.signedPdfHash}</span></div>}
          </section>

          <section className="card">
            <div className="card-head"><div><h2>{t("contracts.activity")}</h2></div></div>
            <div>
              {[...contract.events].reverse().map((e) => (
                <div key={e.id} className="tl-row">
                  <span className={cn("tl-dot", (e.type === "completed" || e.type === "signed") && "ok", (e.type === "declined" || e.type === "voided") && "bad")} />
                  <div className="min-w-0">
                    <b>{t(`contracts.event.${e.type}`)}</b>
                    <span>{format(new Date(e.createdAt), "PPp", { locale })}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Sign dialog */}
      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("contracts.signDialogTitle")}</DialogTitle>
            <DialogDescription>{t("contracts.signDialogDesc")}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="field">
              <label>{t("contracts.signName")}</label>
              <input value={signName} onChange={(e) => setSignName(e.target.value)} />
            </div>
            <SignaturePad value={signature} onChange={setSignature} defaultName={signName} />
            <label className="chk-row">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>{t("contracts.consentCompany")}</span>
            </label>
          </DialogBody>
          <DialogFooter>
            <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setSignOpen(false)}>{t("contracts.cancel")}</button>
            <button type="button" className="btn btn-sm btn-navy" onClick={() => sign.mutate()} disabled={!signature || !consent || signName.trim().length < 2 || sign.isPending}>
              {sign.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} {t("contracts.signConfirm")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{contract.sentAt ? t("contracts.resend") : t("contracts.sendToCustomer")}</DialogTitle>
            <DialogDescription>{t("contracts.sendDialogDesc").replace("{email}", contract.variables.customer.email || sendEmail.trim() || "—")}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {!contract.variables.customer.email && (
              <div className="field">
                <label htmlFor="contract-send-email">{t("contracts.customerEmailLabel")}</label>
                <input id="contract-send-email" type="email" value={sendEmail} onChange={(e) => setSendEmail(e.target.value)} placeholder="client@example.com" autoFocus />
                <p className="field-hint">{t("contracts.customerEmailHint")}</p>
              </div>
            )}
            <div className="field">
              <label>{t("contracts.sendMessage")}</label>
              <textarea value={sendMessage} onChange={(e) => setSendMessage(e.target.value)} rows={3} placeholder={t("contracts.sendMessagePlaceholder")} />
            </div>
          </DialogBody>
          <DialogFooter>
            <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setSendOpen(false)}>{t("contracts.cancel")}</button>
            <button type="button" className="btn btn-sm btn-navy" onClick={() => send.mutate()} disabled={send.isPending || !(contract.variables.customer.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sendEmail.trim()))}>
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t("contracts.sendConfirm")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void dialog */}
      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t("contracts.voidDialogTitle")}</DialogTitle>
            <DialogDescription>{t("contracts.voidDialogDesc")}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="field">
              <textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} rows={2} placeholder={t("contracts.voidReason")} />
            </div>
          </DialogBody>
          <DialogFooter>
            <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setVoidOpen(false)}>{t("contracts.cancel")}</button>
            <button type="button" className="btn btn-sm btn-red" onClick={() => voidContract.mutate()} disabled={voidContract.isPending}>{voidContract.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{t("contracts.voidConfirm")}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn("kv", bold && "total")}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
