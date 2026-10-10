// Weather for job sites (docs/pocket-design/handoff/WEATHER.md). One interface, `WeatherProvider.forecast(lat, lng)`, so the source can be swapped: Apple WeatherKit (recommended), Environment and
// Climate Change Canada (free, bilingual, Open Government Licence: what runs without Apple credentials) or the mock that returns the board's numbers.

export type Condition = "clear" | "partly_cloudy" | "cloudy" | "rain" | "showers" | "snow" | "sleet" | "fog" | "thunder";
export type PrecipType = "rain" | "snow" | "sleet" | "none";

export type HourForecast = { /** ISO instant with the company's UTC offset, on the hour. */ hour: string; tempC: number; precipProb: number; precipType: PrecipType };
export type DayForecast = { /** The local calendar date, YYYY-MM-DD. */ date: string; precipProb: number; precipType: PrecipType };

/** What a provider returns for one place: now, the hours still to come today and tomorrow, and up to 7 days. */
export type Forecast = { now: { tempC: number; condition: Condition }; hourly: HourForecast[]; daily7: DayForecast[] };

export interface WeatherProvider {
  readonly name: "mock" | "weatherkit" | "eccc";
  /** `tz` is the IANA zone of the company (the hours and dates in the answer are in it). */
  forecast(lat: number, lng: number, tz: string): Promise<Forecast>;
  /** Only the mock sets this: the moment it pretends it is (9:40 am, as on the board). */
  now?(tz: string): Date;
}

/** The words the app turns into text (EN/FR) so both languages always match. */
export type SummaryKey = "rain_after" | "rain_now" | "rain_all_day" | "snow_after" | "snow_now" | "dry_all_day" | "freezing";
export type AdviceKey = "exterior_before" | "exterior_after" | "inside_only" | "good_exterior";

export type SiteWeather = {
  siteId: string;
  name: string;
  area: string;
  crewCount: number;
  /** True for the company address, used when no job site is scheduled today. */
  isCompany?: boolean;
  now: { tempC: number; condition: Condition };
  hourly: HourForecast[];
  daily7: (DayForecast & { visits: number })[];
  summaryKey: SummaryKey;
  summaryAt: string | null;
  adviceKey: AdviceKey | null;
  adviceAt: string | null;
};

export type Attribution = { name: string; legalUrl: string; logoLightUrl?: string; logoDarkUrl?: string };

/** GET /api/v1/weather/today */
export type WeatherToday = { fetchedAt: string; primarySiteId: string | null; sites: SiteWeather[]; provider: WeatherProvider["name"]; attribution: Attribution | null };
