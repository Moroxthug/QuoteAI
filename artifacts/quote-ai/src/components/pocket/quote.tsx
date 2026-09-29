/**
 * Phase 147 — the quote, as the canvas's "Quote draft" artboard draws it
 * (docs/pocket-design/Quote.dc.html), 1:1: back · the number in mono · ⋯; the status line and
 * validity; the title; the client with Change; "Scope, as understood" with Edit; the line items
 * with −/+ steppers (a lump sum shows "fixed"); subtotal, tax and the 28 px total; the deposit
 * switch; Send by Email / SMS / WhatsApp; and the floating Preview and Send $X.
 *
 * Changes save as you make them (the same PUT /api/quotes/:id and totals as the full editor).
 * Everything the canvas doesn't draw — the payment schedule editor, the contract, variants, the
 * Pro PDF, AI regenerate, duplicate, archive, delete — is in ⋯ and the full editor.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getGetQuoteQueryKey, useGetQuote, useListClients, useSendQuotePdfEmail, useUpdateQuote, type Quote,
} from "@workspace/api-client-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useCan } from "@/hooks/use-role";
import { haptic } from "@/lib/haptics";
import { smsApi } from "@/lib/sms-api";
import { stripeConnectApi } from "@/lib/invoices-api";
import { jobsApi } from "@/lib/jobs-api";
import { CANADIAN_PROVINCES, newTermId, type PaymentSchedule } from "@/lib/payment-schedule";
import { BottomSheet } from "@/components/mobile/bottom-sheet";
import { ActionSheet } from "@/components/mobile/action-sheet";
import { LineItemSheet, parseAmount } from "@/components/quotes/line-rows";
import { BackHeader, Segmented, Stepper, Switch, initialsOf } from "./kit";
import { MoreIcon } from "./icons";
import { money } from "./home/format";

type Voce = { descrizione: string; um: string; quantita: number; prezzoUnitario: number; totale: number };
type Chapter = { lettera: string; titolo: string; osservazione?: string; voci: Voce[]; subtotale: number };
type QuoteX = Quote & { paymentSchedule?: PaymentSchedule | null; validDays?: number | null; province?: string | null; clientId?: string | null };
type Channel = "email" | "sms" | "wa";

/** A lump sum ("lot", "forfait", one of something) shows "fixed"; a measured line gets the stepper. */
const LUMP = /^(lot|lots|ls|l\.s\.|forfait|forf\.?|job|lump|lump sum|global|—|-)?$/i;
const EACH = /^(cad|ea|each|u|unit|units|pc|pcs|pz|un|unité|unités)$/i;
const isFixed = (v: Voce) => LUMP.test(v.um.trim()) || (EACH.test(v.um.trim()) && v.quantita <= 1);
function stepOf(q: number, um: string): number {
  if (EACH.test(um.trim())) return 1;
  const raw = Math.abs(q) / 50;
  for (const s of [0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 500]) if (raw <= s) return s;
  return 1000;
}
const round2 = (n: number) => Math.round(n * 100) / 100;

function recompute(caps: Chapter[], q: QuoteX) {
  const capitoli = caps.map((c) => ({ ...c, voci: c.voci.map((v) => ({ ...v, totale: round2(v.quantita * v.prezzoUnitario) })), subtotale: round2(c.voci.reduce((s, v) => s + v.quantita * v.prezzoUnitario, 0)) }));
  const subtotale = round2(capitoli.reduce((s, c) => s + c.subtotale, 0));
  const perc = q.sconto?.percentuale ?? 0;
  const imponibile = perc > 0 ? subtotale * (1 - perc / 100) : subtotale;
  const ivaValore = round2(imponibile * (Number(q.ivaPercentuale) / 100));
  return { capitoli, subtotale, ivaValore, totale: round2(imponibile + ivaValore), sconto: perc > 0 ? { percentuale: perc, importoScontato: round2(imponibile) } : null };
}

