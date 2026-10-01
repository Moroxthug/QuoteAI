// Job.dc.html, the Messages tab: the client portal card (when the client last opened it, "Copy link") and the conversation with the client about this
// job: theirs on the left in a `card` bubble, yours on the right in `inv`, a day label between days, and the message box. Messages go to the client by email
// with the portal link, like the web app's. A message written without a job belongs to the client; the thread shows this job's and the general ones.
import { useMemo, useState } from "react";
import { TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clientsApi, type PortalMessage } from "@/lib/clientsApi";
import { relativeWhen, time, type Locale } from "@/lib/format";
import type { JobDetail } from "@/lib/jobDetail";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Skeleton, useToast } from "@/ui/Feedback";
import { geist } from "@/ui/fonts";
import { Glyph, Icon } from "@/ui/Icon";
import { Section } from "@/ui/Layout";
import { Press } from "@/ui/motion";
import { Text } from "@/ui/Text";
import { useTheme } from "@/ui/theme";
import { usePrimary } from "./primary";

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function Messages({ d, id, locale }: { d: JobDetail; id: string; locale: Locale }) {
  const { t } = useTranslation();
  const j = (k: string, o?: Record<string, unknown>) => t(`job.${k}`, o) as string;
  const { colors } = useTheme();
  const toast = useToast();
  const client = useQueryClient();
  const clientId = d.job.clientId;
  const first = (d.job.client?.name ?? "").trim().split(/\s+/)[0] ?? "";
  const portal = useQuery({ queryKey: ["client-portal", clientId], queryFn: () => clientsApi.portal(clientId!), enabled: !!clientId, retry: 0, staleTime: 30_000 });
  const thread = useQuery({ queryKey: ["client-thread", clientId], queryFn: () => clientsApi.messages(clientId!), enabled: !!clientId, retry: 1, staleTime: 15_000 });
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const now = useMemo(() => new Date(), []);

  const send = async () => {
    if (!clientId || !text.trim() || sending) return;
    setSending(true);
    try {
      await clientsApi.send(clientId, text.trim(), id);
      setText("");
      void client.invalidateQueries({ queryKey: ["client-thread", clientId] });
    } catch {
      toast({ message: j("failed") });
    } finally {
      setSending(false);
    }
  };
  usePrimary({ label: j("primary.msg"), run: () => void send(), disabled: !text.trim() || !clientId, busy: sending });

  const copy = async () => {
    if (!portal.data?.url) return;
    await Clipboard.setStringAsync(portal.data.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const msgs = (thread.data?.messages ?? []).filter((m) => !m.jobId || m.jobId === id).slice().sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  const seen = portal.data?.lastSeenAt ? relativeWhen(new Date(portal.data.lastSeenAt), now, locale) : null;

  const bubble = (m: PortalMessage) => {
    const mine = m.sender === "contractor";
    return (
      <View key={m.id} style={{ gap: 4, alignItems: mine ? "flex-end" : "flex-start" }}>
        <View style={{ maxWidth: "80%", paddingVertical: 10, paddingHorizontal: 13, borderRadius: 18, backgroundColor: mine ? colors.inv : colors.card, boxShadow: mine ? undefined : `0 0 0 1px ${colors.ring}`, borderBottomRightRadius: mine ? 6 : 18, borderBottomLeftRadius: mine ? 18 : 6 }}>
          <Text size={14.5} leading={1.4} color={mine ? "on-inv" : "ink"}>{m.body}</Text>
        </View>
        <Text size={11.5} color="faint" style={{ paddingHorizontal: 6 }}>{`${m.senderName.split(" ")[0] ?? ""} · ${time(new Date(m.createdAt), locale)}${mine && m.readAt ? ` · ${j("msg.read")}` : ""}`}</Text>
      </View>
    );
  };

  if (!clientId) {
    return <Section pt={22} px={16}><Card padded><Text size={13.5} color="muted">{j("quick.noClient")}</Text></Card></Section>;
  }

  return (
    <>
      <Section pt={22} px={16}>
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16 }}>
            <Icon name="globe" tone="azure" size={28} />
            <View style={{ flexGrow: 1, flexShrink: 1, gap: 2 }}>
              <Text size={14.5} weight={500}>{j("msg.portal")}</Text>
              <Text size={12.5} color="muted">{portal.data ? (seen ? j("msg.opened", { name: first, when: seen }) : j("msg.notOpened")) : j("msg.portalSub")}</Text>
            </View>
            {portal.data?.url ? <Button kind="secondary" size="sm" label={copied ? j("msg.copied") : j("msg.copy")} onPress={() => void copy()} /> : null}
          </View>
        </Card>
      </Section>

      <Section pt={22} px={16} gap={8}>
        {thread.isPending && !thread.data ? <Skeleton height={120} radius={18} /> : msgs.length ? (
          msgs.map((m, i) => {
            const at = new Date(m.createdAt);
            const prev = msgs[i - 1] ? new Date(msgs[i - 1]!.createdAt) : null;
            const label = !prev || !sameDay(prev, at) ? (sameDay(at, now) ? j("msg.today") : sameDay(at, new Date(now.getTime() - 86_400_000)) ? j("msg.yesterday") : relativeWhen(at, now, locale)) : null;
            return (
              <View key={m.id} style={{ gap: 8 }}>
                {label ? <Text size={11.5} color="faint" align="center" style={{ marginTop: i ? 6 : 0 }}>{label}</Text> : null}
                {bubble(m)}
              </View>
            );
          })
        ) : <Card padded><Text size={13.5} color="muted">{j("msg.empty")}</Text></Card>}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 50, borderRadius: 25, backgroundColor: colors.card, boxShadow: `0 0 0 1px ${colors.line2}`, paddingLeft: 16, paddingRight: 6, marginTop: 10 }}>
          <TextInput value={text} onChangeText={setText} placeholder={j("msg.composePlaceholder", { name: first })} placeholderTextColor={colors.faint} accessibilityLabel={j("msg.composeLabel")}
            style={{ flexGrow: 1, minWidth: 0, fontSize: 15, color: colors.ink, fontFamily: geist(400) }} onSubmitEditing={() => void send()} returnKeyType="send" />
          <Press onPress={() => void send()} disabled={!text.trim() || sending} accessibilityRole="button" accessibilityLabel={j("msg.send")} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.inv, alignItems: "center", justifyContent: "center", opacity: text.trim() ? 1 : 0.4 }}>
            <Glyph name="arrowUp" size={16} color="on-inv" weight={2.2} />
          </Press>
        </View>
      </Section>
    </>
  );
}
