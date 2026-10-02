// CrewMap.dc.html: the abstract map with the people who are sharing where they are (on the clock, location allowed), a glass title with the live count, and a bottom panel:
// "Crew today" with filter chips and a row per person (call, text). States: default, empty (nobody sharing), locked (the plan lacks time tracking: plans are on quoteai.ca).
// Not built: "On the way" with the route and minutes-away (no travel data on the server), site pins (jobs carry no coordinates); the panel stays one height with a more/less grab.
import { useMemo, useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { tintFor } from "@/lib/clients";
import { counts, fitPoints, mapPeople, type LocationsView, type MapKind } from "@/lib/crewMap";
import { crewLines, type CrewTodayView } from "@/lib/foreman";
import { foremanApi } from "@/lib/foremanApi";
import { relativeWhen, type Locale } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import { screenHref } from "@/lib/nav";
import { teamApi } from "@/lib/teamApi";
import { useSession } from "@/lib/useSession";
import { ACTION_BAR_SPACE } from "@/ui/ActionBar";
import { Chip, ChipStrip } from "@/ui/Chip";
import { CrewMapSurface, MapPanel, MapRow, MapTitle, MapTop } from "@/ui/CrewMap";
import { Empty } from "@/ui/Feedback";
import { Screen } from "@/ui/Screen";
import { Stack } from "@/ui/Layout";
import { Status } from "@/ui/Status";
import { Text } from "@/ui/Text";
import { IconButton } from "@/ui/Header";

type Filter = "all" | MapKind;
const CLOSED = 330;
const OPEN = 560;

export default function CrewMap() {
  const { t, i18n } = useTranslation();
  const c = (k: string, o?: Record<string, unknown>) => t(`cm.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const locs = useQuery({ queryKey: ["crew-locations"], queryFn: () => api<LocationsView>("/api/crew/locations"), enabled: signedIn, retry: 1, refetchInterval: 30_000 });
  const day = useQuery({ queryKey: ["foreman-today"], queryFn: foremanApi.today, enabled: signedIn, retry: 1 });
  const workers = useQuery({ queryKey: ["team-workers"], queryFn: teamApi.workers, enabled: signedIn, retry: 1 });
  const [size, setSize] = useState({ w: 390, h: 420 });
  const [sel, setSel] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState(false);
  const now = useMemo(() => new Date(), []);

  const locked = locs.data && !locs.data.enabled;
  const items = locs.data && locs.data.enabled ? locs.data.items : [];
  const today = day.data as CrewTodayView | undefined;
  const lines = today && today.enabled ? crewLines(today.jobs) : [];
  const people = useMemo(() => mapPeople(items, lines), [items, lines]);
  const n = counts(people);
  const shown = people.filter((p) => filter === "all" || p.kind === filter);
  const phoneOf = (id: string) => (workers.data?.items.find((w) => w.id === id)?.phone ?? "").replace(/[^\d+]/g, "");

  const sharing = people.filter((p) => p.lat != null && p.lng != null);
  const mapH = size.h - (open ? OPEN : CLOSED) + 24;
  const fit = fitPoints(sharing.map((p) => ({ lat: p.lat!, lng: p.lng! })), size.w, Math.max(160, mapH), 48);
  const markers = locked ? [] : sharing.map((p, i) => ({ id: p.workerId, initials: initialsOf(p.name), tint: tintFor(p.name), x: fit[i]!.x, y: fit[i]!.y + 40, label: `${p.name}, ${c("status.site")}` }));
  const liveWord = locked ? c("off") : n.site ? c("live", { count: n.site }) : c("noneLive");
  const back = () => (router.canGoBack() ? router.back() : router.replace("/menu"));

  return (
    <Screen>
      <View style={{ flex: 1 }}>
        <CrewMapSurface markers={markers} selected={sel} onPick={(id) => { setSel(id); setOpen(false); }} onSize={(w, h) => setSize({ w, h })} label={c("mapLabel")} />
        <MapTop>
        <IconButton glyph="back" label={c("back")} onPress={back} />
        <MapTitle title={c("title")} live={!locked && n.site > 0} liveWord={liveWord} />
        <Stack w={44} />
        </MapTop>
        <MapPanel height={locked ? 300 : open ? OPEN : CLOSED} grabLabel={open ? c("less") : c("more")} onGrab={() => setOpen((o) => !o)}>
          <Stack row align="center" justify="space-between" gap={10} px={20} pb={12}>
            <Text size={21} weight={600} tracking={-0.03} accessibilityRole="header">{c("sheet")}</Text>
            <Text size={12.5} color="muted">{locked ? "" : n.site ? c("meta", { count: n.site }) : c("metaNone")}</Text>
          </Stack>
          {locked ? (
            <Empty icon="lock" iconTone="violet" title={c("locked.title")} body={c("locked.body")} action={c("locked.action")} actionKind="secondary" onAction={() => router.push(screenHref("SetPlan", c("locked.action")))} />
          ) : locs.isError && !locs.data ? (
            <Empty icon="warn" iconTone="clay" title={c("loadFailed.title")} body={c("loadFailed.body")} action={c("loadFailed.retry")} onAction={() => void locs.refetch()} />
          ) : (
            <>
              <Stack><ChipStrip label={c("filter")}>
                {(["all", "site", "off"] as const).map((f) => <Chip key={f} label={c(`chips.${f}`)} count={f === "all" ? n.all : n[f]} selected={filter === f} onPress={() => setFilter(f)} />)}
              </ChipStrip></Stack>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: ACTION_BAR_SPACE }} showsVerticalScrollIndicator={false}>
                {shown.length === 0 ? <Empty icon="pin" iconTone="slate" title={c("empty.title")} body={c("empty.body")} /> : shown.map((p, i) => {
                  const phone = phoneOf(p.workerId);
                  const picked = sel === p.workerId && p.kind === "site";
                  return (
                    <MapRow key={p.workerId} first={i === 0} picked={picked} name={p.name} initials={initialsOf(p.name)} tint={tintFor(p.name)} onPress={() => p.kind === "site" && setSel(p.workerId)}
                      status={<Status plain tone={p.kind === "site" ? "ok" : "mute"} shape={p.kind === "site" ? "live" : "off"}>{c(`status.${p.kind}`)}</Status>}
                      sub={p.kind === "site" ? c("rowSite", { job: p.sub, when: relativeWhen(new Date(p.updatedAt!), now, locale) }) : p.sub ? c("rowOffJob", { job: p.sub }) : c("rowOff")}
                      textLabel={c("text", { name: p.name.split(/s+/)[0] })} callLabel={c("call", { name: p.name.split(/s+/)[0] })}
                      onText={phone ? () => void Linking.openURL(`sms:${phone}`) : undefined} onCall={phone ? () => void Linking.openURL(`tel:${phone}`) : undefined} />
                  );
                })}
                {shown.length ? <Stack px={20} pt={14}><Text size={12.5} color="faint" leading={1.45}>{c("foot")}</Text></Stack> : null}
              </ScrollView>
            </>
          )}
        </MapPanel>
      </View>
    </Screen>
  );
}
