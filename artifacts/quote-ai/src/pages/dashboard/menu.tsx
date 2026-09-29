/**
 * Phase 148 — Menu: the canvas's Menu artboard (docs/pocket-design/Menu.dc.html), 1:1.
 * Reached from the avatar on Home. Profile card, the plan strip, then Business · Team ·
 * Money · App, Sign out and the build line. The app's other sections sit in these groups
 * as the same rows (docs/POCKET-DESIGN-PLAN.md, Decisions 4).
 */
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useGetSubscription, useListCatalogItems,
  useGetQuickbooksStatus, getGetQuickbooksStatusQueryKey, useGetWaveStatus, getGetWaveStatusQueryKey,
} from "@workspace/api-client-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/use-auth";
import { useCan, useRole } from "@/hooks/use-role";
import { peopleApi } from "@/lib/people-api";
import { teamMembersApi } from "@/lib/team-members-api";
import { crewApi } from "@/lib/team-api";
import { pushApi } from "@/lib/push-api";
import { stripeConnectApi } from "@/lib/invoices-api";
import { clearOfflineCaches } from "@/lib/pwa";
import { pointCacheAtOrg } from "@/lib/offline/query-cache";
import { signOut } from "@/lib/sign-out";
import { useBusinessProfile } from "@/pages/dashboard/settings/data";
import { planLabelOf } from "@/pages/dashboard/settings/plan";
import { ApiImg } from "@/components/api-img";
import { Avatar, BackHeader, GroupLabel, MenuRow, initialsOf, rise } from "@/components/pocket/kit";
import { ChevronIcon } from "@/components/pocket/icons";
import { useNavShown } from "@/components/pocket/shell";
import { PROVINCE_TAX } from "@/pages/dashboard/settings/data";

const card = "pk-card-20";
const taxName = (tax: string, lang: string) => (lang === "fr" ? ({ GST: "TPS", HST: "TVH" } as Record<string, string>)[tax] ?? tax : tax);

