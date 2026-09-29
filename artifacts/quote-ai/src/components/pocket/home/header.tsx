// Home's header (docs/pocket-design/Main.dc.html): "Tue, Sep 29 · ☁ 12°, rain after 3 pm",
// "Good morning, Marco", and the 40 px dark avatar that opens Menu (an orange dot while
// something is unread).
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/i18n/LanguageContext";
import { useUnreadNotifications } from "@/components/notifications-bell";
import { pocketApi, type TodayWeatherDto } from "@/lib/today-api";
import { WeatherIcon } from "../icons";
import { initialsOf } from "../kit";
import { dateLine, hourWord } from "./format";

function weatherLine(w: TodayWeatherDto, lang: "en" | "fr", t: (k: string) => string): string {
  const temp = w.tempC != null ? `${Math.round(w.tempC)}°` : "";
  let phrase: string;
  if (w.next) phrase = t(`pocket.wx.${w.next.kind}After`).replace("{time}", hourWord(w.next.at, lang));
  else {
    const c = w.condition[lang] || w.condition.en;
    phrase = c ? c.charAt(0).toLowerCase() + c.slice(1) : "";
  }
  return [temp, phrase].filter(Boolean).join(", ");
}

export function HomeHeader({ name, photo }: { name: string; photo: React.ReactNode | null }) {
  const { t, lang } = useLanguage();
  const unread = useUnreadNotifications();
  const { data } = useQuery({ queryKey: ["pocket-weather"], queryFn: () => pocketApi.weather(), staleTime: 15 * 60_000, retry: false });
  const w = data?.weather ?? null;
  const now = new Date();
  const h = now.getHours();
  const greet = t(h < 12 ? "pocket.home.morning" : h < 18 ? "pocket.home.afternoon" : "pocket.home.evening").replace("{name}", name.split(" ")[0] ?? "");
  return (
    <header className="pk-rise" style={{ padding: "18px 20px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 500, color: "var(--pk-text-2)", flexWrap: "wrap" }}>
          {dateLine(now, lang)}
          {w && (
            <>
              <span aria-hidden="true" style={{ width: 3, height: 3, borderRadius: "50%", background: "#b9b8b4" }} />
              <WeatherIcon kind={w.next ? w.next.kind : w.kind} />
              {weatherLine(w, lang, t)}
            </>
          )}
        </span>
        <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.15, fontWeight: 600, letterSpacing: "-0.035em", color: "var(--pk-ink)" }}>{greet}</h1>
      </div>
      <Link href="/dashboard/menu" className="pk-press" aria-label={unread > 0 ? t("pocket.home.menuUnread").replace("{n}", String(unread)) : t("pocket.home.menu")} style={{ position: "relative", width: 40, height: 40, flexShrink: 0, borderRadius: "50%", background: "#141416", color: "#ffffff", fontSize: 13, fontWeight: 600, marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
        {photo ? <span style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", display: "block" }}>{photo}</span> : initialsOf(name)}
        {unread > 0 && <span aria-hidden="true" style={{ position: "absolute", top: -1, right: -1, width: 10, height: 10, borderRadius: "50%", background: "#e4572e", border: "2px solid #f5f4f1" }} />}
      </Link>
    </header>
  );
}
