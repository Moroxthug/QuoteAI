// SetRoles.dc.html. Roles: the nine job roles (who has each), what a role starts with (its access, its four home sections in order, its tabs; "Let people change their home"; a preview of
// the home), and the four sensitive switches for each person who signs in (See pay rates, See margins and costs, Approve time, Send invoices), with what differs from their role marked.
// States: default, view only, locked (role homes are included in Business), loading and can't load.
// Kept by the server: who has which job role and the four switches. Not on the board but needed to give anyone a role: a "Job role" row under the person's name opens a sheet to choose it.
// NOT ENFORCED YET: the server keeps the switches and the home reads them, but it does not yet hide pay rates or margins from, or stop Approve and Send for, someone whose switch is off.
import { useState } from "react";
import { Redirect, router } from "expo-router";
import { Linking, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFailure } from "@/lib/api";
import { SENSITIVE, ROLES, ROLE_KEYS, changedCount, defaultSensitive, firstName, type JobRole, type SensitiveKey } from "@/lib/jobRoles";
import { jobRolesApi, type Person, type RolesOverview } from "@/lib/jobRolesApi";
import { initialsOf } from "@/lib/invites";
import { PLANS_URL } from "@/lib/plan";
import { screenHref } from "@/lib/nav";
import { useRole } from "@/lib/useRole";
import { useSession } from "@/lib/useSession";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Header } from "@/ui/Header";
import { type IconName, type Tone } from "@/ui/Icon";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { BannerStack, Block, BlockLabel, Foot, GroupHeading, LineBlock, NumberedChips, PersonChips, PersonHead, RoleRow, TabChips } from "@/ui/Roles";
import { Screen } from "@/ui/Screen";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { ChoiceList, SetGroup, SetRow, SetValue } from "@/ui/Settings";
import { InlineBanner, SetTitle } from "@/ui/SettingsPages";
import { Tag } from "@/ui/Status";
import { Switch } from "@/ui/Switch";
import { Text } from "@/ui/Text";

const SW_ICON: Record<SensitiveKey, { icon: IconName; tone: Tone }> = { payRates: { icon: "card", tone: "rose" }, margins: { icon: "percent", tone: "violet" }, approveTime: { icon: "clock", tone: "teal" }, sendInvoices: { icon: "send", tone: "azure" } };
const tint = (id: string): 1 | 2 | 3 | 4 | 5 => ((Array.from(id).reduce((n, c) => n + c.charCodeAt(0), 0) % 5) + 1) as 1 | 2 | 3 | 4 | 5;
const ASSIGNABLE = ROLE_KEYS.filter((r) => r !== "owner" && r !== "crew");

