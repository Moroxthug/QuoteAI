// CompanyPicker.dc.html: the states are default, loading, opening and removed.
// loading: skeleton rows while team.orgs() answers; default: the person's companies (the stored one chosen);
// opening: Continue pressed, team.switchOrg in flight; removed: a company this phone remembers that is no longer
// in the list (or switchOrg answered 403 / 404 for it): its row says "No access" and a banner says so.
// The gate sends here someone with several companies and none stored on this phone.
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import i18n from "@/i18n";
import { ApiFailure, team } from "@/lib/api";
import { initialSelection, isRemoval, parseKnown, pickerRows, remember, type KnownOrg } from "@/lib/companyPicker";
import { shortDate, time, type Locale } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import { kvGet, kvSet } from "@/lib/kv";
import { getActiveOrg, setActiveOrg } from "@/lib/session";
import { useSession } from "@/lib/useSession";
import { TextLink } from "@/ui/Auth";
import { Avatar, type AvatarTint } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { CompanyChoice } from "@/ui/Company";
import { Banner, Skeleton } from "@/ui/Feedback";
import { IconButton } from "@/ui/Header";
import { Section, Spacer, Stack } from "@/ui/Layout";
import { Screen } from "@/ui/Screen";
import { Switch } from "@/ui/Switch";
import { Text } from "@/ui/Text";
import { AuthBody } from "@/ui/Auth";

const KNOWN_KEY = "quoteai.knownCompanies";
const REMEMBER_KEY = "quoteai.rememberCompany";
const TINTS: AvatarTint[] = [2, 4, 3, 1];

type Problem = "offline" | "failed";

