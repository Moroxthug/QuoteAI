// RoleHomes.dc.html: what a role's home shows, as the owner previews it from Roles (?role=). The same sections as the person's own Home, in the role's own order, with this company's numbers.
import { useMemo } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { cardView } from "@/home/needsCards";
import { RoleSections } from "@/home/RoleSections";
import { useCollectedWidget, useFollowupsWidget, useOwedWidget, useQuotesWidget, useTasksWidget, useWeatherWidget, type WidgetEntry } from "@/home/widgets";
import type { Locale } from "@/lib/format";
import { needsCard } from "@/lib/home";
import { homeApi } from "@/lib/homeApi";
import { homeOf, isJobRole } from "@/lib/jobRoles";
import { screenHref } from "@/lib/nav";
import { useSession } from "@/lib/useSession";
import { useToast } from "@/ui/Feedback";
import { Header } from "@/ui/Header";
import { ScrollPage } from "@/ui/Layout";
import { NeedsYou } from "@/ui/NeedsYou";
import { Screen } from "@/ui/Screen";
import { SetTitle } from "@/ui/SettingsPages";

export default function RoleHomes() {
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const toast = useToast();
  const signedIn = status === "in" || status === "offline";
  const params = useLocalSearchParams<{ role?: string }>();
  const role = isJobRole(params.role) ? params.role : "officeManager";
  const needs = useQuery({ queryKey: ["home-needs"], queryFn: homeApi.needsYou, enabled: signedIn, retry: 1 });
  const tasksW = useTasksWidget(signedIn);
  const weatherW = useWeatherWidget(signedIn);
  const collectedW = useCollectedWidget(signedIn);
  const owedW = useOwedWidget(signedIn);
  const followW = useFollowupsWidget(needs.data?.items);
  const quotesW = useQuotesWidget(signedIn);
  const entries = useMemo(() => [tasksW, weatherW, collectedW, owedW, followW, quotesW].filter(Boolean) as WidgetEntry[], [tasksW, weatherW, collectedW, owedW, followW, quotesW]);
  if (status === "out") return <Redirect href="/" />;
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("SetRoles", t("jr.title"))));
  const cards = (needs.data?.items ?? []).map(needsCard).map((c) => cardView(c, t as never, locale, toast, () => void needs.refetch()));
  return (
    <Screen>
      <Header title="" backLabel={t("jr.back")} onBack={back} />
      <ScrollPage bottom={56}>
        <SetTitle title={t(`jr.role.${role}`)} lede={t("jr.preview.label")} />
        <RoleSections sections={homeOf(role, null)} entries={entries}
          needs={<NeedsYou cards={needs.isPending && !needs.data ? [] : cards} title={t("home.needs.title")} hint={t("home.needs.hint")} hintDone={t("home.needs.hintDone")} emptyTitle={t("home.needs.allClear")} emptyBody={t("home.needs.allClearBody")} />} />
      </ScrollPage>
    </Screen>
  );
}
