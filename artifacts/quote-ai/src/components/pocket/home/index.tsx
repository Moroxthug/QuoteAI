// Phases 145–146 — Home, the canvas's Main artboard (docs/pocket-design/Main.dc.html), top to
// bottom: header, New quote, Schedule, Today, Business, Crew, Sites. Nothing else is on it.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useCan } from "@/hooks/use-role";
import { peopleApi } from "@/lib/people-api";
import { ApiImg } from "@/components/api-img";
import type { TodayWeatherDto } from "@/lib/today-api";
import { HomeHeader } from "./header";
import { Composer } from "./composer";
import { HomeSchedule } from "./schedule";
import { HomeToday } from "./today";
import { HomeBusiness } from "./business";
import { HomeCrew, HomeSites } from "./crew-sites";
import { useNavShown } from "../shell";

export default function PocketHome() {
  const { user } = useAuth();
  const can = useCan();
  const nav = useNavShown();
  const queryClient = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: peopleApi.me, staleTime: 5 * 60_000 });
  const name = me?.person.name || user?.name || user?.email?.split("@")[0] || "";
  const photo = me?.person.image ?? user?.image ?? null;
  const weather = queryClient.getQueryData<{ weather: TodayWeatherDto | null }>(["pocket-weather"])?.weather ?? null;
  return (
    <div className="pk-page pk-home" style={{ paddingBottom: 0 }}>
      <HomeHeader name={name} photo={photo ? <ApiImg src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null} />
      {can("quotes", "edit") && <Composer city={weather?.site.split(" (")[0] ?? null} />}
      {nav.has("/dashboard/schedule") && can("jobs", "view") && <HomeSchedule />}
      <HomeToday />
      {(can("invoicing", "view") || can("quotes", "view")) && <HomeBusiness />}
      {nav.has("/dashboard/team") && <HomeCrew />}
      {nav.has("/dashboard/jobs") && <HomeSites />}
    </div>
  );
}