export default function SetRoles() {
  const { t: tr } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`jr.${k}`, o) as string;
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const { role: access } = useRole();
  const canEdit = access === "owner" || access === "admin";
  const q = useQuery({ queryKey: ["job-roles"], queryFn: jobRolesApi.list, enabled: signedIn, retry: 1, staleTime: 15_000 });
  const [pick, setPick] = useState<JobRole | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  if (status === "out") return <Redirect href="/" />;

  const d = q.data;
  const locked = !!d && !d.included;
  const editable = canEdit && !locked;
  const people = d?.people ?? [];
  const byRole = (r: JobRole): { id: string; name: string }[] => (r === "crew" ? d?.crew ?? [] : people.filter((p) => p.jobRole === r).map((p) => ({ id: p.id, name: p.name })));
  const selected: JobRole = pick ?? ROLE_KEYS.find((r) => r !== "owner" && byRole(r).length > 0) ?? "officeManager";
  const def = ROLES[selected];
  const signers = people.filter((p) => p.access !== "owner");
  const person: Person | undefined = signers.find((p) => p.id === personId) ?? signers[0];
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Settings", t("title"))));
  const fail = (e: unknown) => toast({ message: e instanceof ApiFailure ? (e.status === 0 ? t("toast.offline") : e.status === 403 ? t(e.code === "PLAN_REQUIRED" ? "toast.plan" : "toast.noAccess") : t("toast.failed")) : t("toast.failed") });

  const secName = (k: string): string => (tr(`jr.sec.${k}`, { returnObjects: true }) as unknown as string[])[0] ?? k;
  const who = (r: JobRole): string => {
    const list = byRole(r);
    if (list.length === 0) return "—";
    if (list.length === 1) return list[0]!.name;
    const ns = list.map((p) => firstName(p.name));
    return ns.length === 2 ? ns.join(", ") : t("andMore", { names: ns.slice(0, 2).join(", "), count: ns.length - 2 });
  };
  const patch = (fn: (cur: RolesOverview) => RolesOverview) => client.setQueryData(["job-roles"], (cur: RolesOverview | undefined) => (cur ? fn(cur) : cur));
  const flip = async (p: Person, key: SensitiveKey, v: boolean) => {
    patch((c) => ({ ...c, people: c.people.map((x) => (x.id === p.id ? { ...x, sensitive: { ...x.sensitive, [key]: v } } : x)) }));
    try { const r = await jobRolesApi.savePerson(p.id, { sensitive: { [key]: v } }); patch((c) => ({ ...c, people: c.people.map((x) => (x.id === p.id ? { ...x, overrides: r.overrides, sensitive: r.sensitive } : x)) })); }
    catch (e) { void q.refetch(); fail(e); }
  };
  const give = async (p: Person, role: JobRole) => {
    setChoosing(false);
    try { const r = await jobRolesApi.savePerson(p.id, { jobRole: role }); patch((c) => ({ ...c, people: c.people.map((x) => (x.id === p.id ? { ...x, jobRole: role, assigned: true, overrides: r.overrides, sensitive: r.sensitive } : x)) })); setPick(role); toast({ message: t("toast.saved") }); }
    catch (e) { fail(e); }
  };
  const setOwn = async (v: boolean) => {
    patch((c) => ({ ...c, ownHome: { ...c.ownHome, [selected]: v } }));
    try { await jobRolesApi.saveSettings({ [selected]: v }); } catch (e) { void q.refetch(); fail(e); }
  };
  const sensitiveNow = (p: Person) => p.sensitive;

  return (
    <Screen>
      <Header title="" backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={56}>
        <SetTitle title={t("title")} lede={t("sub", { count: people.length + (d?.crew.length ?? 0) })} />
        {!canEdit && d ? <InlineBanner><Banner tone="info" icon="lock" iconTone="slate" lead={t("readOnly.lead")}>{t("readOnly.body")}</Banner></InlineBanner> : null}
        {locked ? (
          <InlineBanner>
            <BannerStack>
              <Banner tone="acc" icon="tier3" iconTone="violet" lead={t("locked.lead")}>{t("locked.body")}</Banner>
              <View style={{ flexDirection: "row" }}><Button size="sm" kind="secondary" label={t("locked.action")} onPress={() => void Linking.openURL(PLANS_URL)} /></View>
            </BannerStack>
          </InlineBanner>
        ) : null}

        {q.isPending && !d ? (
          <Section pt={18} px={16} gap={14}><Skeleton height={300} radius={22} /><Skeleton height={260} radius={22} /></Section>
        ) : !d ? (
          <Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("loadFailed.retry")} onAction={() => void q.refetch()} />
        ) : (
          <>
            <Section delay={40}>
              <SetGroup title={t("roles")}>
                {ROLE_KEYS.map((r, i) => (
                  <RoleRow key={r} first={i === 0} icon={ROLES[r].icon as IconName} tone={ROLES[r].tone as Tone} name={t(`role.${r}`)} who={who(r)} avatars={byRole(r).slice(0, 2).map((p) => ({ initials: initialsOf(p.name), tint: tint(p.id) }))} on={r === selected} onPress={() => setPick(r)} />
                ))}
              </SetGroup>
            </Section>

            <Section delay={80}>
              <SetGroup title={t("defaults", { role: t(`role.${selected}`) })}>
                <View style={{ opacity: locked ? 0.55 : 1 }}>
                  <LineBlock first label={t("accessLabel")} sub={t(`accessSub.${def.access}`)} control={<Tag accent>{t(`access.${def.access}`)}</Tag>} />
                  <Block>
                    <BlockLabel label={t("homeOrder")} action={editable ? t("edit") : undefined} onAction={() => router.push(screenHref("CustomizeHome", t("home.title")))} />
                    <NumberedChips items={def.sections.map((s, i) => ({ n: i + 1, text: secName(s) }))} />
                  </Block>
                  <Block>
                    <BlockLabel label={t("tabsLabel")} action={editable ? t("edit") : undefined} onAction={() => router.push(screenHref("CustomizeHome", t("home.title")))} />
                    <TabChips items={[t("tab.home"), ...def.tabs.map((k) => t(`tab.${k}`))]} />
                  </Block>
                  <LineBlock label={t("own.label")} sub={t("own.sub")} control={<Switch value={d.ownHome[selected] ?? true} onChange={(v) => void setOwn(v)} label={t("own.label")} disabled={!editable} />} />
                </View>
                <SetRow icon="eye" tone="indigo" label={t("preview.label")} sub={t("preview.sub", { name: byRole(selected)[0] ? firstName(byRole(selected)[0]!.name) : t(`role.${selected}`) })} control={<SetValue value="" chevron />} onPress={() => router.push(screenHref("RoleHomes", t("preview.label"), { role: selected }))} />
              </SetGroup>
            </Section>

            {person ? (
              <Section delay={120} pt={26}>
                <GroupHeading>{t("sensitive.title")}</GroupHeading>
                <PersonChips label={t("sensitive.person")} items={signers.map((p) => ({ id: p.id, initials: initialsOf(p.name), tint: tint(p.id), first: firstName(p.name) }))} selected={person.id} onPick={setPersonId} />
                <SetGroup>
                  <PersonHead avatar={<Avatar initials={initialsOf(person.name)} tint={tint(person.id)} />} name={person.name} role={t(`role.${person.jobRole}`)}
                    tag={changedCount(person.jobRole, sensitiveNow(person)) > 0 ? <Tag accent>{t("sensitive.changedN", { count: changedCount(person.jobRole, sensitiveNow(person)) })}</Tag> : undefined} />
                  <SetRow icon="user" tone="slate" label={t("accessLabel")} sub={undefined} control={<SetValue value={t(`role.${person.jobRole}`)} chevron />} onPress={editable ? () => setChoosing(true) : undefined} />
                  {SENSITIVE.map((k) => {
                    const on = person.sensitive[k];
                    const diff = on !== defaultSensitive(person.jobRole)[k];
                    return <SetRow key={k} icon={SW_ICON[k].icon} tone={SW_ICON[k].tone} label={t(`sensitive.keys.${k}`)}
                      sub={diff ? t("sensitive.changed", { role: t(`role.${person.jobRole}`), state: t(defaultSensitive(person.jobRole)[k] ? "sensitive.on" : "sensitive.off") }) : t("sensitive.isDefault", { role: t(`role.${person.jobRole}`) })}
                      control={<Switch value={on} onChange={(v) => void flip(person, k, v)} label={t(`sensitive.keys.${k}`)} disabled={!editable} />} />;
                  })}
                </SetGroup>
                <Foot>{t("sensitive.foot")}</Foot>
              </Section>
            ) : null}
          </>
        )}
      </ScrollPage>

      <Sheet open={choosing} onClose={() => setChoosing(false)} label={t("accessLabel")} closeLabel={t("close")}>
        <Stack px={16} pb={24} gap={12}>
          <SheetTitle>{person ? person.name : ""}</SheetTitle>
          <ChoiceList items={ASSIGNABLE.map((r) => ({ id: r, name: t(`role.${r}`), sub: t(`accessSub.${ROLES[r].access}`) }))} chosen={person?.jobRole ?? null} onPick={(id) => { if (person) void give(person, id as JobRole); }} />
        </Stack>
      </Sheet>
    </Screen>
  );
}
