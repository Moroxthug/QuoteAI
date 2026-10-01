// Job.dc.html, the Invoices tab: invoiced, collected, outstanding and still to invoice; then the billing plan from the contract, a row for
// each payment term with the invoice that came from it (paid, late, draft, sent) and "Create" on a term whose milestone is done and has
// no invoice yet; change-order and manual invoices follow. "Manual invoice" opens the new-invoice form.
import { useMemo, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { ApiFailure } from "@/lib/api";
import { money, shortDate, type Locale } from "@/lib/format";
import type { JobDetail } from "@/lib/jobDetail";
import { billingFigures, daysLate, planRows, type PlanRow, type PlanState } from "@/lib/jobBilling";
import { jobsApi } from "@/lib/jobsApi";
import { screenHref } from "@/lib/nav";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { useToast } from "@/ui/Feedback";
import { FigureCells } from "@/ui/JobPage";
import { Section } from "@/ui/Layout";
import { Press } from "@/ui/motion";
import { RowList, SectionHeader } from "@/ui/Row";
import { Status, type StatusShape, type StatusTone } from "@/ui/Status";
import { Num, Text } from "@/ui/Text";
import { usePrimary } from "./primary";

const LOOK: Record<PlanState, { tone: StatusTone; shape: StatusShape } | null> = {
  paid: { tone: "ok", shape: "check" }, late: { tone: "bad", shape: "alert" }, partial: { tone: "warn", shape: "clock" }, sent: { tone: "info", shape: "q1" }, draft: { tone: "mute", shape: "draft" }, open: { tone: "mute", shape: "dot" }, ready: null,
};

export function Invoices({ d, id, locale }: { d: JobDetail; id: string; locale: Locale }) {
  const { t } = useTranslation();
  const j = (k: string, o?: Record<string, unknown>) => t(`job.${k}`, o) as string;
  const toast = useToast();
  const client = useQueryClient();
  const now = useMemo(() => new Date(), []);
  const [busy, setBusy] = useState<string | null>(null);
  const m = (cents: number) => money(cents / 100, locale, { cents: false });
  const pct = (n: number) => (locale === "fr-CA" ? `${n} %` : `${n}%`);
  const f = billingFigures(d, now);
  const rows = planRows(d);
  const ready = rows.find((r) => r.state === "ready");
  const draft = rows.find((r) => r.state === "draft" && r.invoice);

  const create = async (r: PlanRow) => {
    if (!r.milestoneId) return;
    setBusy(r.key);
    try {
      const res = await jobsApi.invoiceTerm(id, r.milestoneId);
      void client.invalidateQueries({ queryKey: ["job", id] });
      toast({ message: j("inv.created") });
      router.push(screenHref("Invoice", res.invoice.number, { id: res.invoice.id }));
    } catch (e) {
      toast({ message: e instanceof ApiFailure && e.status === 403 ? e.message : j("inv.createFailed") });
    } finally {
      setBusy(null);
    }
  };

  usePrimary({
    label: ready ? j("primary.invCreate", { n: ready.n ?? "" }) : draft?.invoice ? j("primary.invSend", { number: draft.invoice.number }) : j("primary.invNone"),
    run: () => (ready ? void create(ready) : draft?.invoice ? router.push(screenHref("Invoice", draft.invoice.number, { id: draft.invoice.id })) : router.push(screenHref("NewInvoice", j("inv.manual")))),
    busy: !!ready && busy === ready.key,
  });

  const meta = (r: PlanRow): string => {
    const share = r.pct != null ? pct(r.pct) : "";
    const number = r.invoice?.number ?? "";
    const lead = (s: string) => s.replace(/^ · /, "");
    if (r.state === "paid" && r.invoice) return lead(j("inv.paidOn", { pct: share, number, date: shortDate(new Date(r.invoice.dueDate), locale) }));
    if (r.state === "draft") return lead(j("inv.draftMeta", { pct: share, number }));
    if (r.invoice) return lead(j("inv.dueOn", { pct: share, number, date: shortDate(new Date(r.invoice.dueDate), locale) }));
    return lead(j("inv.dueWhenDone", { pct: share }));
  };

  const word = (r: PlanRow): string => (r.state === "late" && r.invoice ? j("inv.daysLate", { count: daysLate(r.invoice.dueDate, now) }) : j(`inv.status.${r.state === "ready" ? "open" : r.state}`));

  return (
    <>
      <Section pt={22} px={16}>
        <Card>
          <FigureCells cells={[
            { label: j("inv.invoiced"), value: m(f.invoicedCents), sub: j("inv.invoices", { count: f.invoiceCount }) },
            { label: j("inv.collected"), value: m(f.collectedCents), valueTone: "ok", sub: j("inv.paid", { count: f.paidCount }) },
            { label: j("inv.outstanding"), value: m(f.outstandingCents), valueTone: f.outstandingCents > 0 ? "bad" : "ink", sub: f.worstLate ? j("inv.lateBy", { number: f.worstLate.number, count: f.worstLate.days }) : j("inv.none") },
            { label: j("inv.toInvoice"), value: m(f.stillCents), sub: j("inv.termsLeft", { count: f.termsLeft }) },
          ]} />
        </Card>
      </Section>

      <Section pt={22} px={16}>
        <SectionHeader title={j("inv.plan")} link={j("inv.fromContract")} />
        {rows.length ? (
          <Card>
            <RowList>
              {rows.map((r) => {
                const look = LOOK[r.state];
                const title = r.n ? `${j("inv.term", { n: r.n })}${r.label ? ` · ${r.label}` : ""}` : r.label;
                const press = r.invoice ? () => router.push(screenHref("Invoice", r.invoice!.number, { id: r.invoice!.id })) : undefined;
                return (
                  <Press key={r.key} onPress={press} disabled={!press} accessibilityRole={press ? "button" : undefined} accessibilityLabel={title}
                    style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 16 }}>
                    <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
                      <Text size={14.5} weight={500} numberOfLines={1}>{title}</Text>
                      <Text size={12.5} color="muted" numberOfLines={2}>{meta(r)}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Num size={14.5} weight={600}>{m(r.cents)}</Num>
                      {r.state === "ready" ? <Button size="sm" label={j("inv.create")} busy={busy === r.key ? j("saving") : false} onPress={() => void create(r)} />
                        : look ? <Status tone={look.tone} shape={look.shape}>{word(r)}</Status> : null}
                    </View>
                  </Press>
                );
              })}
            </RowList>
          </Card>
        ) : <Card padded><Text size={13.5} color="muted">{j("inv.noPlan")}</Text></Card>}
        <View style={{ marginTop: 12 }}><Button kind="secondary" block label={j("inv.manual")} onPress={() => router.push(screenHref("NewInvoice", j("inv.manual")))} /></View>
      </Section>
    </>
  );
}