export default function MenuPage() {
  const { t, lang: language } = useLanguage();
  const can = useCan();
  const { role } = useRole();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const nav = useNavShown();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: peopleApi.me, staleTime: 5 * 60_000 });
  const { data: sub } = useGetSubscription();
  const { data: profile } = useBusinessProfile();
  const { data: orgs } = useQuery({ queryKey: ["team-orgs"], queryFn: teamMembersApi.orgs, staleTime: 60_000 });
  const owner = can("settings", "full");
  const { data: members } = useQuery({ queryKey: ["team-members"], queryFn: teamMembersApi.list, enabled: nav.has("/dashboard/team") && can("team", "view"), retry: false });
  const { data: crew } = useQuery({ queryKey: ["crew-today"], queryFn: crewApi.today, enabled: nav.has("/dashboard/team"), retry: false });
  const { data: catalog } = useListCatalogItems({ query: { queryKey: ["/api/catalog"], enabled: nav.has("/dashboard/catalog"), retry: false } });
  const { data: push } = useQuery({ queryKey: ["push-preferences"], queryFn: pushApi.preferences, retry: false });
  const { data: stripe } = useQuery({ queryKey: ["stripe-connect-status"], queryFn: stripeConnectApi.status, enabled: owner, retry: false });
  const qb = useGetQuickbooksStatus({ query: { queryKey: getGetQuickbooksStatusQueryKey(), enabled: owner, retry: false } });
  const wave = useGetWaveStatus({ query: { queryKey: getGetWaveStatusQueryKey(), enabled: owner, retry: false } });
  const switchOrg = useMutation({
    mutationFn: (orgId: string) => teamMembersApi.switchOrg(orgId),
    onSuccess: async (r) => { pointCacheAtOrg(r.orgId); await clearOfflineCaches(); queryClient.clear(); window.location.href = "/dashboard"; },
  });

  const name = me?.person.name || user?.name || user?.email?.split("@")[0] || "";
  const photo = me?.person.image ?? user?.image ?? null;
  const company = profile?.companyName ?? "";
  const plan = planLabelOf(sub?.plan);
  const renews = sub?.periodEnd ? new Date(sub.periodEnd).toLocaleDateString(language === "fr" ? "fr-CA" : "en-CA", { month: "short", day: "numeric" }) : null;
  const seats = members?.seats.limit;
  const awaiting = crew && "awaitingApproval" in crew ? (crew.awaitingApproval?.length ?? 0) : 0;
  const pushOn = push ? push.categories.length - push.muted.length : null;
  const accounting = qb.data?.connected ? "QuickBooks" : wave.data?.connected ? "Wave" : t("pocket.menu.notConnected");
  const taxRate = profile?.taxProfile?.totalRate;
  const has = (href: string) => nav.has(href);

  return (
    <div className="pk-page pk-noscroll">
      <BackHeader backHref="/dashboard" backLabel={t("pocket.backHome")} />

      <section className="pk-rise" style={{ padding: "4px 16px 0" }}>
        <Link href="/dashboard/me" className="pk-press" style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, background: "#ffffff", borderRadius: 22, boxShadow: "var(--pk-shadow-card)", color: "var(--pk-ink)", textDecoration: "none" }}>
          <Avatar initials={initialsOf(name)} size={52} fontSize={17} dark image={photo ? <ApiImg src={photo} alt="" /> : undefined} />
          <span style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.03em" }}>{name}</span>
            <span style={{ fontSize: 12.5, color: "var(--pk-text-2)" }}>{[company, role ? t(`group.role.${role}`) : ""].filter(Boolean).join(" · ")}</span>
          </span>
          <ChevronIcon size={16} className="" />
        </Link>
        {owner && (
          <div style={{ marginTop: 10, padding: "12px 16px", borderRadius: 18, background: "#151517", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 13.5, fontWeight: 500 }}>{plan ? t("pocket.menu.plan").replace("{plan}", plan) : t("pocket.menu.freePlan")}</span>
              {(renews || seats) && (
                <span style={{ fontSize: 12, color: "rgba(255,255,255,.55)" }}>
                  {[renews && sub?.isActive ? t("pocket.menu.renews").replace("{date}", renews) : null, seats ? t(seats === 1 ? "pocket.menu.seat" : "pocket.menu.seats").replace("{n}", String(seats)) : null].filter(Boolean).join(" · ")}
                </span>
              )}
            </span>
            <Link href="/dashboard/settings/plan" className="pk-press" style={{ height: 32, padding: "0 12px", borderRadius: 10, background: "rgba(255,255,255,.1)", color: "#ffffff", fontSize: 12.5, fontWeight: 500, display: "flex", alignItems: "center", textDecoration: "none" }}>{t("pocket.menu.manage")}</Link>
          </div>
        )}
      </section>

      {(orgs?.items.length ?? 0) > 1 && (
        <section className="pk-section pk-rise" style={rise(1)} aria-labelledby="menu-company">
          <GroupLabel id="menu-company">{t("pocket.menu.companies")}</GroupLabel>
          <div className={card}>
            {orgs!.items.map((o) => {
              const on = o.orgId === orgs!.activeOrgId;
              return <MenuRow key={o.orgId} icon="building" label={o.isOwn ? (o.companyName || t("team.switcher.myCompany")) : o.companyName} value={on ? t("pocket.menu.current") : undefined} onClick={() => !on && !switchOrg.isPending && switchOrg.mutate(o.orgId)} />;
            })}
          </div>
        </section>
      )}

      <section className="pk-section pk-rise" style={rise(1)} aria-labelledby="menu-business">
        <GroupLabel id="menu-business">{t("pocket.menu.business")}</GroupLabel>
        <div className={card}>
          <MenuRow icon="building" label={t("pocket.menu.companyProfile")} value={profile?.gstHstNumber ? t("pocket.menu.taxNumberOnFile").replace("{tax}", taxName(PROVINCE_TAX[profile.province ?? ""]?.split(" ")[0] ?? "GST", language)) : undefined} href="/dashboard/settings/company" />
          {has("/dashboard/catalog") && <MenuRow icon="tag" label={t("pocket.menu.priceBook")} value={catalog ? t(catalog.length === 1 ? "pocket.menu.item" : "pocket.menu.items").replace("{n}", String(catalog.length)) : undefined} href="/dashboard/catalog" />}
          {owner && <MenuRow icon="percent" label={t("pocket.menu.taxes")} value={profile?.province ? `${profile.province}${taxRate != null ? ` · ${Math.round((taxRate > 1 ? taxRate : taxRate * 100) * 1000) / 1000}%` : ""}` : undefined} href="/dashboard/settings/taxes" />}
          {has("/dashboard/leads") && <MenuRow icon="users" label={t("dashboard.nav.leads")} href="/dashboard/leads" />}
          {has("/dashboard/contracts") && <MenuRow icon="file" label={t("dashboard.nav.contracts")} href="/dashboard/contracts" />}
          {has("/dashboard/documents") && <MenuRow icon="file" label={t("dashboard.nav.documents")} href="/dashboard/documents" />}
          {has("/dashboard/analytics") && <MenuRow icon="percent" label={t("dashboard.nav.analytics")} href="/dashboard/analytics" />}
          {has("/dashboard/group") && <MenuRow icon="building" label={t("dashboard.nav.group")} href="/dashboard/group" />}
          {has("/dashboard/imports") && <MenuRow icon="sync" label={t("dashboard.nav.imports")} href="/dashboard/imports" />}
          {has("/dashboard/archive") && <MenuRow icon="file" label={t("dashboard.nav.archive")} href="/dashboard/archive" />}
        </div>
      </section>

      {(has("/dashboard/team") || has("/dashboard/schedule") || has("/dashboard/pay")) && (
        <section className="pk-section pk-rise" style={rise(2)} aria-labelledby="menu-team">
          <GroupLabel id="menu-team">{t("pocket.menu.team")}</GroupLabel>
          <div className={card}>
            {has("/dashboard/team") && <MenuRow icon="users" label={t("pocket.menu.crewAndRoles")} value={members ? t(members.items.length === 1 ? "pocket.menu.person" : "pocket.menu.people").replace("{n}", String(members.items.length)) : undefined} href="/dashboard/team?tab=members" />}
            {has("/dashboard/team") && <MenuRow icon="clock" label={t("pocket.menu.timesheets")} value={awaiting > 0 ? t("pocket.menu.toApprove").replace("{n}", String(awaiting)) : undefined} accent={awaiting > 0} href="/dashboard/team?tab=time" />}
            {has("/dashboard/schedule") && <MenuRow icon="clock" label={t("dashboard.nav.schedule")} href="/dashboard/schedule" />}
            {has("/dashboard/pay") && <MenuRow icon="card" label={t("dashboard.nav.pay")} href="/dashboard/pay" />}
          </div>
        </section>
      )}

      {(owner || has("/dashboard/invoices") || has("/dashboard/books") || has("/dashboard/compliance")) && (
        <section className="pk-section pk-rise" style={rise(3)} aria-labelledby="menu-money">
          <GroupLabel id="menu-money">{t("pocket.menu.money")}</GroupLabel>
          <div className={card}>
            {has("/dashboard/invoices") && <MenuRow icon="file" label={t("dashboard.nav.invoices")} href="/dashboard/invoices" />}
            {owner && <MenuRow icon="card" label={t("pocket.menu.payments")} value={stripe ? (stripe.connected && stripe.payoutsEnabled ? t("pocket.menu.connected") : t("pocket.menu.notConnected")) : undefined} href="/dashboard/settings/apps?app=stripe" />}
            {owner && <MenuRow icon="sync" label={t("pocket.menu.accounting")} value={qb.isFetched || wave.isFetched ? accounting : undefined} href="/dashboard/settings/apps" />}
            {has("/dashboard/books") && <MenuRow icon="card" label={t("dashboard.nav.books")} href="/dashboard/books" />}
            {has("/dashboard/compliance") && <MenuRow icon="building" label={t("dashboard.nav.compliance")} href="/dashboard/compliance" />}
          </div>
        </section>
      )}

      <section className="pk-section pk-rise" style={rise(4)} aria-labelledby="menu-app">
        <GroupLabel id="menu-app">{t("pocket.menu.app")}</GroupLabel>
        <div className={card}>
          <MenuRow icon="gear" label={t("dashboard.account.settings")} href="/dashboard/settings" />
          <MenuRow icon="bell" label={t("notifications.title")} value={pushOn != null && pushOn > 0 ? t("pocket.menu.nOn").replace("{n}", String(pushOn)) : undefined} href="/dashboard/notifications" />
          <MenuRow icon="help" label={t("pocket.menu.help")} href="/help" />
        </div>
      </section>

      <section className="pk-section pk-rise" style={rise(5)}>
        <button type="button" className="pk-press" onClick={() => void signOut()} style={{ width: "100%", height: 50, borderRadius: 16, border: 0, background: "#ffffff", boxShadow: "var(--pk-shadow-card)", color: "var(--pk-danger)", fontSize: 14, fontWeight: 500, fontFamily: "inherit", cursor: "pointer" }}>{t("dashboard.account.signOut")}</button>
        <p className="pk-mono" style={{ margin: "16px 0 0", textAlign: "center", fontSize: 11, color: "var(--pk-text-4)" }}>quoteAI · {t("pocket.menu.build")} {String(import.meta.env.VITE_RELEASE ?? "").slice(0, 12) || "dev"}</p>
      </section>
    </div>
  );
}
