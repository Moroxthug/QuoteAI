import type { ReactNode } from "react";
import { Link } from "wouter";
import { Check, X, ExternalLink, Receipt, Wallet, Flag, ListTodo, Mail, Banknote, Loader2, AlertTriangle, GitBranch, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import type { ProposalDto, ProposalKind } from "@/lib/assistant-api";
import { formatCents } from "@/lib/jobs-api";

const KIND_ICON: Record<ProposalKind, typeof Receipt> = { cost_entry: Wallet, milestone_update: Flag, task: ListTodo, invoice: Receipt, send_invoice: Mail, record_payment: Banknote, change_order: GitBranch, job_note: StickyNote };

/**
 * One assistant proposal as a confirm/dismiss card. Shared by the chat panel
 * (Phase 5) and the on-site action sheet (Phase 78) so a dictated cost and a
 * typed one look and behave the same.
 */
export function ProposalCard({ proposal, onConfirm, onDismiss, busy }: { proposal: ProposalDto; onConfirm: () => void; onDismiss: () => void; busy: boolean }) {
  const { t } = useLanguage();
  const Icon = KIND_ICON[proposal.kind] ?? Receipt;
  const p = proposal.payload;
  const details: string[] = [];
  if (proposal.kind === "cost_entry") details.push(`${formatCents(Number(p.subtotalCents))} + ${t("assistant.tax")} ${formatCents(Number(p.taxCents))} = ${formatCents(Number(p.totalCents))}`, String(p.date ?? ""), String(p.description ?? ""));
  if (proposal.kind === "record_payment") details.push(`${formatCents(Number(p.amountCents))} · ${t(`invoices.method.${String(p.method)}`)} · ${String(p.date ?? "")}`);
  if (proposal.kind === "milestone_update" && p.releasesPaymentTerm) details.push(`${t("assistant.releases")} ${String(p.releasesPaymentTerm)}`);
  if (proposal.kind === "send_invoice" && p.message) details.push(`"${String(p.message)}"`);
  if (proposal.kind === "change_order") {
    const items = Array.isArray(p.items) ? (p.items as { descrizione: string; quantita: number; um: string; totale: number }[]) : [];
    for (const it of items.slice(0, 6)) details.push(`${it.quantita && it.quantita !== 1 ? `${it.quantita} ${it.um || "×"} ` : ""}${it.descrizione} — ${formatCents(Math.round(Number(it.totale) * 100))}`);
    details.push(`${formatCents(Number(p.subtotalCents))} + ${t("assistant.tax")} ${formatCents(Number(p.taxCents))} = ${formatCents(Number(p.totalCents))}`);
    if (p.description) details.push(String(p.description));
    if (Number(p.scheduleDeltaDays)) details.push(`${Number(p.scheduleDeltaDays) > 0 ? "+" : ""}${Number(p.scheduleDeltaDays)} ${t("assistant.days")}`);
  }
  if (proposal.kind === "job_note") details.push(String(p.body ?? ""));
  const tab = proposal.kind === "cost_entry" ? "costs" : proposal.kind === "milestone_update" || proposal.kind === "task" ? "schedule" : proposal.kind === "change_order" ? "changes" : proposal.kind === "job_note" ? "overview" : "invoices";
  const link = proposal.resultEntityType === "invoice" && proposal.resultEntityId ? `/dashboard/invoices/${proposal.resultEntityId}` : proposal.projectId ? `/dashboard/jobs/${proposal.projectId}?tab=${tab}` : null;
  const status = proposal.status;
  return (
    <div className={cn("prop-card", status)}>
      <div className="prop-head">
        <span className="prop-ic"><Icon className="h-3.5 w-3.5" /></span>
        <div className="min-w-0 flex-1">
          <div className="prop-kind">{t(`assistant.kind.${proposal.kind}`)}</div>
          <div className="prop-summary">{proposal.summary}</div>
          {details.filter(Boolean).map((d, i) => <div key={i} className="prop-detail">{d}</div>)}
          {status === "failed" && proposal.error && <div className="prop-detail" style={{ color: "var(--red)" }}><AlertTriangle className="h-3 w-3" style={{ display: "inline", marginRight: 4 }} />{proposal.error}</div>}
        </div>
      </div>
      <div className="prop-actions">
        {status === "pending" && (
          <>
            <button type="button" className="btn btn-navy btn-sm" onClick={onConfirm} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} {t("assistant.confirm")}
            </button>
            <button type="button" className="prop-dismiss" onClick={onDismiss} disabled={busy}><X className="h-3.5 w-3.5" /> {t("assistant.dismiss")}</button>
          </>
        )}
        {status === "confirmed" && (
          <>
            <span className="prop-status ok"><Check className="h-3.5 w-3.5" /> {t("assistant.confirmed")}</span>
            {link && <Link href={link} className="prop-dismiss"><ExternalLink className="h-3 w-3" /> {t("assistant.open")}</Link>}
          </>
        )}
        {status === "dismissed" && <span className="prop-status muted">{t("assistant.dismissed")}</span>}
        {status === "failed" && <span className="prop-status err">{t("assistant.failed")}</span>}
      </div>
    </div>
  );
}

/** Tiny renderer: paragraphs, "- " bullets, **bold**. Enough for the assistant's prose without pulling a markdown lib. */
export function Markdownish({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let list: string[] = [];
  const flush = () => { if (list.length) { blocks.push(<ul key={blocks.length}>{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); list = []; } };
  for (const raw of lines) {
    const line = raw.trim();
    const m = /^(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (m) { list.push(m[1]!); continue; }
    flush();
    if (line) blocks.push(<p key={blocks.length}>{inline(line.replace(/^#+\s*/, ""))}</p>);
  }
  flush();
  return <>{blocks}</>;
}

function inline(s: string): ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>));
}
