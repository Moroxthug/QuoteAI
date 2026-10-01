// Job.dc.html, the Costs tab: "Scan a receipt" (a photo is read for the vendor, tax and category), the receipts waiting for a look with
// Confirm, every confirmed cost, and budget against actual. The photo goes up as the job's receipt and comes back as a pending entry.
import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { dateOnly } from "@/lib/jobs";
import { money, shortDate, type Locale } from "@/lib/format";
import type { CostCategory, CostEntry, JobDetail } from "@/lib/jobDetail";
import { budgetBars } from "@/lib/jobPage";
import { jobsApi } from "@/lib/jobsApi";
import { uploadFile } from "@/lib/jobUpload";
import { choosePhotos, takePhoto, type PickResult } from "@/lib/media";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Banner, useToast } from "@/ui/Feedback";
import { Glyph, Icon, type IconName, type Tone } from "@/ui/Icon";
import { BudgetBars } from "@/ui/JobPage";
import { Section } from "@/ui/Layout";
import { Press } from "@/ui/motion";
import { MenuList, MenuRow, RowBody, RowList, SectionHeader } from "@/ui/Row";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Num, Text } from "@/ui/Text";
import { usePrimary } from "./primary";

const ICON: Record<CostCategory, [IconName, Tone]> = { materials: ["box", "amber"], labour: ["clock", "teal"], subcontractor: ["hammer", "clay"], permits_fees: ["shield", "azure"], equipment: ["truck", "slate"], misc: ["pin", "stone"] };
const SOURCE: Record<string, string> = { receipt: "receipt", time_entry: "time", bank_feed: "bank", manual: "manual", equipment: "equipment", legacy: "other", allowance: "other" };

export function Costs({ d, id, locale }: { d: JobDetail; id: string; locale: Locale }) {
  const { t } = useTranslation();
  const j = (k: string, o?: Record<string, unknown>) => t(`job.${k}`, o) as string;
  const toast = useToast();
  const client = useQueryClient();
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const m = (cents: number, withCents = true) => money(cents / 100, locale, { cents: withCents });
  const refresh = () => { void client.invalidateQueries({ queryKey: ["job", id] }); void client.invalidateQueries({ queryKey: ["jobs"] }); };

  const upload = async (r: PickResult) => {
    setScan(false);
    if (!r.ok) { toast({ message: r.problem === "denied" ? j("quick.denied") : j("quick.unavailable") }); return; }
    if (!r.files.length) return;
    setBusy("scan");
    toast({ message: j("costs.reading") });
    const res = await uploadFile("/api/costs/receipts", "file", r.files[0]!, { projectId: id });
    setBusy(null);
    if (res.ok) { refresh(); toast({ message: j("costs.scanned") }); } else toast({ message: j("costs.scanFailed") });
  };

  usePrimary({ label: j("primary.costs"), run: () => setScan(true), busy: busy === "scan" });

  const confirm = async (e: CostEntry) => {
    setBusy(e.id);
    try {
      await jobsApi.confirmCost(id, e.id);
      setDone((s) => new Set(s).add(e.id));
      refresh();
    } catch {
      toast({ message: j("failed") });
    } finally {
      setBusy(null);
    }
  };

  const review = d.costs.entries.filter((e) => e.status === "pending_review" && !done.has(e.id));
  const entries = d.costs.entries.filter((e) => e.status === "confirmed" || done.has(e.id));
  const bars = budgetBars(d);
  const used = d.budgetTotalCents > 0 ? Math.round((d.costs.totalCents / d.budgetTotalCents) * 100) : null;
  const pct = (n: number) => (locale === "fr-CA" ? `${n} %` : `${n}%`);

  return (
    <>
      <Section pt={22} px={16}>
        <Card>
          <Press onPress={() => setScan(true)} accessibilityRole="button" accessibilityLabel={j("costs.scan")} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16 }}>
            <Icon name="camera" tone="amber" size={30} />
            <View style={{ flexGrow: 1, flexShrink: 1, gap: 2 }}>
              <Text size={14.5} weight={500}>{j("costs.scan")}</Text>
              <Text size={12.5} color="muted">{j("costs.scanSub")}</Text>
            </View>
            <Glyph name="chevron" size={15} color="faint" weight={2} />
          </Press>
        </Card>
      </Section>

      <Section pt={22} px={16}>
        <SectionHeader title={j("costs.review")} link={review.length ? j("costs.receipts", { count: review.length }) : undefined} />
        {review.length ? (
          <Card>
            <RowList>
              {review.map((e) => {
                const conf = e.aiExtraction?.confidence;
                return (
                  <RowBody key={e.id} leading={<Icon name="receipt" tone={ICON[e.category][1]} size={28} />} title={e.vendor || e.description || j(`budget.categories.${e.category}`)}
                    meta={[j(`budget.categories.${e.category}`), conf ? j(`costs.confidence.${conf}`) : ""].filter(Boolean).join(" · ")}
                    trailingRow trailing={<><Num size={14.5} weight={600}>{m(e.totalCents)}</Num><Button size="sm" label={j("costs.confirm")} busy={busy === e.id ? j("saving") : false} onPress={() => void confirm(e)} /></>} />
                );
              })}
            </RowList>
          </Card>
        ) : <Banner tone="ok" icon="check" iconTone="sage" lead={j("costs.doneLead")}>{j("costs.doneBody")}</Banner>}
      </Section>

      <Section pt={22} px={16}>
        <SectionHeader title={j("costs.entries")} link={j("costs.byCategory")} />
        {entries.length ? (
          <Card>
            <RowList>
              {entries.map((e) => (
                <RowBody key={e.id} leading={<Icon name={ICON[e.category][0]} tone={ICON[e.category][1]} size={28} />} title={e.vendor || e.description || j(`budget.categories.${e.category}`)}
                  meta={j("costs.entryMeta", { category: j(`budget.categories.${e.category}`), source: j(`costs.source.${SOURCE[e.source] ?? "other"}`), date: shortDate(dateOnly(e.date), locale) })}
                  trailing={<Num size={14.5} weight={500}>{m(e.totalCents)}</Num>} />
              ))}
            </RowList>
          </Card>
        ) : <Card padded><Text size={13.5} color="muted">{j("costs.noEntries")}</Text></Card>}
      </Section>

      <Section pt={22} px={16}>
        <SectionHeader title={j("costs.budget")} link={used != null ? j("costs.used", { pct: pct(used) }) : undefined} />
        {bars.length ? (
          <BudgetBars rows={bars.map((b) => ({ name: j(`budget.categories.${b.category}`), spent: m(b.spentCents, false), planned: m(b.plannedCents, false), ratio: b.ratio, tone: b.tone }))} mark={d.job.progressPercent / 100} markLabel={j("budget.mark", { pct: pct(d.job.progressPercent) })} />
        ) : <Card padded><Text size={13.5} color="muted">{j("budget.empty")}</Text></Card>}
      </Section>

      <Sheet open={scan} onClose={() => setScan(false)} label={j("costs.scanTitle")} closeLabel={t("close")}>
        <SheetTitle>{j("costs.scanTitle")}</SheetTitle>
        <MenuList>
          <MenuRow icon={<Icon name="camera" tone="amber" size={28} />} title={j("costs.takePhoto")} chevron={false} onPress={() => void takePhoto("receipt").then(upload)} />
          <MenuRow icon={<Icon name="photo" tone="sky" size={28} />} title={j("costs.choosePhoto")} chevron={false} onPress={() => void choosePhotos(1, "receipt").then(upload)} />
        </MenuList>
      </Sheet>
    </>
  );
}
