// SystemStates.dc.html, "Offline and sync", the way the states appear inside screens: the offline banner, Sending and "Showing what was synced at",
// photos waiting for Wi-Fi, rejected by the server (Retry / Discard), conflict (Keep mine / Keep theirs per field, then Save my choices), new version
// ready (Reload) and server unreachable (Try again). `SyncStates` reads the outbox and the connection and shows whichever apply; the parts are
// exported for the sandbox.
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useIsFetching } from "@tanstack/react-query";
import { money, number, percent, sentence, time, type Locale } from "@/lib/format";
import { getNet, tryServer, useNet } from "@/lib/net";
import { clearCleared, clearPhotoDone, discard, flushPhotos, pick, retry, saveChoices, useOutbox, type Cleared, type PhotoState } from "@/lib/outbox";
import { allPicked, counts, groupOf, photoTotals, whyRejected, type FieldGroup, type Op } from "@/lib/sync";
import type { Schedule } from "@/lib/quoteMath";
import { Button, Spinner } from "./Button";
import { Card } from "./Card";
import { Banner, Empty } from "./Feedback";
import { Icon } from "./Icon";
import { Press } from "./motion";
import { Progress } from "./Numbers";
import { RowList } from "./Row";
import { Status } from "./Status";
import { Text } from "./Text";
import { useTheme } from "./theme";

type T = (k: string, o?: Record<string, unknown>) => string;
const useSyncT = (): { t: T; locale: Locale } => {
  const { t, i18n } = useTranslation();
  return { t: (k, o) => t(`sync.${k}`, o) as string, locale: i18n.language.startsWith("fr") ? "fr-CA" : "en-CA" };
};
const mb = (bytes: number, locale: Locale) => new Intl.NumberFormat(locale, { style: "unit", unit: "megabyte", maximumFractionDigits: bytes < 10e6 ? 1 : 0 }).format(bytes / 1e6);
const at = (iso: string, locale: Locale) => time(new Date(iso), locale);

/** "2 quote edits and a job note". */
export function summary(t: T, c: { quote: number; jobNote: number }): string {
  const parts = [c.quote ? t("what.quote", { count: c.quote }) : "", c.jobNote ? t("what.note", { count: c.jobNote }) : ""].filter(Boolean);
  return sentence(parts.length === 2 ? t("what.and", { a: parts[0], b: parts[1] }) : parts[0] ?? "");
}

function Row({ children, top, soft }: { children: React.ReactNode; top?: boolean; soft?: boolean }) {
  const { colors } = useTheme();
  return <View style={{ flexDirection: "row", alignItems: top ? "flex-start" : "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16, minHeight: 44, ...(soft ? { backgroundColor: colors.soft } : null) }}>{children}</View>;
}
function Lines({ title, sub, strong }: { title?: string; sub?: string; strong?: boolean }) {
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      {title ? <Text size={14.5} weight={strong ? 600 : 500}>{title}</Text> : null}
      {sub ? <Text size={12.5} color="muted" leading={1.4}>{sub}</Text> : null}
    </View>
  );
}

export function OfflineBanner({ waiting }: { waiting: number }) {
  const { t, locale } = useSyncT();
  return <Banner tone="warn" icon="cloud" iconTone="amber" lead={t("offline.lead")}>{`${t("offline.body")}${waiting ? ` ${t("offline.waiting", { count: waiting, formatted: number(waiting, locale) })}` : ""}`}</Banner>;
}

/** Sending (spinner, count, what) and "Showing what was synced at 9:41, updating". Either row alone when only one applies. */
export function SyncCard({ sending, what, syncedAt, updating }: { sending: number; what: string; syncedAt: number | null; updating: boolean }) {
  const { t, locale } = useSyncT();
  const { colors } = useTheme();
  if (!sending && syncedAt == null) return null;
  return (
    <Card style={{ overflow: "hidden" }}>
      <RowList>
        {[
          sending ? (
            <Row key="s">
              <View accessibilityRole="progressbar" accessibilityLabel={t("sending.label")}><Spinner color={colors.ink} /></View>
              <Lines title={t("sending.title", { count: sending })} sub={what} />
            </Row>
          ) : null,
          syncedAt != null ? (
            <Row key="a">
              <Icon name="sync" tone="sky" size={24} />
              <Text size={13.5} color="muted" style={{ flex: 1 }}>
                {t("synced", { time: "" })}<Text size={13.5}>{time(new Date(syncedAt), locale)}</Text>{updating ? t("updating") : ""}
              </Text>
            </Row>
          ) : null,
        ].filter(Boolean)}
      </RowList>
    </Card>
  );
}

export function PhotosCard({ state, count, bytes, job, doneCount, onSend }: { state: PhotoState; count: number; bytes: number; job: string; doneCount: number; onSend: () => void }) {
  const { t, locale } = useSyncT();
  const size = mb(bytes, locale);
  const title = state === "done" ? t("photos.done", { count: doneCount }) : t("photos.waiting", { count });
  const sub = state === "busy" ? t("photos.busy", { size }) : state === "done" ? t("photos.doneSub", { job }) : bytes ? t("photos.sub", { size, job }) : job;
  return (
    <Card style={{ overflow: "hidden" }}>
      <Row>
        <Icon name="photo" tone="sky" size={28} />
        <Lines title={title} sub={sub} />
        {state === "idle" ? <Button kind="secondary" size="sm" label={t("photos.send")} onPress={onSend} /> : null}
        {state === "done" ? <Status tone="info" shape="q1">{t("photos.sent")}</Status> : null}
      </Row>
      {state === "busy" ? <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}><Progress value={1} fill="acc" height={6} /></View> : null}
    </Card>
  );
}

