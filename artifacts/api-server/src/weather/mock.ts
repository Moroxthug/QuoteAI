import type { Condition, DayForecast, Forecast, HourForecast, WeatherProvider } from "./types.js";
import { localDate } from "./summary.js";
import { addDays, zonedIso } from "./time.js";

// MockWeatherProvider: the numbers SmartHome.dc.html draws, so the app can be built and checked against the board. Galloway Rd (Scarborough) is 12 degrees with rain probabilities 0, 0, 5, 20, 70,
// 85, 60, 30 from 7 am; Whitfield (Toronto) is 13 degrees and dry. The hours are two hours apart (7, 9, ... 21) so that the first 50 % hour is 3 pm, which is what the board's header ("rain after
// 3 pm") and advice ("Plan exterior work before 14:00") say. The clock is fixed at 9:40 am, as on the board.

const HOURS = [7, 9, 11, 13, 15, 17, 19, 21];
const GALLOWAY = { temps: [11, 12, 13, 13, 12, 11, 10, 9], rain: [0, 0, 5, 20, 70, 85, 60, 30], now: 12, days: [30, 20, 80, 90, 10, 0, 30] };
const WHITFIELD = { temps: [12, 13, 14, 14, 13, 12, 11, 10], rain: [0, 0, 5, 10, 15, 10, 5, 0], now: 13, days: [10, 10, 20, 20, 10, 0, 10] };

export class MockWeatherProvider implements WeatherProvider {
  readonly name = "mock" as const;
  constructor(private readonly clock: () => Date = () => new Date()) {}

  /** 9:40 am on the zone's current date. */
  now(tz: string): Date {
    const date = localDate(this.clock(), tz);
    return new Date(Date.parse(zonedIso(date, 9, tz)) + 40 * 60_000);
  }

  async forecast(lat: number, _lng: number, tz: string): Promise<Forecast> {
    const d = Math.abs(lat - 43.77) < 0.1 ? GALLOWAY : WHITFIELD;
    const date = localDate(this.clock(), tz);
    const hourly: HourForecast[] = HOURS.map((h, i) => ({ hour: zonedIso(date, h, tz), tempC: d.temps[i]!, precipProb: d.rain[i]!, precipType: d.rain[i]! > 0 ? "rain" : "none" }));
    const daily7: DayForecast[] = d.days.map((p, i) => ({ date: addDays(date, i), precipProb: p, precipType: p > 0 ? "rain" : "none" }));
    const condition: Condition = "cloudy";
    return { now: { tempC: d.now, condition }, hourly, daily7 };
  }
}
