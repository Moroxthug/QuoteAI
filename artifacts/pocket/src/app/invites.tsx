// Invites.dc.html: the states are single, multiple, picker, wrongAccount and expired.
// Invitations waiting for the signed-in address (team.pendingInvites) give single / multiple; accepting two
// leads to the picker. The emailed link opens the app on /invites?token=…: the link's preview gives single
// (this address), wrongAccount (another address is signed in) or expired.
// Decline has no server call (the API only has accept): it is kept on the screen, as the board's Undo implies.
import { useCallback, useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiFailure, team, type OrgDto, type PendingInviteDto, type TeamRole } from "@/lib/api";
import { accepted, initialsOf, joinedOrgs, sameAddress, tokenProblem, viewFor, type Answer, type InviteView } from "@/lib/invites";
import { inviteLink, type InvitePreview } from "@/lib/invitesApi";
import { setActiveOrg } from "@/lib/session";
import { useSession } from "@/lib/useSession";
import { AuthBody, TextLink } from "@/ui/Auth";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Card, Hairline } from "@/ui/Card";
import { Banner, Empty, Skeleton } from "@/ui/Feedback";
import { Header } from "@/ui/Header";
import { Icon } from "@/ui/Icon";
import { AccountRow, InviteHero, InviteRow, PickRow } from "@/ui/Invite";
import { Section, Spacer, Stack } from "@/ui/Layout";
import { Screen } from "@/ui/Screen";
import { Status } from "@/ui/Status";
import { Text } from "@/ui/Text";

type Problem = "offline" | "failed" | "own";
type Loaded = { id: string; companyName: string; role: TeamRole };

