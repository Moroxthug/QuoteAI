// Job.dc.html, the Photos tab: the job's photos in a grid of three, tap to select (the selection draws an `acc` ring and a check), "Select" / "Clear",
// "Delete selected", and the floating bar sends the selection to the client ("Share 3 with the client") or, with nothing selected, takes a photo.
import { useMemo, useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFailure } from "@/lib/api";
import { shortDate, type Locale } from "@/lib/format";
import { jobsApi, type JobPhoto } from "@/lib/jobsApi";
import { addJobPhoto } from "@/lib/jobPhotos";
import { API_ORIGIN } from "@/lib/session";
import { AuthImage } from "@/ui/AuthImage";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Skeleton, useToast } from "@/ui/Feedback";
import { Glyph, Icon } from "@/ui/Icon";
import { Section } from "@/ui/Layout";
import { Press } from "@/ui/motion";
import { SectionHeader } from "@/ui/Row";
import { Text } from "@/ui/Text";
import { useTheme } from "@/ui/theme";
import { usePrimary } from "./primary";

export function Photos({ id, locale }: { id: string; locale: Locale }) {
  const { t } = useTranslation();
  const j = (k: string, o?: Record<string, unknown>) => t(`job.${k}`, o) as string;
  const { colors } = useTheme();
  const toast = useToast();
  const client = useQueryClient();
  const q = useQuery({ queryKey: ["job-photos", id], queryFn: () => jobsApi.photos(id), retry: 1, staleTime: 30_000 });
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const photos = useMemo(() => q.data?.photos ?? [], [q.data]);
  const refresh = () => void client.invalidateQueries({ queryKey: ["job-photos", id] });

  const take = async () => {
    setBusy("add");
    const r = await addJobPhoto(id);
    setBusy(null);
    if (r === "ok") refresh();
    else if (r !== "cancelled") toast({ message: r === "denied" ? j("quick.denied") : r === "unavailable" ? j("quick.unavailable") : j("quick.photoFailed") });
  };

  const share = async () => {
    setBusy("share");
    try {
      await jobsApi.sharePhotos(id, sel);
      toast({ message: j("photos.shared") });
      setSel([]);
      refresh();
    } catch (e) {
      toast({ message: e instanceof ApiFailure && e.code === "NO_CLIENT" ? j("quick.noClient") : j("photos.shareFailed") });
    } finally {
      setBusy(null);
    }
  };

  usePrimary(sel.length ? { label: j("primary.photosShare", { count: sel.length }), run: () => void share(), busy: busy === "share" } : { label: j("primary.photos"), run: () => void take(), busy: busy === "add" });

  const remove = async () => {
    setBusy("delete");
    try {
      await Promise.all(sel.map((p) => jobsApi.deletePhoto(id, p)));
      setSel([]);
      refresh();
      toast({ message: j("photos.deleted") });
    } catch {
      toast({ message: j("failed") });
    } finally {
      setBusy(null);
    }
  };

  const toggle = (p: JobPhoto) => setSel((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]));

  return (
    <Section pt={22} px={16}>
      <SectionHeader title={sel.length ? j("photos.selected", { count: sel.length, total: photos.length }) : j("photos.count", { count: photos.length })}
        link={photos.length ? (sel.length ? j("photos.clear") : j("photos.select")) : undefined} onLink={() => setSel(sel.length ? [] : photos[0] ? [photos[0].id] : [])} />
      {q.isPending && !q.data ? <Skeleton height={200} radius={14} /> : photos.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {photos.map((p) => {
            const on = sel.includes(p.id);
            const date = shortDate(new Date(p.createdAt), locale);
            return (
              <Press key={p.id} onPress={() => toggle(p)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={j("photos.photoFrom", { date })}
                style={{ width: "32.2%", aspectRatio: 1, borderRadius: 14, overflow: "hidden", backgroundColor: colors.sunk, alignItems: "center", justifyContent: "center", boxShadow: on ? `0 0 0 3px ${colors.acc}` : undefined, transform: [{ scale: on ? 0.94 : 1 }] }}>
                <AuthImage uri={`${API_ORIGIN}/api/jobs/${encodeURIComponent(id)}/photos/${encodeURIComponent(p.id)}/file?size=thumb`} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} fallback={<Icon name="photo" tone="slate" size={34} />} />
                <Text size={10.5} color="t2" style={{ position: "absolute", left: 8, bottom: 6 }}>{date}</Text>
                <View style={{ position: "absolute", top: 7, right: 7, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: on ? colors.acc : colors.scrim, boxShadow: on ? undefined : `inset 0 0 0 1.6px ${colors.card}` }}>
                  {on ? <Glyph name="check" size={12} color="on-inv" weight={3} /> : null}
                </View>
              </Press>
            );
          })}
        </View>
      ) : <Card padded><Text size={13.5} color="muted">{j("photos.empty")}</Text></Card>}
      {sel.length ? <View style={{ marginTop: 12, alignItems: "flex-start" }}><Button kind="destructive" size="sm" label={j("photos.deleteSelected")} busy={busy === "delete" ? j("saving") : false} onPress={() => void remove()} /></View> : null}
    </Section>
  );
}