/** "Lines and prices on Q-2026-119" with "$860.00 → $920.00 · 9:52" when the total moved, and why the server refused it. */
function rejectedLine(op: Op, t: T, locale: Locale): { what: string; from?: string; to?: string; why: string } {
  const why = t(`rejected.why.${whyRejected(op.rejected!)}`);
  if (op.kind === "jobNote") return { what: t("rejected.note", { ref: op.ref }), why };
  const group = groupOf(Object.keys(op.body)[0] ?? "");
  const moved = op.body.totale !== undefined && op.before?.totale !== undefined && Number(op.body.totale) !== Number(op.before.totale);
  return { what: t("rejected.quote", { field: t(`field.${group}`), ref: op.ref }), why, ...(moved ? { from: money(Number(op.before!.totale), locale), to: money(Number(op.body.totale), locale) } : null) };
}

export function RejectedCard({ ops, cleared, onRetry, onDiscard }: { ops: Op[]; cleared: Cleared; onRetry: (id: string) => void; onDiscard: (id: string) => void }) {
  const { t, locale } = useSyncT();
  const { colors } = useTheme();
  if (!ops.length && !cleared) return null;
  const none = !ops.length;
  return (
    <Card style={{ overflow: "hidden" }}>
      <RowList>
        {[
          <Row key="h" top>
            <Icon name="warn" tone="clay" size={28} />
            <Lines strong title={none ? t("rejected.noneTitle") : t("rejected.title", { count: ops.length })} sub={none ? t("rejected.noneSub") : t("rejected.sub")} />
          </Row>,
          ...ops.map((op) => {
            const l = rejectedLine(op, t, locale);
            return (
              <View key={op.id} style={{ paddingVertical: 14, paddingHorizontal: 16, paddingLeft: 56, gap: 12, backgroundColor: colors.soft }}>
                <View style={{ gap: 2 }}>
                  <Text size={14.5} weight={500}>{l.what}</Text>
                  <Text size={12.5} color="muted" leading={1.4}>
                    {l.from ? <>{l.from}{" → "}<Text size={12.5} leading={1.4}>{l.to}</Text>{" · "}</> : null}{at(op.at, locale)}
                  </Text>
                  <Text size={12.5} color="muted" leading={1.4}>{l.why}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}><Button kind="secondary" size="sm" block label={t("rejected.retry")} onPress={() => onRetry(op.id)} /></View>
                  <View style={{ flex: 1 }}><Button kind="destructive" size="sm" block label={t("rejected.discard")} onPress={() => onDiscard(op.id)} /></View>
                </View>
              </View>
            );
          }),
          none && cleared ? (
            <Row key="c">
              <Lines sub={cleared.how === "retried" ? t("rejected.retried", { time: at(cleared.at, locale) }) : t("rejected.discarded", { ref: cleared.ref })} />
            </Row>
          ) : null,
        ].filter(Boolean)}
      </RowList>
    </Card>
  );
}