const maskEmail = (e: string) => { const [a] = e.split("@"); return `${(a ?? "").slice(0, 6)}@…`; };
const maskPhone = (p: string) => `… ${p.replace(/\D/g, "").slice(-4)}`;

export function PocketQuote({ id }: { id: string }) {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const can = useCan();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data: raw, isLoading } = useGetQuote(id);
  const quote = raw as QuoteX | undefined;
  const update = useUpdateQuote();
  const sendEmail = useSendQuotePdfEmail();
  const { data: sms } = useQuery({ queryKey: ["sms-status"], queryFn: smsApi.status, retry: false, staleTime: 60_000 });
  const { data: stripe } = useQuery({ queryKey: ["stripe-connect-status"], queryFn: stripeConnectApi.status, retry: false, staleTime: 60_000, enabled: can("settings", "full") });
  const [caps, setCaps] = useState<Chapter[] | null>(null);
  const [ch, setCh] = useState<Channel | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [ask, setAsk] = useState<Channel | null>(null);
  const [dest, setDest] = useState("");
  const [scopeOpen, setScopeOpen] = useState(false);
  const [scope, setScope] = useState("");
  const [clientOpen, setClientOpen] = useState(false);
  const [lineSheet, setLineSheet] = useState<{ ci: number; vi: number | null } | null>(null);
  const saveTimer = useRef<number | null>(null);
  const { data: clients } = useListClients({ query: { queryKey: ["/api/clients"], enabled: clientOpen } });

  useEffect(() => { if (quote && !caps) setCaps((quote.capitoli as Chapter[]).map((c) => ({ ...c, voci: c.voci.map((v) => ({ ...v, quantita: Number(v.quantita), prezzoUnitario: Number(v.prezzoUnitario) })) }))); }, [quote, caps]);
  useEffect(() => () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); }, []);

  const editable = !!quote && can("quotes", "edit") && quote.status !== "accepted" && !quote.pdfDownloadedAt;
  const live = useMemo(() => (quote && caps ? recompute(caps, quote) : null), [caps, quote]);
  const client = (quote?.clientData ?? {}) as { nome?: string; indirizzo?: string; city?: string; province?: string; email?: string; phone?: string };
  const email = client.email?.trim() || "";
  const phone = client.phone?.trim() || "";
  const smsOk = !!sms?.available && !!sms?.smsEnabled;
  const channel: Channel = ch ?? (email ? "email" : phone && smsOk ? "sms" : "email");

  const save = (data: Record<string, unknown>, quiet = true) =>
    update.mutate({ id, data: data as never }, {
      onSuccess: (q) => { queryClient.setQueryData(getGetQuoteQueryKey(id), q); if (!quiet) toast({ title: t("dashboard.quoteDetail.quoteUpdatedSuccess") }); },
      onError: () => toast({ title: t("dashboard.quoteDetail.error"), description: t("dashboard.quoteDetail.errorSaveChanges"), variant: "destructive" }),
    });

  /** Change the lines now; save them a moment after the last tap. */
  const changeLines = (next: Chapter[]) => {
    setCaps(next);
    setSent(false);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { if (quote) save(recompute(next, quote)); }, 700);
  };

  if (isLoading || !quote || !caps || !live) return <div className="pk-page" aria-busy="true" />;

  const lines = caps.flatMap((c, ci) => c.voci.map((v, vi) => ({ v, ci, vi })));
  const legacy = caps.length === 0 ? (quote.items ?? []) : [];
  const status = quote.status;
  const validDays = quote.validDays ?? 30;
  const validFrom = quote.sentAt ? new Date(quote.sentAt) : new Date();
  const validUntil = new Date(validFrom.getTime() + validDays * 86_400_000).toLocaleDateString(lang === "fr" ? "fr-CA" : "en-US", { month: "short", day: "numeric" });
  const statusLine = status === "accepted"
    ? { dot: "#1f9d55", text: t("pocket.quote.accepted").replace("{date}", quote.acceptedAt ? new Date(quote.acceptedAt).toLocaleDateString(lang === "fr" ? "fr-CA" : "en-US", { month: "short", day: "numeric" }) : "") }
    : quote.sentAt
      ? { dot: "#e4572e", text: t("pocket.quote.sentValid").replace("{date}", validUntil) }
      : { dot: "#d69524", text: t("pocket.quote.draftValid").replace("{date}", validUntil) };
  const provName = CANADIAN_PROVINCES.find((p) => p.code === quote.province)?.[lang === "fr" ? "fr" : "en"] ?? "";
  const taxName = quote.taxLines?.length ? quote.taxLines.map((l) => (l.code === "TAX" ? t("pocket.quote.tax") : lang === "fr" ? ({ GST: "TPS", HST: "TVH", QST: "TVQ", PST: "TVP", RST: "TVD" } as Record<string, string>)[l.code] ?? l.code : l.code)).join(" + ") : t("pocket.quote.tax");
  const rate = Math.round(Number(quote.ivaPercentuale) * 1000) / 1000;

  // Deposit: the schedule's "on signing" term.
  const schedule = quote.paymentSchedule ?? null;
  const dep = schedule?.terms.find((x) => x.type === "deposit" && x.amountType === "percent") ?? null;
  const last = schedule?.terms.filter((x) => x.type !== "holdback_release").at(-1) ?? null;
  const canDeposit = !!schedule && editable && !!last && last.amountType === "percent" && schedule.terms.every((x) => x.amountType === "percent");
  const depPct = dep?.value ?? 30;
  const toggleDeposit = async () => {
    if (!schedule || !last) return;
    let terms = schedule.terms.map((x) => ({ ...x }));
    if (dep) {
      terms = terms.filter((x) => x.id !== dep.id);
      const tail = terms.find((x) => x.id === last.id) ?? terms.filter((x) => x.type !== "holdback_release").at(-1);
      if (tail) tail.value = round2(tail.value + dep.value);
    } else {
      const tail = terms.find((x) => x.id === last.id)!;
      const p = Math.min(depPct, Math.max(0, tail.value));
      tail.value = round2(tail.value - p);
      terms = [{ id: newTermId(), type: "deposit", label: t("pocket.quote.depositLabel"), trigger: "on_signing", amountType: "percent", value: p, dueDays: 0 }, ...terms.filter((x) => x.value > 0 || x.type === "holdback_release")];
    }
    haptic("selection");
    const next = { ...schedule, terms, derived: false };
    queryClient.setQueryData(getGetQuoteQueryKey(id), { ...quote, paymentSchedule: next });
    const res = await fetch(`/api/quotes/${id}`, { method: "PUT", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ paymentSchedule: next }) }).catch(() => null);
    if (!res?.ok) { queryClient.setQueryData(getGetQuoteQueryKey(id), quote); toast({ title: t("dashboard.quoteDetail.error"), variant: "destructive" }); return; }
    queryClient.setQueryData(getGetQuoteQueryKey(id), await res.json());
  };

  const firstName = (client.nome ?? "").trim().split(/\s+/)[0] ?? "";
  const send = async (target?: string) => {
    const to = target ?? (channel === "email" ? email : phone);
    if (!to) { setDest(""); setAsk(channel); return; }
    if (channel === "wa") return;
    setSending(true);
    haptic("light");
    try {
      if (channel === "email") {
        await sendEmail.mutateAsync({ id, data: { toEmail: to, clientName: client.nome ?? "" } });
      } else {
        const r = await fetch(`/api/quotes/${id}/send-sms`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ toPhone: to }) });
        if (!r.ok) throw Object.assign(new Error("sms"), { status: r.status, data: await r.json().catch(() => ({})) });
      }
      setSent(true);
      haptic("success");
      void queryClient.invalidateQueries({ queryKey: getGetQuoteQueryKey(id) });
    } catch (err) {
      const e = err as { status?: number; data?: { code?: string } };
      if (e.status === 402) { toast({ title: t("pocket.quote.unlockFirst") }); navigate(`/dashboard/quotes/${id}?classic=1`); }
      else toast({ title: t("pocket.quote.notSent"), description: e.data?.code?.startsWith("SMS_") ? t("pocket.quote.smsNotSent") : undefined, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const startJob = async () => {
    try {
      const res = await jobsApi.create({ name: `${quote.titoloPreventivoRiga2 || quote.titoloPreventivoRiga1 || t("dashboard.quoteDetail.projectNamePrefix")} – ${client.nome ?? ""}`.slice(0, 200), quoteId: id, plannedStart: new Date().toISOString().slice(0, 10) });
      navigate(`/dashboard/jobs/${res.job.id}`);
    } catch (err) {
      toast({ title: t("dashboard.quoteDetail.error"), description: (err as Error).message, variant: "destructive" });
    }
  };

  const channels = [
    { value: "email" as const, label: t("pocket.quote.email"), sub: email ? maskEmail(email) : t("pocket.quote.addAddress") },
    { value: "sms" as const, label: "SMS", sub: !smsOk ? t("pocket.quote.notSetUp") : phone ? maskPhone(phone) : t("pocket.quote.addNumber") },
    { value: "wa" as const, label: "WhatsApp", sub: t("pocket.quote.notSetUp") },
  ];
  const sendLabel = sent ? t("pocket.quote.sentTo").replace("{name}", firstName || t("pocket.quote.client")) : t("pocket.quote.send").replace("{total}", money(Math.round(live.totale * 100), lang, true));
  const primary = status === "accepted"
    ? (quote.jobId ? { label: t("pocket.quote.openJob"), run: () => navigate(`/dashboard/jobs/${quote.jobId}`) } : { label: t("pocket.quote.startJob"), run: startJob })
    : { label: sendLabel, run: () => void send() };
  const moreActions = [
    { label: t("pocket.quote.fullEditor"), onSelect: () => navigate(`/dashboard/quotes/${id}?classic=1`) },
    { label: t("pocket.quote.copyLink"), onSelect: () => { void navigator.clipboard?.writeText(`${window.location.origin}/p/${id}`); toast({ title: t("pocket.quote.linkCopied") }); } },
  ];

  const card: React.CSSProperties = { background: "#ffffff", borderRadius: 22, boxShadow: "var(--pk-shadow-card)" };
  const stepperFor = (v: Voce, ci: number, vi: number) => {
    const step = stepOf(v.quantita, v.um);
    const set = (q: number) => changeLines(caps.map((c, i) => (i !== ci ? c : { ...c, voci: c.voci.map((x, j) => (j !== vi ? x : { ...x, quantita: Math.max(0, round2(q)) })) })));
    return (
      <Stepper value={`${v.quantita.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA")} ${v.um}`} minWidth={66} fontSize={12}
        decLabel={t("pocket.quote.less").replace("{what}", v.descrizione.split("\n")[0]!)} incLabel={t("pocket.quote.more").replace("{what}", v.descrizione.split("\n")[0]!)}
        canDec={v.quantita - step > 0} onDec={() => { haptic("selection"); set(v.quantita - step); }} onInc={() => { haptic("selection"); set(v.quantita + step); }} />
    );
  };

  return (
    <div className="pk-page" style={{ paddingBottom: 130 }}>
      <BackHeader backHref="/dashboard/quotes" backLabel={t("pocket.quote.back")} title={quote.numeroPreventivoData ?? undefined}
        right={<ActionSheet actions={moreActions} trigger={<button type="button" className="pk-icon-btn pk-press" aria-label={t("mobile.moreActions")}><MoreIcon /></button>} />} />

      <section className="pk-rise" style={{ padding: "8px 20px 0" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6e6e76" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: statusLine.dot }} />{statusLine.text}</span>
        <h1 style={{ margin: "8px 0 0", fontSize: 24, lineHeight: 1.2, fontWeight: 600, letterSpacing: "-0.035em" }}>{quote.titoloPreventivoRiga2 || quote.titoloPreventivoRiga1 || quote.descrizioneGenerale.split("\n")[0]}</h1>
        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 32, height: 32, borderRadius: "50%", background: "#f1ede4", fontSize: 11.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{initialsOf(client.nome ?? "") || "?"}</span>
          <span style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{client.nome || t("pocket.quote.noClient")}</span>
            {(client.indirizzo || client.city) && <span style={{ fontSize: 12, color: "#6e6e76" }}>{[client.indirizzo, client.city].filter(Boolean).join(", ")}</span>}
          </span>
          {editable && <button type="button" className="pk-btn-chip pk-press" onClick={() => setClientOpen(true)}>{t("pocket.quote.change")}</button>}
        </div>
      </section>

      <section className="pk-rise" style={{ padding: "20px 16px 0", animationDelay: "70ms" }}>
        <div style={{ ...card, padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#6e6e76" }}>{t("pocket.quote.scope")}</h2>
            {editable && <button type="button" className="pk-btn-link pk-press" onClick={() => { setScope(quote.descrizioneGenerale); setScopeOpen(true); }}>{t("pocket.quote.edit")}</button>}
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.5, color: "#3c3c43", whiteSpace: "pre-line", textWrap: "pretty" as never }}>{quote.descrizioneGenerale || quote.rawInput}</p>
        </div>
      </section>

      <section className="pk-rise" style={{ padding: "22px 16px 0", animationDelay: "140ms" }} aria-labelledby="pk-lines">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 10px" }}>
          <h2 id="pk-lines" style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em" }}>{t("pocket.quote.lineItems")}</h2>
          {editable && caps.length > 0 && <button type="button" className="pk-press" onClick={() => setLineSheet({ ci: caps.length - 1, vi: null })} style={{ height: 30, padding: "0 4px", border: 0, background: "transparent", color: "#6e6e76", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}>{t("pocket.quote.addItem")}</button>}
        </div>
        <div style={{ ...card, padding: "2px 0" }}>
          {lines.map(({ v, ci, vi }, i) => (
            <div key={`${ci}-${vi}`} style={{ padding: "13px 16px", display: "flex", flexDirection: "column", gap: 8, borderTop: i ? "1px solid #efeeea" : undefined }}>
              <button type="button" disabled={!editable} onClick={() => setLineSheet({ ci, vi })} style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "baseline", border: 0, background: "transparent", padding: 0, textAlign: "left", fontFamily: "inherit", color: "inherit", cursor: editable ? "pointer" : "default" }}>
                <span style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.3 }}>{v.descrizione.split("\n")[0]}</span>
                <span className="pk-num" style={{ fontSize: 14, fontWeight: 500, whiteSpace: "nowrap" }}>{money(Math.round(v.quantita * v.prezzoUnitario * 100), lang, true)}</span>
              </button>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: 12, color: "#6e6e76", lineHeight: 1.35 }}>{isFixed(v) ? (v.descrizione.split("\n")[1] ?? "") : `${money(Math.round(v.prezzoUnitario * 100), lang, true)} / ${v.um}`}</span>
                {isFixed(v) || !editable ? <span className="pk-mono" style={{ fontSize: 11.5, color: "#8a8a90", flexShrink: 0 }}>{isFixed(v) ? t("pocket.quote.fixed") : `${v.quantita} ${v.um}`}</span> : stepperFor(v, ci, vi)}
              </div>
            </div>
          ))}
          {legacy.map((it, i) => (
            <div key={`l${i}`} style={{ padding: "13px 16px", display: "flex", justifyContent: "space-between", gap: 12, borderTop: i || lines.length ? "1px solid #efeeea" : undefined }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{it.descrizione}</span><span className="pk-num" style={{ fontSize: 14, fontWeight: 500 }}>{money(Math.round(Number(it.totale) * 100), lang, true)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="pk-rise" style={{ padding: "12px 16px 0", animationDelay: "210ms" }}>
        <div style={{ ...card, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6e6e76" }}><span>{t("pocket.quote.subtotal")}</span><span className="pk-num" style={{ color: "#141416" }}>{money(Math.round(live.subtotale * 100), lang, true)}</span></div>
          {live.sconto && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6e6e76", marginTop: 8 }}><span>{t("pocket.quote.discount").replace("{p}", String(live.sconto.percentuale))}</span><span className="pk-num" style={{ color: "#141416" }}>−{money(Math.round((live.subtotale - live.sconto.importoScontato) * 100), lang, true)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6e6e76", marginTop: 8 }}><span>{[taxName, provName].filter(Boolean).join(", ")} {rate}%</span><span className="pk-num" style={{ color: "#141416" }}>{money(Math.round(live.ivaValore * 100), lang, true)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 14, paddingTop: 14, borderTop: "1px solid #efeeea" }}><span style={{ fontSize: 14, fontWeight: 500 }}>{t("pocket.quote.total")}</span><span className="pk-num" style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.045em" }}>{money(Math.round(live.totale * 100), lang, true)}</span></div>
        </div>
        {schedule && (canDeposit || dep) && (
          <div style={{ ...card, marginTop: 12, padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{t("pocket.quote.deposit").replace("{p}", String(depPct))}</span>
                <span style={{ fontSize: 12, color: "#6e6e76" }}>{stripe?.connected && stripe.chargesEnabled ? t("pocket.quote.cardOrEtransfer") : t("pocket.quote.etransfer")}</span>
              </span>
              <Switch on={!!dep} onChange={() => void toggleDeposit()} label={t("pocket.quote.deposit").replace("{p}", String(depPct))} disabled={!canDeposit} />
            </div>
            {dep && (
              <div className="pk-reveal" style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: "1px solid #efeeea", fontSize: 13 }}>
                <span style={{ color: "#6e6e76" }}>{t("pocket.quote.dueOnAcceptance")}</span><span className="pk-num" style={{ fontWeight: 500 }}>{money(Math.round(live.totale * dep.value) , lang, true)}</span>
              </div>
            )}
          </div>
        )}
      </section>

      {status !== "accepted" && (
        <section className="pk-rise" style={{ padding: "22px 16px 0", animationDelay: "280ms" }}>
          <h2 style={{ margin: "0 4px 10px", fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em" }}>{t("pocket.quote.sendBy")}</h2>
          <Segmented label={t("pocket.quote.sendChannel")} size={50} variant="big" value={channel} onChange={(v) => { setCh(v); setSent(false); }}
            options={channels.map((c) => ({ value: c.value, label: c.label, sub: c.sub, style: c.value === "wa" || (c.value === "sms" && !smsOk) ? { opacity: 0.55 } : undefined }))}
            renderOption={(o) => (<span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}><span style={{ fontSize: 13, fontWeight: 500 }}>{o.label}</span><span className="pk-mono" style={{ fontSize: 10.5, opacity: 0.7 }}>{o.sub}</span></span>)} />
        </section>
      )}

      <div style={{ position: "fixed", left: 16, right: 16, bottom: "calc(26px + env(safe-area-inset-bottom, 0px))", display: "flex", gap: 10, zIndex: 40 }}>
        <a href={`/p/${id}?preview=1`} target="_blank" rel="noreferrer" className="pk-pill pk-pill-glass pk-press">{t("pocket.quote.preview")}</a>
        <button type="button" className={`pk-pill pk-press ${sent ? "pk-pill-ok" : "pk-pill-dark"}`} data-primary-action style={{ flexGrow: 1 }} disabled={sending || (status !== "accepted" && (channel === "wa" || (channel === "sms" && !smsOk)))} onClick={primary.run}>{sending ? t("pocket.quote.sending") : primary.label}</button>
      </div>

      <BottomSheet open={ask !== null} onOpenChange={(v) => !v && setAsk(null)} title={ask === "email" ? t("pocket.quote.whichEmail") : t("pocket.quote.whichNumber")}>
        <form onSubmit={(e) => { e.preventDefault(); const v = dest.trim(); if (!v) return; setAsk(null); void send(v); }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label htmlFor="pk-dest" className="sr-only">{ask === "email" ? t("pocket.quote.whichEmail") : t("pocket.quote.whichNumber")}</label>
          <input id="pk-dest" className="inp" autoFocus type={ask === "email" ? "email" : "tel"} inputMode={ask === "email" ? "email" : "tel"} value={dest} onChange={(e) => setDest(e.target.value)} />
          <button type="submit" className="pk-btn pk-btn-dark pk-press" disabled={!dest.trim()}>{t("pocket.quote.sendNow")}</button>
        </form>
      </BottomSheet>

      <BottomSheet open={scopeOpen} onOpenChange={setScopeOpen} title={t("pocket.quote.scope")}>
        <form onSubmit={(e) => { e.preventDefault(); setScopeOpen(false); save({ descrizioneGenerale: scope.trim() }, false); }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label htmlFor="pk-scope" className="sr-only">{t("pocket.quote.scope")}</label>
          <textarea id="pk-scope" className="inp" rows={6} value={scope} onChange={(e) => setScope(e.target.value)} />
          <button type="submit" className="pk-btn pk-btn-dark pk-press">{t("pocket.quote.save")}</button>
        </form>
      </BottomSheet>

      <BottomSheet open={clientOpen} onOpenChange={setClientOpen} title={t("pocket.home.whichClient")} flush>
        <div className="lrows">
          {(clients ?? []).map((c) => (
            <button key={c.id} type="button" className="lrow" onClick={() => {
              setClientOpen(false);
              save({ clientData: { nome: c.clientName, indirizzo: c.indirizzo ?? "", ...(c.city ? { city: c.city } : {}), ...(c.postalCode ? { postalCode: c.postalCode } : {}), ...(c.province ? { province: c.province } : {}), ...(c.email ? { email: c.email } : {}), ...(c.phone ? { phone: c.phone } : {}) } }, false);
            }}>
              <span className="lrow-main"><span className="lrow-title">{c.clientName}</span><span className="lrow-meta">{[c.indirizzo, c.city].filter(Boolean).join(", ") || c.email || ""}</span></span>
            </button>
          ))}
          {clients && clients.length === 0 && <p className="more-empty">{t("pocket.home.noClients")}</p>}
        </div>
      </BottomSheet>

      {lineSheet && (
        <LineItemSheet
          open
          onOpenChange={(v) => !v && setLineSheet(null)}
          isNew={lineSheet.vi === null}
          initial={lineSheet.vi === null ? { descrizione: "", um: "", quantita: "1", prezzoUnitario: "" } : (() => { const v = caps[lineSheet.ci]!.voci[lineSheet.vi]!; return { descrizione: v.descrizione, um: v.um, quantita: String(v.quantita), prezzoUnitario: String(v.prezzoUnitario) }; })()}
          onSave={(d) => {
            const v: Voce = { descrizione: d.descrizione, um: d.um, quantita: parseAmount(d.quantita) ?? 0, prezzoUnitario: parseAmount(d.prezzoUnitario) ?? 0, totale: 0 };
            const { ci, vi } = lineSheet;
            setLineSheet(null);
            changeLines(caps.map((c, i) => (i !== ci ? c : { ...c, voci: vi === null ? [...c.voci, v] : c.voci.map((x, j) => (j === vi ? v : x)) })));
          }}
          onDelete={lineSheet.vi === null ? undefined : () => { const { ci, vi } = lineSheet; setLineSheet(null); changeLines(caps.map((c, i) => (i !== ci ? c : { ...c, voci: c.voci.filter((_, j) => j !== vi) }))); }}
        />
      )}
    </div>
  );
}