export default function Invites() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const insets = useSafeAreaInsets();
  const { status, user, refresh, signOut } = useSession();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const signedIn = (status === "in" || status === "offline") && !!user;

  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [declinedOne, setDeclinedOne] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [picker, setPicker] = useState<OrgDto[] | null>(null);
  const [pick, setPick] = useState("");

  // The emailed link, when there is one.
  const link = useQuery({ queryKey: ["invite-link", token], queryFn: () => inviteLink.preview(token!), enabled: !!token, retry: false });
  // The invitations waiting for this address (the same query the gate asks).
  const pending = useQuery({ queryKey: ["pending-invites"], queryFn: team.pendingInvites, enabled: !token && signedIn, retry: false });

  const linkProblem = link.error ? tokenProblem(link.error instanceof ApiFailure ? link.error : { status: 500 }) : null;
  const preview: InvitePreview | undefined = link.data;

  const items: Loaded[] = useMemo(() => {
    if (token) return preview ? [{ id: "link", companyName: preview.companyName, role: preview.role }] : [];
    return (pending.data?.items ?? []).map((i: PendingInviteDto) => ({ id: i.id, companyName: i.companyName, role: i.role }));
  }, [token, preview, pending.data]);

  // Nothing is waiting: the gate decides where this person starts.
  const empty = !token && signedIn && pending.isSuccess && items.length === 0;
  useEffect(() => { if (empty && !picker) router.replace("/"); }, [empty, picker]);
  // The link was already used: this person is in; show them in.
  useEffect(() => {
    if (linkProblem === "accepted") void finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkProblem]);

  const roleLabel = (r: string) => t(`invites.role.${r}`);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/sign-in"));

  async function finish(orgId?: string) {
    if (orgId) {
      try { await team.switchOrg(orgId); } catch { /* the stored company is enough: the phone sends it with every call */ }
      await setActiveOrg(orgId);
    }
    client.clear();
    await refresh();
    router.replace("/");
  }

  async function acceptSelected(chosen: Loaded[]) {
    if (busy || chosen.length === 0) return;
    setBusy(true);
    setProblem(null);
    try {
      const before = (await team.orgs()).items;
      for (const c of chosen) {
        if (token) await inviteLink.accept(token);
        else await team.acceptInvite(c.id);
      }
      const after = (await team.orgs()).items;
      const joined = joinedOrgs(before, after);
      if (joined.length >= 2) {
        setPicker(joined);
        setPick(joined[0]!.orgId);
        setBusy(false);
        return;
      }
      await finish(joined[0]?.orgId);
    } catch (e) {
      setBusy(false);
      const f = e instanceof ApiFailure ? e : null;
      if (f && token && tokenProblem(f) === "wrongAccount") { void link.refetch(); return; }
      if (f?.code === "OWN_COMPANY") setProblem("own");
      else setProblem(f?.offline ? "offline" : "failed");
    }
  }

  async function openPicked() {
    if (busy || !pick) return;
    setBusy(true);
    await finish(pick);
  }

  async function switchAccount(expected: string) {
    await signOut();
    router.replace({ pathname: "/sign-in", params: { email: expected } });
  }

  // What the screen is showing.
  let view: InviteView | "loading" | "error" = "loading";
  if (picker) view = "picker";
  else if (token) {
    if (link.isPending) view = "loading";
    else if (linkProblem === "expired" || linkProblem === "invalid") view = "expired";
    else if (linkProblem) view = "error";
    else if (signedIn && preview && !sameAddress(user?.email, preview.email)) view = "wrongAccount";
    else if (!signedIn && status === "loading") view = "loading";
    else view = "single";
  } else if (status === "loading" || (signedIn && pending.isPending)) view = "loading";
  else if (pending.isError) view = "error";
  else view = viewFor(items.length) ?? "loading";

  const wantYes = accepted(items, answers);
  const single = items[0];
  const title =
    view === "single" ? (declinedOne ? t("invites.title.declined") : t("invites.title.single"))
    : view === "expired" ? t("invites.title.single")
    : view === "multiple" ? t("invites.title.multiple")
    : view === "picker" ? t("invites.title.picker")
    : view === "wrongAccount" ? t("invites.title.wrong") : t("invites.title.single");
  let sub = "";
  if (view === "single") sub = declinedOne ? t("invites.sub.declined") : signedIn ? t("invites.signedInAs", { email: user?.email ?? "" }) : t("invites.signedOut.sub", { email: preview?.email ?? "" });
  else if (view === "expired") sub = signedIn ? t("invites.signedInAs", { email: user?.email ?? "" }) : "";
  else if (view === "multiple") sub = items.length === 2 ? t("invites.sub.multipleTwo") : t("invites.sub.multiple", { count: items.length });
  else if (view === "picker") sub = picker?.length === 2 ? t("invites.sub.pickerTwo") : t("invites.sub.picker", { count: picker?.length ?? 0 });
  else if (view === "wrongAccount") sub = t("invites.sub.wrong");

  const showOwn = signedIn && (view === "single" || view === "multiple" || view === "expired");
  const setAnswer = useCallback((id: string, a: Answer) => setAnswers((cur) => ({ ...cur, [id]: a })), []);
  const rowLabels = { decline: t("invites.decline"), accept: t("invites.accept"), undo: t("invites.undo"), declined: t("invites.declinedTag"), joined: t("invites.joinedTag") };
  const pickedName = picker?.find((o) => o.orgId === pick)?.companyName ?? "";

  const banner = problem ?? (view === "error" ? (linkProblem === "offline" || pending.error instanceof ApiFailure && pending.error.offline ? "offline" : "failed") : null);

  return (
    <Screen>
      <Header title="" onBack={back} backLabel={t("invites.back")} />
      <AuthBody bottom={16}>
        <Section px={20} pt={18} gap={8}>
          <Text size={28} weight={600} tracking={-0.04} leading={1.15} accessibilityRole="header">{title}</Text>
          {sub ? <Text color="muted" leading={1.45}>{sub}</Text> : null}
        </Section>
        {banner ? (
          <Section px={16} pt={16}>
            <Banner tone={banner === "own" ? "bad" : "warn"} icon={banner === "offline" ? "cloud" : "warn"} iconTone={banner === "own" ? "rose" : "amber"} lead={t(`invites.problem.${banner}.lead`)}>{t(`invites.problem.${banner}.text`)}</Banner>
          </Section>
        ) : null}

        {view === "loading" ? (
          <Section px={16} pt={20}><Card><Stack px={18} pt={20} pb={18} gap={14}><Skeleton height={44} radius={14} /><Skeleton height={14} width="70%" /><Skeleton height={10} width="45%" /></Stack></Card></Section>
        ) : null}

        {view === "single" && single ? (
          <Section delay={60} px={16} pt={20}>
            <InviteHero company={single.companyName} role={roleLabel(single.role)}
              status={declinedOne ? <Status tone="bad" shape="x">{t("invites.declinedTag")}</Status> : undefined}
              sentence={t("invites.invitedLine", { company: single.companyName, role: roleLabel(single.role) })}
              can={single.role === "foreman" ? (t("invites.can.foreman", { returnObjects: true }) as unknown as string[]) : []}
              sentTo={t("invites.sentTo", { email: preview?.email ?? user?.email ?? "" })} />
          </Section>
        ) : null}

        {view === "multiple" ? (
          <Section delay={60} px={16} pt={20}>
            <Card>
              {items.map((i, n) => (
                <Stack key={i.id}>
                  {n > 0 ? <Hairline inset={0} /> : null}
                  <InviteRow company={i.companyName} role={roleLabel(i.role)} answer={answers[i.id] ?? ""} labels={rowLabels} onAnswer={(a) => setAnswer(i.id, a)} />
                </Stack>
              ))}
            </Card>
          </Section>
        ) : null}

        {view === "picker" && picker ? (
          <Section delay={60} px={16} pt={20}>
            <Card>
              {picker.map((o, n) => (
                <Stack key={o.orgId}>
                  {n > 0 ? <Hairline inset={0} /> : null}
                  <PickRow company={o.companyName} role={roleLabel(o.role)} on={pick === o.orgId} onPress={() => setPick(o.orgId)} />
                </Stack>
              ))}
            </Card>
            <Stack pt={10} px={4}><Text size={12.5} color="muted">{t("invites.switchLater")}</Text></Stack>
          </Section>
        ) : null}

        {view === "wrongAccount" && preview ? (
          <Section delay={60} px={16} pt={20}>
            <Banner tone="warn" icon="warn" iconTone="amber" lead={t("invites.wrong.lead", { expected: preview.email })}>{t("invites.wrong.text", { current: user?.email ?? "" })}</Banner>
            <Stack mt={12}>
              <Card>
                <AccountRow leading={<Avatar initials={initialsOf(user?.name || user?.email)} tint={2} />} title={user?.email ?? ""} sub={t("invites.wrong.signedIn")} />
                <Hairline inset={0} />
                <AccountRow leading={<Icon name="mail" tone="amber" size={28} />} title={`${preview.companyName} · ${roleLabel(preview.role)}`} sub={t("invites.wrong.sentTo", { email: preview.email })} />
              </Card>
            </Stack>
          </Section>
        ) : null}

        {view === "expired" ? (
          <Section delay={60} px={16} pt={20}>
            <Card><Empty icon="clock" iconTone="amber" title={linkProblem === "invalid" ? t("invites.invalid.title") : t("invites.expired.title")} body={linkProblem === "invalid" ? t("invites.invalid.body") : t("invites.expired.body")} padding={{ v: 32, h: 24 }} /></Card>
          </Section>
        ) : null}
        <Spacer />
      </AuthBody>

      <Section delay={120} px={16} pt={12} pb={30 + insets.bottom} align="stretch" gap={4}>
        {view === "single" && single && signedIn && !declinedOne ? (
          <Stack row gap={10}>
            <Button size="lg" kind="secondary" label={t("invites.decline")} grow onPress={() => setDeclinedOne(true)} />
            <Button size="lg" label={t("invites.acceptJoin")} busy={busy ? t("invites.accepting") : false} grow onPress={() => void acceptSelected([single])} />
          </Stack>
        ) : null}
        {view === "single" && single && signedIn && declinedOne ? <Button size="lg" kind="secondary" block label={t("invites.undo")} onPress={() => setDeclinedOne(false)} /> : null}
        {view === "single" && !signedIn ? (
          <>
            <Button size="lg" block label={t("invites.signedOut.signIn")} onPress={() => router.push({ pathname: "/sign-in", params: { email: preview?.email ?? "" } })} />
            <Stack pt={8} align="center"><TextLink label={t("invites.signedOut.create")} color="muted" size={14.5} weight={400} onPress={() => router.push({ pathname: "/sign-up", params: { email: preview?.email ?? "" } })} /></Stack>
          </>
        ) : null}
        {view === "multiple" && wantYes.length > 0 ? <Button size="lg" block label={t("invites.next")} busy={busy ? t("invites.accepting") : false} onPress={() => void acceptSelected(wantYes)} /> : null}
        {view === "picker" ? <Button size="lg" block label={t("invites.open", { company: pickedName })} busy={busy ? t("invites.opening") : false} onPress={() => void openPicked()} /> : null}
        {view === "wrongAccount" && preview ? <Button size="lg" block label={t("invites.wrong.switch")} onPress={() => void switchAccount(preview.email)} /> : null}
        {view === "expired" ? <Button size="lg" kind="secondary" block label={t("invites.expired.code")} onPress={() => router.push("/join-code")} /> : null}
        {view === "error" ? <Button size="lg" kind="secondary" block label={t("invites.retry")} onPress={() => void (token ? link.refetch() : pending.refetch())} /> : null}
        {showOwn ? <Stack pt={8} align="center"><TextLink label={t("invites.ownCompany")} color="muted" size={14.5} weight={400} onPress={() => router.push("/onboarding")} /></Stack> : null}
      </Section>
    </Screen>
  );
}
