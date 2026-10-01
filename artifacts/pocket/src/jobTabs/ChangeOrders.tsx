// Job.dc.html, the Change orders tab: each change order with its amount and where it stands (Draft, Waiting for the client, Signed,
// Declined, Voided), the signed total and days added in the header, and "New change order". A row opens the change order.
import { View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { money, shortDate, type Locale } from "@/lib/format";
import type { ChangeOrderRow, ChangeOrderStatus, JobDetail } from "@/lib/jobDetail";
import { screenHref } from "@/lib/nav";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Glyph } from "@/ui/Icon";
import { Section } from "@/ui/Layout";
import { RowList, SectionHeader } from "@/ui/Row";
import { Press } from "@/ui/motion";
import { Status, type StatusShape, type StatusTone } from "@/ui/Status";
import { Num, Text } from "@/ui/Text";
import { usePrimary } from "./primary";

const LOOK: Record<ChangeOrderStatus, { tone: StatusTone; shape: StatusShape }> = {
  draft: { tone: "mute", shape: "draft" }, sent: { tone: "info", shape: "q1" }, signed: { tone: "ok", shape: "check" }, declined: { tone: "bad", shape: "x" }, voided: { tone: "mute", shape: "off" },
};

export function ChangeOrders({ d, id, locale }: { d: JobDetail; id: string; locale: Locale }) {
  const { t } = useTranslation();
  const j = (k: string, o?: Record<string, unknown>) => t(`job.${k}`, o) as string;
  const m = (cents: number) => money(cents / 100, locale, { cents: false });
  const create = () => router.push(screenHref("ChangeOrder", j("co.new"), { jobId: id }));
  usePrimary({ label: j("primary.co"), run: create });

  const days = (n: number) => (n > 0 ? j("co.days", { count: n }) : n < 0 ? j("co.daysLess", { count: n }) : "");
  const signed = d.changeOrders.filter((c) => c.status === "signed");
  const signedCents = signed.reduce((n, c) => n + c.totalCents, 0);
  const signedDays = signed.reduce((n, c) => n + c.scheduleDeltaDays, 0);
  const head = signed.length ? j("co.signedAdd", { amount: m(signedCents), days: days(signedDays) || j("co.days", { count: 0 }) }) : j("co.signedNone");
  const when = (c: ChangeOrderRow) => (c.status === "signed" && c.signedAt ? j("co.signedOn", { date: shortDate(new Date(c.signedAt), locale) }) : c.status === "draft" ? j("co.draftOn", { date: shortDate(new Date(c.createdAt), locale) }) : j("co.sentOn", { date: shortDate(new Date(c.createdAt), locale) }));

  return (
    <Section pt={22} px={16}>
      <SectionHeader title={j("co.title")} link={head} />
      {d.changeOrders.length ? (
        <Card>
          <RowList>
            {d.changeOrders.map((c) => (
              <Press key={c.id} onPress={() => router.push(screenHref("ChangeOrder", c.title, { id: c.id, jobId: id }))} accessibilityRole="button" accessibilityLabel={`${c.number}, ${c.title}`}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16 }}>
                <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
                  <Text size={14.5} weight={500} numberOfLines={1}>{c.title}</Text>
                  <Text size={12.5} color="muted" numberOfLines={1}>{j("co.meta", { number: c.number, days: days(c.scheduleDeltaDays) || j("co.days", { count: 0 }), when: when(c) })}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Num size={14.5} weight={600}>{m(c.totalCents)}</Num>
                  <Status tone={LOOK[c.status].tone} shape={LOOK[c.status].shape}>{j(`co.status.${c.status === "sent" ? "sent" : c.status}`)}</Status>
                </View>
                <Glyph name="chevron" size={15} color="faint" weight={2} />
              </Press>
            ))}
          </RowList>
        </Card>
      ) : <Card padded><Text size={13.5} color="muted">{j("co.empty")}</Text></Card>}
      <View style={{ marginTop: 12 }}><Button kind="secondary" block label={j("co.new")} icon={<Glyph name="plus" size={14} weight={2.4} />} onPress={create} /></View>
    </Section>
  );
}
