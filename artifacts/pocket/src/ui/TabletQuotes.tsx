// Tablet.dc.html: Quotes at tablet width. The list (440 wide) shows plain rows that pick a quote (the picked one on the accent ground with a bar at the left);
// the rest of the screen shows that quote in two columns: scope and line items with the totals on the left; the client, the deposit and the activity on the
// right; the number, Duplicate, PDF and More at the top; the client, the total and the two actions for its state in a glass bar at the bottom.
import type { ReactNode } from "react";
import { Linking, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import { getListQuotesQueryKey } from "@workspace/api-client-react";
import { tintFor } from "@/lib/clients";
import { money, percent, shortDate, type Locale } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import { screenHref } from "@/lib/nav";
import { taxName } from "@/lib/quoteBar";
import { depositAmount, depositTerm } from "@/lib/quoteMath";
import { quoteApi, type QuoteFull } from "@/lib/quoteApi";
import { jobLine, quoteState, validUntil, type QuoteState } from "@/lib/quotes";
import { API_ORIGIN } from "@/lib/session";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { Card } from "./Card";
import { Empty, Skeleton, useToast } from "./Feedback";
import { IconButton } from "./Header";
import { Glyph } from "./Icon";
import { Press } from "./motion";
import { ScopeCard } from "./Quote";
import { SectionHeader } from "./Row";
import { Status, type StatusShape, type StatusTone } from "./Status";
import { Num, Text } from "./Text";
import { useTheme } from "./theme";

export const STATUS: Record<QuoteState, { tone: StatusTone; shape: StatusShape }> = {
  draft: { tone: "mute", shape: "draft" }, sent: { tone: "info", shape: "q1" }, viewed: { tone: "acc", shape: "q2" }, expiring: { tone: "warn", shape: "clock" },
  accepted: { tone: "ok", shape: "check" }, declined: { tone: "bad", shape: "x" }, expired: { tone: "mute", shape: "off" },
};

/** The list beside the quote, and the quote. */
export function Split({ list, detail }: { list: ReactNode; detail: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      <View style={{ width: 440, borderRightWidth: 1, borderRightColor: colors.line }}>{list}</View>
      <View style={{ flex: 1, minWidth: 0 }}>{detail}</View>
    </View>
  );
}

/** A row of the tablet list: avatar, client, "when · job", amount and status; picked on the accent ground with the bar at the left. */
export function PickRow({ initials, tint, client, sub, amount, status, on, onPress, first }: { initials: string; tint: number; client: string; sub: string; amount: string; status: ReactNode; on: boolean; onPress: () => void; first?: boolean }) {
  const { colors } = useTheme();
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingLeft: 16, paddingRight: 14, minHeight: 44, backgroundColor: on ? colors["acc-soft"] : "transparent", ...(first ? null : { borderTopWidth: 1, borderTopColor: colors.line }) }}>
      {on ? <View style={{ position: "absolute", left: 0, top: 10, bottom: 10, width: 3, borderTopRightRadius: 3, borderBottomRightRadius: 3, backgroundColor: colors.acc }} /> : null}
      <Avatar initials={initials} tint={tint as never} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text size={14.5} weight={500} numberOfLines={1}>{client}</Text>
        <Text size={12.5} color="muted" numberOfLines={1}>{sub}</Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Num size={14.5} weight={600}>{amount}</Num>
        {status}
      </View>
    </Press>
  );
}

function Activity({ items }: { items: { text: string; when: string; sub: string; on: boolean }[] }) {
  const { colors } = useTheme();
  return (
    <Card style={{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: 4 }}>
      {items.map((e, i) => (
        <View key={i} style={{ paddingLeft: 24, paddingBottom: 16 }}>
          <View style={{ position: "absolute", left: 3, top: 5, width: 9, height: 9, borderRadius: 5, ...(e.on ? { backgroundColor: colors.acc } : { borderWidth: 1.5, borderColor: colors.line2, backgroundColor: colors.card }) }} />
          {i < items.length - 1 ? <View style={{ position: "absolute", left: 7, top: 18, bottom: 2, width: 1, backgroundColor: colors.line2 }} /> : null}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <Text size={13.5} weight={500} leading={1.35} style={{ flexShrink: 1 }}>{e.text}</Text>
            <Text size={11.5} color="faint">{e.when}</Text>
          </View>
          <Text size={12.5} color="muted" style={{ marginTop: 2 }}>{e.sub}</Text>
        </View>
      ))}
    </Card>
  );
}

