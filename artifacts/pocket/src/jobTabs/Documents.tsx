// Job.dc.html, the Documents tab: what exists for the job, each with a chevron: the signed contract, change orders, the quote, the invoices, the receipts and the
// permits. The server keeps these as records on the job, so the list is built from the job, not from files.
import { Linking } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { shortDate, type Locale } from "@/lib/format";
import type { JobDetail } from "@/lib/jobDetail";
import { jobsApi } from "@/lib/jobsApi";
import { screenHref } from "@/lib/nav";
import { Card } from "@/ui/Card";
import { Glyph, Icon, type IconName, type Tone } from "@/ui/Icon";
import { Section } from "@/ui/Layout";
import { RowBody, RowList } from "@/ui/Row";
import { Press } from "@/ui/motion";
import { Text } from "@/ui/Text";
import { useQuery } from "@tanstack/react-query";
import { usePrimary } from "./primary";

type Doc = { key: string; icon: IconName; tone: Tone; title: string; meta: string; onPress: () => void };

export function Documents({ d, id, locale, onTab }: { d: JobDetail; id: string; locale: Locale; onTab: (tab: "costs" | "inv" | "co") => void }) {
  const { t } = useTranslation();
  const j = (k: string, o?: Record<string, unknown>) => t(`job.${k}`, o) as string;
  const permits = useQuery({ queryKey: ["job-permits", id], queryFn: () => jobsApi.permits(id), retry: 0, staleTime: 30_000 });
  usePrimary({ label: j("primary.docs"), run: () => router.push(screenHref("Documents", j("tabs.docs"))) });

  const docs: Doc[] = [];
  const c = d.job.contract;
  if (c) docs.push({ key: "contract", icon: "doc", tone: "violet", title: j("docs.contract", { number: c.contractNumber }), meta: c.signedAt ? j("docs.signedBy", { name: c.customerName, date: shortDate(new Date(c.signedAt), locale) }) : c.status, onPress: () => router.push(screenHref("Contract", c.contractNumber, { id: c.id })) });
  for (const co of d.changeOrders) docs.push({ key: co.id, icon: "pen", tone: "indigo", title: j("docs.changeOrder", { number: co.number }), meta: co.signedAt ? j("docs.signedOn", { date: shortDate(new Date(co.signedAt), locale) }) : j(`co.status.${co.status}`), onPress: () => router.push(screenHref("ChangeOrder", co.title, { id: co.id, jobId: id })) });
  if (d.job.quote) docs.push({ key: "quote", icon: "file", tone: "slate", title: j("docs.quote", { number: d.job.quote.number }), meta: j("docs.acceptedOn", { date: shortDate(new Date(d.job.createdAt), locale) }), onPress: () => router.push(screenHref("Quote", d.job.quote!.number, { id: d.job.quote!.id })) });
  const invoices = d.invoices.filter((i) => i.status !== "void");
  if (invoices.length) docs.push({ key: "invoices", icon: "card", tone: "teal", title: j("docs.invoices"), meta: j("docs.invoicesMeta", { count: invoices.length }), onPress: () => onTab("inv") });
  const receipts = d.costs.entries.filter((e) => e.sourceDocumentId).length;
  if (receipts) docs.push({ key: "receipts", icon: "receipt", tone: "amber", title: j("docs.receipts"), meta: j("docs.filesMeta", { count: receipts }), onPress: () => onTab("costs") });
  for (const p of permits.data?.permits ?? []) docs.push({ key: p.id, icon: "shield", tone: "azure", title: p.title, meta: [j("docs.permit"), p.authority].filter(Boolean).join(" · "), onPress: () => { if (p.url) void Linking.openURL(p.url); } });

  return (
    <Section pt={22} px={16}>
      {docs.length ? (
        <Card>
          <RowList>
            {docs.map((x) => (
              <Press key={x.key} onPress={x.onPress} accessibilityRole="button" accessibilityLabel={x.title}>
                <RowBody leading={<Icon name={x.icon} tone={x.tone} size={28} />} title={x.title} meta={x.meta} trailing={<Glyph name="chevron" size={15} color="faint" weight={2} />} />
              </Press>
            ))}
          </RowList>
        </Card>
      ) : <Card padded><Text size={13.5} color="muted">{j("docs.empty")}</Text></Card>}
    </Section>
  );
}
