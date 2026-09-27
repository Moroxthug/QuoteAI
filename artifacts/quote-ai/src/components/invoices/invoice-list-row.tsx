import { format } from "date-fns";
import type { enCA } from "date-fns/locale";
import { ListRow } from "@/components/mobile/list-row";
import { useLanguage } from "@/i18n/LanguageContext";
import { formatCents } from "@/lib/jobs-api";
import { isOpenInvoice, type InvoiceDto, type InvoiceStatus } from "@/lib/invoices-api";
import { cn } from "@/lib/utils";

export function invoiceStatusChip(status: InvoiceStatus): string {
  if (status === "paid") return "chip-green";
  if (status === "overdue") return "chip-red";
  if (status === "void" || status === "draft") return "chip-grey";
  return "chip-yellow";
}

/**
 * Phase 107 — an invoice as a phone row: the client (or, on a client's own
 * page, the job), the number and when it is due or was paid, the amount (what
 * is still owed once part is paid) and the status.
 */
export function InvoiceListRow({ inv, locale, showClient = true }: { inv: InvoiceDto; locale: typeof enCA; showClient?: boolean }) {
  const { t } = useLanguage();
  const open = isOpenInvoice(inv.status);
  const when = inv.status === "paid" && inv.paidAt ? `${t("invoices.paidOn")} ${format(new Date(inv.paidAt), "PP", { locale })}`
    : open ? `${t("invoices.dueOn")} ${format(new Date(inv.dueDate), "PP", { locale })}`
    : format(new Date(inv.issueDate), "PP", { locale });
  const partPaid = open && inv.paidCents > 0;
  const title = showClient ? inv.clientName || inv.number : inv.projectName || inv.title || inv.number;
  return (
    <ListRow
      href={`/dashboard/invoices/${inv.id}`}
      title={title}
      meta={[title === inv.number ? null : inv.number, <span key="w" className={inv.status === "overdue" ? "t-bad" : undefined}>{when}</span>]}
      amount={<span className={cn(inv.type === "credit_note" && "t-bad")}>{formatCents(partPaid ? inv.balanceCents : inv.totalCents)}</span>}
      end={<span className={cn("chip", invoiceStatusChip(inv.status))}>{t(`invoices.status.${inv.status}`)}</span>}
    />
  );
}