/** The quote beside the list. */
export function QuotePane({ id }: { id: string | null }) {
  const { t, i18n } = useTranslation();
  const b = (k: string, o?: Record<string, unknown>) => t(`tb.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { colors } = useTheme();
  const toast = useToast();
  const client = useQueryClient();
  const q = useQuery({ queryKey: ["quote", id], queryFn: () => quoteApi.get(id!), enabled: !!id, retry: 1, staleTime: 15_000 });
  if (!id) return <View style={{ flex: 1, justifyContent: "center" }}><Empty icon="doc" iconTone="slate" title={b("pane.pick")} body={b("pane.pickBody")} /></View>;
  if (!q.data) return <View style={{ padding: 28, gap: 14 }}><Skeleton width={160} height={14} /><Skeleton width="60%" height={30} /><Skeleton height={300} radius={22} /></View>;
  const quote: QuoteFull = q.data;
  const now = new Date();
  const state = quoteState({ status: quote.status, sentAt: quote.sentAt, acceptedAt: quote.acceptedAt, firstViewedAt: quote.firstViewedAt, declinedAt: quote.declinedAt, validDays: quote.validDays }, now);
  const m = (n: number) => money(n, locale);
  const d = (iso: string) => shortDate(new Date(iso), locale);
  const cd = quote.clientData;
  const first = cd.nome.trim().split(/\s+/)[0] ?? cd.nome;
  const title = (quote.titoloPreventivoRiga1 && quote.titoloPreventivoRiga1 !== "Project Quote & Itemized Estimate" ? quote.titoloPreventivoRiga1 : jobLine(quote)) || t("quote.untitled");
  const until = d(validUntil(quote.sentAt ?? now.toISOString(), quote.validDays).toISOString());
  const statusLine = state === "draft" ? b("pane.notSent", { date: until }) : state === "accepted" ? d(quote.acceptedAt ?? quote.updatedAt) : state === "declined" ? d(quote.declinedAt ?? quote.updatedAt) : quote.sentAt ? d(quote.sentAt) : "";
  const lines = quote.capitoli.flatMap((c) => c.voci.map((v) => {
    const qty = Number(v.quantita), price = Number(v.prezzoUnitario);
    return { name: v.descrizione.split("\n")[0]!, amt: m(Math.round(qty * price * 100) / 100), detail: [v.um ? `${m(price)} / ${v.um}` : m(price), v.um ? `${new Intl.NumberFormat(locale).format(qty)} ${v.um}` : "", v.descrizione.split("\n")[1] ?? ""].filter(Boolean).join(" · ") };
  }));
  const taxLabel = `${quote.taxLines?.length ? quote.taxLines.map((l) => l.label ?? l.code).join(" + ") : taxName(quote.province) ?? t("quote.tax")} ${percent(Number(quote.ivaPercentuale) / 100, locale, Number(quote.ivaPercentuale) % 1 ? 3 : 0)}`;
  const total = m(quote.totale);
  const cut = total.search(/[.,]\d\d(?: \$)?$/);
  const [whole, cents] = cut > 0 ? [total.slice(0, cut), total.slice(cut)] : [total, ""];
  const dep = depositTerm(quote.paymentSchedule ?? null);
  const events = [
    quote.acceptedAt ? { text: b("event.accepted"), when: d(quote.acceptedAt), sub: b("event.acceptedSub") } : null,
    quote.declinedAt ? { text: b("event.declined"), when: d(quote.declinedAt), sub: b("event.declinedSub") } : null,
    state === "expired" ? { text: b("event.expired"), when: until, sub: b("event.expiredSub") } : null,
    quote.firstViewedAt ? { text: b("event.viewed", { name: first }), when: d(quote.firstViewedAt), sub: b("event.viewedSub") } : null,
    quote.sentAt ? { text: b("event.sent"), when: d(quote.sentAt), sub: b("event.sentSub") } : null,
    { text: b("event.created"), when: d(quote.createdAt), sub: b("event.createdSub") },
  ].filter(Boolean).map((e, i) => ({ ...e!, on: i === 0 }));

  const open = () => router.push(screenHref("Quote", t("quotes.actions.openQuote"), { id: quote.id }));
  const refresh = () => { void client.invalidateQueries({ queryKey: ["quote", quote.id] }); void client.invalidateQueries({ queryKey: getListQuotesQueryKey() }); };
  const run = (p: Promise<unknown>, done: string) => p.then(() => { refresh(); toast({ message: done }); }).catch(() => toast({ message: b("pane.failed") }));
  const dup = () => run(quoteApi.duplicate(quote.id), b("pane.duplicated"));
  // The same actions as the list's for each state (the phone's Quotes screen), named as the board names them.
  const [secondary, primary]: [{ label: string; run: () => void }, { label: string; run: () => void }] =
    state === "draft" ? [{ label: b("act.preview"), run: () => void Linking.openURL(`${API_ORIGIN}/p/${quote.id}?preview=1`) }, { label: b("act.send"), run: open }]
    : state === "accepted" ? [{ label: b("act.invoiceDeposit"), run: () => router.push(screenHref("Invoices", t("menu.rows.invoices.label"))) }, { label: quote.jobId ? b("act.openJob") : b("act.startJob"), run: () => router.push(quote.jobId ? screenHref("Job", b("act.openJob"), { id: quote.jobId }) : screenHref("JobSetup", b("act.startJob"), { quoteId: quote.id })) }]
    : state === "declined" || state === "expired" ? [{ label: b("act.archive"), run: () => void run(quoteApi.archive(quote.id), b("pane.archived")) }, { label: b("act.revive"), run: () => void dup() }]
    : [{ label: b("act.markWon"), run: () => void run(quoteApi.markWon(quote.id), b("pane.won")) }, { label: b("act.followUp"), run: open }];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 18, paddingLeft: 28, paddingRight: 20, height: 60 }}>
          <Text size={12.5} color="muted" style={{ flex: 1 }}>{quote.numeroPreventivoData?.trim() ?? ""}</Text>
          <Button kind="secondary" size="sm" label={b("pane.duplicate")} onPress={() => void dup()} />
          <Button kind="secondary" size="sm" label={b("pane.pdf")} onPress={() => void Linking.openURL(`${API_ORIGIN}/p/${quote.id}?preview=1`)} />
          <IconButton glyph="more" label={b("pane.more")} onPress={open} />
        </View>
        <View style={{ paddingTop: 10, paddingHorizontal: 28 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Status tone={STATUS[state].tone} shape={STATUS[state].shape}>{t(`quote.status.${state}`)}</Status>
            <Text size={12.5} color="muted">{statusLine}</Text>
          </View>
          <Text size={28} weight={600} tracking={-0.04} leading={1.15} accessibilityRole="header" style={{ marginTop: 12 }}>{title}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 20, paddingTop: 20, paddingHorizontal: 28, alignItems: "flex-start" }}>
          <View style={{ flex: 1.55, minWidth: 0, gap: 14 }}>
            {quote.descrizioneGenerale ? <ScopeCard title={b("pane.scope")} text={quote.descrizioneGenerale} editLabel={b("pane.edit")} onEdit={() => router.push(screenHref("QuoteEditor", b("pane.edit"), { id: quote.id }))} /> : null}
            <View>
              <SectionHeader title={b("pane.lines")} link={String(lines.length)} />
              <Card style={{ overflow: "hidden" }}>
                {lines.map((l, i) => (
                  <View key={i} style={{ paddingVertical: 13, paddingHorizontal: 18, gap: 4, ...(i ? { borderTopWidth: 1, borderTopColor: colors.line } : null) }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                      <Text size={14.5} weight={500} style={{ flexShrink: 1 }}>{l.name}</Text>
                      <Num size={14.5} weight={500}>{l.amt}</Num>
                    </View>
                    <Text size={12.5} color="muted">{l.detail}</Text>
                  </View>
                ))}
                <View style={{ paddingVertical: 14, paddingHorizontal: 18, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.soft, gap: 7 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text size={13.5} color="muted">{b("pane.subtotal")}</Text><Num size={13.5}>{m(quote.subtotale)}</Num></View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text size={13.5} color="muted">{taxLabel}</Text><Num size={13.5}>{m(quote.ivaValore)}</Num></View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingTop: 9, borderTopWidth: 1, borderTopColor: colors.line }}>
                    <Text size={15} weight={500}>{b("pane.total")}</Text>
                    <Num size={28} weight={600} tracking={-0.04} accessibilityLabel={`${b("pane.total")} ${total}`}>{whole}<Num size={17} weight={600} color="faint" tracking={-0.01}>{cents}</Num></Num>
                  </View>
                </View>
              </Card>
            </View>
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 14 }}>
            <Card style={{ overflow: "hidden" }}>
              <Press onPress={() => quote.clientId ? router.push(screenHref("Client", cd.nome, { id: quote.clientId })) : undefined} accessibilityRole="link"
                style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16, minHeight: 44 }}>
                <Avatar initials={initialsOf(cd.nome)} tint={tintFor(cd.nome)} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text size={14.5} weight={500} numberOfLines={1}>{cd.nome}</Text>
                  <Text size={12.5} color="muted" numberOfLines={1}>{[cd.indirizzo, cd.city].filter(Boolean).join(", ")}</Text>
                </View>
                <Glyph name="chevron" size={16} color="faint" />
              </Press>
              <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 16 }}>
                <View style={{ flex: 1 }}><Button kind="secondary" size="sm" block label={b("pane.call")} disabled={!cd.phone} onPress={() => void Linking.openURL(`tel:${cd.phone}`)} /></View>
                <View style={{ flex: 1 }}><Button kind="secondary" size="sm" block label={b("pane.message")} disabled={!cd.phone && !cd.email} onPress={() => void Linking.openURL(cd.phone ? `sms:${cd.phone}` : `mailto:${cd.email}`)} /></View>
              </View>
            </Card>
            <Card style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 10 }}>
              {dep ? (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <View style={{ gap: 2, flexShrink: 1 }}>
                    <Text size={14.5} weight={500}>{b("pane.deposit", { pct: dep.amountType === "percent" ? percent(dep.value / 100, locale) : m(dep.value) })}</Text>
                    <Text size={12.5} color="muted">{b("pane.depositHow")}</Text>
                  </View>
                  <Num size={15} weight={600}>{m(depositAmount(quote.paymentSchedule ?? null, quote.totale) ?? 0)}</Num>
                </View>
              ) : null}
              <View style={{ flexDirection: "row", justifyContent: "space-between", ...(dep ? { paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line } : null) }}>
                <Text size={12.5} color="muted">{state === "accepted" || state === "declined" || state === "expired" ? t(`quote.status.${state}`) : b("pane.validUntil")}</Text>
                <Text size={12.5}>{state === "accepted" || state === "declined" ? statusLine : until}</Text>
              </View>
            </Card>
            <View>
              <SectionHeader title={b("pane.activity")} />
              <Activity items={events} />
            </View>
          </View>
        </View>
      </ScrollView>
      <View style={{ position: "absolute", left: 28, right: 28, bottom: 24, borderRadius: 24, overflow: "hidden", boxShadow: `0 10px 30px -8px ${colors.shadow}, 0 0 0 1px ${colors.ring}` }}>
        <BlurView intensity={40} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingRight: 8, paddingLeft: 20, backgroundColor: colors.glass }}>
          <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
            <Text size={12.5} color="muted" numberOfLines={1}>{cd.nome}</Text>
            <Num size={17} weight={600}>{total}</Num>
          </View>
          <Button kind="secondary" size="md" label={secondary.label} onPress={secondary.run} />
          <View style={{ minWidth: 180 }}><Button size="md" block label={primary.label} onPress={primary.run} /></View>
        </BlurView>
      </View>
    </View>
  );
}
