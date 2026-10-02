// Menu.dc.html. Built rows go to their screen; rows for a later phase stay as designed and open
// Coming soon with their real title (owner ruling 2026-09-30). The plan card's accordion of plans
// belongs with the Plan screen (phase 128): its head opens Coming soon until then.
import { Redirect, router, type Href } from "expo-router";
import Constants from "expo-constants";
import { useTranslation } from "react-i18next";
import { useGetBusinessProfile, useGetSubscription } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { team } from "@/lib/api";
import { initialsOf } from "@/lib/invites";
import { builtHref, comingSoonHref, type BuiltScreen } from "@/lib/nav";
import { shortDate } from "@/lib/format";
import { useSession } from "@/lib/useSession";
import { Header } from "@/ui/Header";
import type { IconName, Tone } from "@/ui/Icon";
import { Icon } from "@/ui/Icon";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { MenuGroup, MenuIdentity, MenuPlanHead, MenuQuick, MenuSignOut } from "@/ui/Menu";
import { MenuList, MenuRow } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

type RowDef = { key: string; icon: IconName; tone: Tone; built?: BuiltScreen };
const GROUPS: { key: string; rows: RowDef[] }[] = [
  { key: "business", rows: [
    { key: "company", icon: "building", tone: "violet" }, { key: "priceBook", icon: "tag", tone: "lilac", built: "PriceBook" },
    { key: "leads", icon: "funnel", tone: "clay" }, { key: "contracts", icon: "pen", tone: "indigo", built: "Contracts" },
    { key: "compliance", icon: "shield", tone: "sage", built: "Compliance" }, { key: "taxes", icon: "percent", tone: "azure" } ] },
  { key: "team", rows: [
    { key: "crew", icon: "users", tone: "sage" }, { key: "timesheets", icon: "clock", tone: "teal" },
    { key: "crewMap", icon: "pin", tone: "clay" }, { key: "schedule", icon: "cal", tone: "sky" }, { key: "pay", icon: "card", tone: "amber", built: "Pay" } ] },
  { key: "money", rows: [
    { key: "invoices", icon: "doc", tone: "azure" }, { key: "books", icon: "bank", tone: "sage", built: "Books" },
    { key: "analytics", icon: "bars", tone: "violet", built: "Analytics" }, { key: "integrations", icon: "sync", tone: "clay" } ] },
  { key: "workspace", rows: [
    { key: "documents", icon: "file", tone: "indigo", built: "Documents" }, { key: "materials", icon: "box", tone: "amber", built: "Inventory" },
    { key: "suppliers", icon: "building", tone: "stone", built: "Suppliers" }, { key: "service", icon: "star", tone: "teal" },
    { key: "imports", icon: "sync", tone: "sky" }, { key: "archive", icon: "box", tone: "slate" }, { key: "group", icon: "users", tone: "lilac", built: "Group" } ] },
  { key: "app", rows: [
    { key: "assistant", icon: "orb", tone: "violet" }, { key: "settings", icon: "gear", tone: "slate" },
    { key: "notifications", icon: "bell", tone: "sky" }, { key: "help", icon: "help", tone: "stone" },
    { key: "whatsNew", icon: "gift", tone: "clay" }, { key: "feedback", icon: "chat", tone: "azure" } ] },
];

export default function Menu() {
  const { t, i18n } = useTranslation();
  const { status, user, signOut } = useSession();
  const profile = useGetBusinessProfile({ query: { enabled: status === "in" || status === "offline", retry: false } } as never);
  const sub = useGetSubscription({ query: { enabled: status === "in" || status === "offline", retry: false } } as never);
  const orgs = useQuery({ queryKey: ["team-orgs"], queryFn: team.orgs, enabled: status === "in", retry: false });
  if (status === "out") return <Redirect href="/" />;

  const locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const later = (label: string) => router.push(comingSoonHref(label));
  const open = (g: RowDef) => (g.built ? router.push(builtHref(g.built) as Href) : later(t(`menu.rows.${g.key}.label`)));
  const active = orgs.data?.items.find((o) => o.orgId === orgs.data.activeOrgId);
  const company = active?.companyName || profile.data?.companyName || "";
  const role = active ? t(`menu.role.${active.role}`) : "";
  const planName = sub.data?.plan ? sub.data.plan.charAt(0).toUpperCase() + sub.data.plan.slice(1) : "";
  const renews = sub.data?.periodEnd ? shortDate(new Date(sub.data.periodEnd), locale) : "";
  const version = Constants.expoConfig?.version ?? "";

  return (
    <Screen>
      <ScrollPage bottom={44}>
        <Header title="" backLabel={t("menu.back")} onBack={() => (router.canGoBack() ? router.back() : router.replace("/home"))}
          moreLabel={t("menu.settings")} moreGlyph="gear" onMore={() => later(t("menu.rows.settings.label"))} />
        <Section>
          <MenuIdentity initials={user ? initialsOf(user.name) : ""} name={user?.name ?? ""} sub={[company, role].filter(Boolean).join(" · ")}
            photoLabel={t("menu.changePhoto")} onPhoto={() => later(t("menu.rows.settings.label"))} onName={() => later(user?.name ?? "")} />
        </Section>
        {planName ? (
          <Section delay={50} px={16} pt={22}>
            <MenuPlanHead plan={planName} tag={t("menu.yourPlan")} line={renews ? t("menu.renews", { date: renews }) : ""} label={t("menu.planAria")} onPress={() => later(t("menu.plan"))} />
          </Section>
        ) : null}
        <Section delay={60} px={16} pt={12}>
          <MenuQuick items={[
            { icon: "building", tone: "violet", label: t("menu.quick.company"), onPress: () => later(t("menu.rows.company.label")) },
            { icon: "doc", tone: "indigo", label: t("menu.quick.documents"), onPress: () => router.push(builtHref("Documents") as Href) },
            { icon: "gift", tone: "clay", label: t("menu.quick.invite"), onPress: () => later(t("menu.rows.crew.label")) },
          ]} />
        </Section>
        {GROUPS.map((g, gi) => (
          <Section key={g.key} delay={140 + gi * 60}>
            <MenuGroup title={t(`menu.groups.${g.key}`)}>
              <MenuList>
                {g.rows.map((r) => (
                  <MenuRow key={r.key} icon={<Icon name={r.icon} tone={r.tone} size={28} />} title={t(`menu.rows.${r.key}.label`)}
                    sub={i18n.exists(`menu.rows.${r.key}.sub`) ? t(`menu.rows.${r.key}.sub`) : undefined} onPress={() => open(r)} />
                ))}
              </MenuList>
            </MenuGroup>
          </Section>
        ))}
        <Section delay={360} px={16} pt={26}>
          <MenuSignOut label={t("menu.signOut")} onPress={() => void signOut().then(() => router.replace("/"))} />
          <Stack pt={16} align="center"><Text size={11.5} color="faint">{t("menu.build", { version })}</Text></Stack>
        </Section>
      </ScrollPage>
    </Screen>
  );
}