export default function CompanyPicker() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const insets = useSafeAreaInsets();
  const { user, refresh } = useSession();
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";

  const orgs = useQuery({ queryKey: ["team-orgs"], queryFn: team.orgs, retry: false });
  const [known, setKnown] = useState<KnownOrg[] | null>(null);
  const [activeId, setActiveId] = useState<string | null | undefined>(undefined);
  const [sel, setSel] = useState<string | null>(null);
  const [goneIds, setGoneIds] = useState<string[]>([]);
  const [keep, setKeep] = useState(true);
  const [opening, setOpening] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  useEffect(() => {
    void kvGet(KNOWN_KEY).then((raw) => setKnown(parseKnown(raw)));
    void getActiveOrg().then(setActiveId);
    void kvGet(REMEMBER_KEY).then((v) => setKeep(v !== "0"));
  }, []);

  const ready = orgs.isSuccess && known !== null && activeId !== undefined;
  const rows = useMemo(() => {
    if (!ready) return [];
    return pickerRows(orgs.data.items, known).map((r) => (goneIds.includes(r.org.orgId) ? { ...r, gone: true } : r));
  }, [ready, orgs.data, known, goneIds]);

  useEffect(() => {
    if (ready && sel === null) setSel(initialSelection(rows, activeId ?? null));
  }, [ready, rows, sel, activeId]);
  // Remember the companies seen, so a later removal can be told apart from "never had it".
  useEffect(() => {
    if (ready && !rows.some((r) => r.gone)) void kvSet(KNOWN_KEY, JSON.stringify(rows.map((r) => r.org)));
  }, [ready, rows]);
  // Nothing to choose from: the gate decides.
  useEffect(() => { if (ready && rows.length === 0) router.replace("/"); }, [ready, rows.length]);

  const gone = rows.filter((r) => r.gone);
  const chosen = rows.find((r) => r.org.orgId === sel && !r.gone);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/sign-in"));

  async function go() {
    if (!chosen || opening) return;
    setOpening(true);
    setProblem(null);
    try {
      await team.switchOrg(chosen.org.orgId);
    } catch (e) {
      setOpening(false);
      if (e instanceof ApiFailure && isRemoval(e)) {
        setGoneIds((ids) => [...ids, chosen.org.orgId]);
        setSel(initialSelection(rows.filter((r) => r.org.orgId !== chosen.org.orgId), null));
      } else setProblem(e instanceof ApiFailure && e.offline ? "offline" : "failed");
      return;
    }
    await setActiveOrg(chosen.org.orgId);
    await kvSet(KNOWN_KEY, JSON.stringify(remember(rows, chosen.org.orgId, new Date())));
    await kvSet(REMEMBER_KEY, keep ? "1" : "0");
    client.clear();
    await refresh();
    router.replace("/");
  }

  const lastLine = (o: KnownOrg): string | undefined => {
    if (!o.lastOpened) return undefined;
    const d = new Date(o.lastOpened);
    return d.toDateString() === new Date().toDateString() ? t("companyPicker.lastToday", { when: time(d, locale) }) : t("companyPicker.lastOpened", { when: shortDate(d, locale) });
  };

  const loading = !ready && !orgs.isError;
  const banner: Problem | null = problem ?? (orgs.isError ? (orgs.error instanceof ApiFailure && orgs.error.offline ? "offline" : "failed") : null);
  const name = user?.name || user?.email || "";

  return (
    <Screen>
      <Stack row align="center" justify="space-between" pt={8 + insets.top} px={10}>
        <IconButton glyph="back" label={t("companyPicker.back")} onPress={back} />
        <View style={{ flexShrink: 1 }}>
          <Stack row align="center" gap={8}>
            <Avatar initials={initialsOf(name)} tint={2} size={28} />
            <Text size={12.5} color="muted" numberOfLines={1} style={{ flexShrink: 1 }}>{user?.email ?? ""}</Text>
          </Stack>
        </View>
      </Stack>
      <AuthBody bottom={16}>
        <Section px={20} pt={26} gap={8}>
          <Text size={32} weight={600} tracking={-0.045} leading={1.1} accessibilityRole="header">{t("companyPicker.title")}</Text>
          {ready ? <Text color="muted" leading={1.45}>{t("companyPicker.sub", { count: rows.length })}</Text> : null}
        </Section>
        {banner ? (
          <Section px={16} pt={18}>
            <Banner tone="warn" icon={banner === "offline" ? "cloud" : "warn"} iconTone="amber" lead={t(`companyPicker.problem.${banner}.lead`)}
              link={orgs.isError ? t("companyPicker.retry") : undefined} onLink={() => void orgs.refetch()}>{t(`companyPicker.problem.${banner}.text`)}</Banner>
          </Section>
        ) : gone.length > 0 ? (
          <Section px={16} pt={18}>
            <Banner tone="info" icon="user" iconTone="sky"
              lead={gone.length === 1 ? t("companyPicker.removed.lead", { company: gone[0]!.org.companyName }) : t("companyPicker.removed.leadMany", { count: gone.length })}>
              {t("companyPicker.removed.text")}
            </Banner>
          </Section>
        ) : null}

        {loading ? (
          <Section px={16} pt={20} gap={10}>
            {[1, 2, 3].map((n) => (
              <Card key={n}>
                <Stack row align="center" gap={14} px={16} pt={14} pb={14}>
                  <Skeleton width={46} height={46} radius={14} />
                  <Stack grow gap={8}><Skeleton height={14} width="60%" /><Skeleton height={10} width="40%" /></Stack>
                </Stack>
              </Card>
            ))}
          </Section>
        ) : null}

        {ready ? (
          <>
            <Section px={16} pt={20} gap={10}>
              {rows.map((r, i) => (
                <CompanyChoice key={r.org.orgId} initials={initialsOf(r.org.companyName)} tint={TINTS[i % TINTS.length]!} name={r.org.companyName}
                  role={t(`companyPicker.role.${r.org.role}`)} accent={r.org.role === "owner"} last={r.gone ? undefined : lastLine(r.org)}
                  selected={r.org.orgId === sel} gone={r.gone} goneLabel={t("companyPicker.noAccess")} onPress={() => setSel(r.org.orgId)} />
              ))}
            </Section>
            <Section delay={160} px={16} pt={14}>
              <Card>
                <Stack row align="center" gap={12} px={16} pt={12} pb={12}>
                  <Stack grow gap={2}>
                    <Text size={14.5} weight={500}>{t("companyPicker.remember")}</Text>
                    <Text size={12.5} color="muted">{t("companyPicker.rememberSub")}</Text>
                  </Stack>
                  <Switch value={keep} onChange={setKeep} label={t("companyPicker.remember")} />
                </Stack>
              </Card>
            </Section>
          </>
        ) : null}
        <Spacer />
      </AuthBody>
      <Section px={16} pb={34 + insets.bottom} gap={14} align="stretch">
        <Button size="lg" block label={t("companyPicker.next")} disabled={loading || !chosen}
          busy={opening && chosen ? t("companyPicker.opening", { company: chosen.org.companyName }) : false} onPress={() => void go()} />
        <Stack row justify="center" gap={4} align="center">
          <Text size={14.5} color="muted">{t("companyPicker.another")}</Text>
          <TextLink label={t("companyPicker.enterCode")} size={14.5} weight={600} color="ink" onPress={() => router.push("/join-code")} />
        </Stack>
      </Section>
    </Screen>
  );
}