/** One side of a conflicting field, as the person reads it. */
function shown(group: FieldGroup, src: Record<string, unknown>, t: T, locale: Locale): string {
  switch (group) {
    case "lines": return src.totale !== undefined ? money(Number(src.totale), locale) : t("conflict.none");
    case "schedule": {
      const dep = (src.paymentSchedule as Schedule | null | undefined)?.terms?.find((x) => x.type === "deposit");
      return dep ? (dep.amountType === "percent" ? percent(dep.value / 100, locale) : money(dep.value, locale)) : t("conflict.none");
    }
    case "exclusions": return t("conflict.exclusions", { count: Array.isArray(src.exclusions) ? src.exclusions.length : 0 });
    case "discount": { const d = src.sconto as { percentuale?: number } | null | undefined; return d?.percentuale ? percent(d.percentuale / 100, locale) : t("conflict.none"); }
    case "client": return (src.clientData as { nome?: string } | undefined)?.nome ?? t("conflict.none");
    case "terms": return Array.isArray(src.condizioniPagamento) ? String(src.condizioniPagamento[0] ?? t("conflict.none")) : t("conflict.none");
    case "title": return String(src.titoloPreventivoRiga1 ?? "") || t("conflict.none");
    case "notes": return String(src.note ?? "") || t("conflict.none");
    case "template": return String(src.templateId ?? "") || t("conflict.none");
    default: return String(src.descrizioneGenerale ?? "") || t("conflict.none");
  }
}

function Option({ who, value, keep, on, onPress }: { who: string; value: string; keep: string; on: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Press onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: on }}
      style={{ flex: 1, minWidth: 0, borderRadius: 16, padding: 12, gap: 3, backgroundColor: on ? colors["acc-soft"] : colors.soft, borderWidth: on ? 1.5 : 1, borderColor: on ? colors.acc : colors.line2 }}>
      <Text size={11.5} color="muted">{who}</Text>
      <Text size={16} weight={600} numberOfLines={2}>{value}</Text>
      <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: on ? 5 : 1.5, borderColor: on ? colors.acc : colors.line2 }} />
        <Text size={12.5} weight={600}>{keep}</Text>
      </View>
    </Press>
  );
}

export function ConflictCard({ op, who, onPick, onSave }: { op: Op; /** Who made the other change, when known. */ who?: string; onPick: (g: FieldGroup, side: "mine" | "theirs") => void; onSave: () => void }) {
  const { t, locale } = useSyncT();
  const c = op.conflict!;
  const left = c.groups.filter((g) => !c.picks[g]).length;
  return (
    <Card style={{ overflow: "hidden" }}>
      <Row top>
        <Icon name="sync" tone="violet" size={28} />
        <Lines strong title={t("conflict.lead", { count: c.groups.length })} sub={t("conflict.sub", { ref: op.ref })} />
      </Row>
      {c.groups.map((g) => (
        <View key={g} style={{ paddingTop: 4, paddingHorizontal: 16, paddingBottom: 16 }}>
          <Text size={13.5} weight={600} style={{ paddingHorizontal: 2, paddingBottom: 8 }}>{t(`field.${g}`)}</Text>
          <View accessibilityRole="radiogroup" accessibilityLabel={t(`field.${g}`)} style={{ flexDirection: "row", gap: 8 }}>
            <Option who={t("conflict.mine", { time: at(op.at, locale) })} value={shown(g, { ...op.before, ...op.body }, t, locale)} keep={t("conflict.keepMine")} on={c.picks[g] === "mine"} onPress={() => onPick(g, "mine")} />
            <Option who={t("conflict.theirs", { who: who ?? t("conflict.who"), time: at(c.updatedAt, locale) })} value={shown(g, c.current, t, locale)} keep={t("conflict.keepTheirs")} on={c.picks[g] === "theirs"} onPress={() => onPick(g, "theirs")} />
          </View>
        </View>
      ))}
      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <Button size="md" block disabled={!allPicked(c)} label={left ? t("conflict.more", { count: left }) : t("conflict.save")} onPress={onSave} />
      </View>
    </Card>
  );
}

export function NewVersionBanner({ onReload }: { onReload: () => void }) {
  const { t } = useSyncT();
  return <Banner tone="acc" icon="star" iconTone="violet" lead={t("version.lead")} button={t("version.reload")} onButton={onReload} />;
}

export function Unreachable({ onRetry, busy }: { onRetry: () => void; busy?: boolean }) {
  const { t } = useSyncT();
  return <Card><Empty icon="cloud" iconTone="slate" title={t("unreachable.title")} body={t("unreachable.body")} action={t("unreachable.retry")} actionKind="secondary" onAction={busy ? undefined : onRetry} padding={{ v: 28, h: 24 }} /></Card>;
}

/**
 * The states that apply now, in the board's order, for the top of a screen: offline or unreachable, what is being sent and how fresh the screen is,
 * photos waiting, refused changes, conflicts. Nothing at all when everything is sent and the phone is online.
 */
export function SyncStates({ pt = 12, pb = 0, px = 16 }: { /** Space around, only when something shows. */ pt?: number; pb?: number; px?: number }) {
  const { t } = useSyncT();
  const net = useNet();
  const box = useOutbox();
  const fetching = useIsFetching() > 0;
  const [trying, setTrying] = useState(false);
  const [wasDown, setWasDown] = useState(!net.online || !net.reachable);
  const down = !net.online || !net.reachable;
  useEffect(() => { if (down) setWasDown(true); else if (!fetching) setWasDown(false); }, [down, fetching]);
  useEffect(() => {
    if (box.photoState !== "done" && !box.cleared) return;
    const id = setTimeout(() => { clearPhotoDone(); clearCleared(); }, 8000);
    return () => clearTimeout(id);
  }, [box.photoState, box.cleared]);

  const c = counts(box.ops);
  const rejected = box.ops.filter((o) => o.state === "rejected");
  const conflicts = box.ops.filter((o) => o.state === "conflict");
  const photos = photoTotals(box.photos);
  const photoJob = box.photoState === "done" ? box.photoDone?.ref ?? "" : box.photos[box.photos.length - 1]?.ref ?? "";
  const showSynced = wasDown && net.syncedAt != null;
  const parts = [
    !net.online ? <OfflineBanner key="off" waiting={c.total} /> : null,
    net.online && !net.reachable ? <Unreachable key="un" busy={trying} onRetry={() => { setTrying(true); void tryServer().finally(() => setTrying(false)); }} /> : null,
    (box.sending && c.total) || showSynced ? <SyncCard key="sc" sending={box.sending ? c.total : 0} what={summary(t, c)} syncedAt={showSynced ? net.syncedAt : null} updating={!down && fetching} /> : null,
    photos.count || box.photoState === "done" ? <PhotosCard key="ph" state={box.photoState} count={photos.count} bytes={photos.bytes} job={photoJob} doneCount={box.photoDone?.count ?? 0} onSend={() => void flushPhotos(getNet().online)} /> : null,
    rejected.length || box.cleared ? <RejectedCard key="rj" ops={rejected} cleared={box.cleared} onRetry={(id) => void retry(id)} onDiscard={discard} /> : null,
    ...conflicts.map((op) => <ConflictCard key={op.id} op={op} onPick={(g, s) => pick(op.id, g, s)} onSave={() => void saveChoices(op.id)} />),
  ].filter(Boolean);
  if (!parts.length) return null;
  return <View style={{ gap: 10, paddingTop: pt, paddingBottom: pb, paddingHorizontal: px }}>{parts}</View>;
}
