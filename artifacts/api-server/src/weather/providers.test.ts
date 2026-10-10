import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { conditionOfCode, forecastFrom as ecccForecast, periodDates } from "./eccc.js";
import { clearForecastCache, forecastCached, getProvider } from "./provider.js";
import { conditionOf, forecastFrom as kitForecast, precipTypeOf, weatherKitToken } from "./weatherkit.js";
import type { Forecast, WeatherProvider } from "./types.js";

const TZ = "America/Toronto";

describe("WeatherKit", () => {
  it("signs an ES256 token Apple can verify", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const token = weatherKitToken({ teamId: "TEAM123456", serviceId: "ca.quoteai.weather", keyId: "KEY1234567", privateKey: pem }, 1_800_000_000);
    const [h, p, sig] = token.split(".");
    expect(JSON.parse(Buffer.from(h!, "base64url").toString())).toEqual({ alg: "ES256", kid: "KEY1234567", id: "TEAM123456.ca.quoteai.weather" });
    expect(JSON.parse(Buffer.from(p!, "base64url").toString())).toEqual({ iss: "TEAM123456", iat: 1_800_000_000, exp: 1_800_003_600, sub: "ca.quoteai.weather" });
    const ok = createVerify("SHA256").update(`${h}.${p}`).verify({ key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(sig!, "base64url"));
    expect(ok).toBe(true);
  });
  it("maps Apple's condition codes to the nine we draw", () => {
    expect(conditionOf("Clear")).toBe("clear");
    expect(conditionOf("MostlyClear")).toBe("partly_cloudy");
    expect(conditionOf("MostlyCloudy")).toBe("cloudy");
    expect(conditionOf("HeavyRain")).toBe("rain");
    expect(conditionOf("ScatteredShowers")).toBe("showers");
    expect(conditionOf("Snow")).toBe("snow");
    expect(conditionOf("FreezingRain")).toBe("sleet");
    expect(conditionOf("IsolatedThunderstorms")).toBe("thunder");
    expect(conditionOf("Haze")).toBe("fog");
    expect(precipTypeOf("clear")).toBe("none");
    expect(precipTypeOf("snow")).toBe("snow");
  });
  it("turns Apple's reply into hours on the hour, percent and local dates", () => {
    const f = kitForecast({
      currentWeather: { temperature: 11.6, conditionCode: "Cloudy" },
      forecastHourly: { hours: [{ forecastStart: "2026-09-29T11:00:00Z", temperature: 12.2, precipitationChance: 0.7, precipitationType: "rain" }] },
      forecastDaily: { days: [{ forecastStart: "2026-09-29T04:00:00Z", precipitationChance: 0.8, precipitationType: "rain" }] },
    }, TZ);
    expect(f.now).toEqual({ tempC: 12, condition: "cloudy" });
    expect(f.hourly[0]).toEqual({ hour: "2026-09-29T07:00:00-04:00", tempC: 12, precipProb: 70, precipType: "rain" });
    expect(f.daily7[0]).toEqual({ date: "2026-09-29", precipProb: 80, precipType: "rain" });
  });
});

describe("Environment and Climate Change Canada", () => {
  it("dates its named periods from today", () => {
    expect(periodDates(["Today", "Tonight", "Wednesday", "Wednesday night", "Thursday"], "2026-09-29")).toEqual(["2026-09-29", "2026-09-29", "2026-09-30", "2026-09-30", "2026-10-01"]);
  });
  it("maps icon codes", () => {
    expect(conditionOfCode(0)).toBe("clear");
    expect(conditionOfCode(12)).toBe("showers");
    expect(conditionOfCode(16)).toBe("snow");
    expect(conditionOfCode(null)).toBe("cloudy");
  });
  it("builds hours and days, taking the wetter of a day and its night", () => {
    const f = ecccForecast({
      currentConditions: { temperature: { value: { en: 9 } }, iconCode: { value: 10 } },
      hourlyForecastGroup: { hourlyForecasts: [{ timestamp: "2026-09-29T15:00:00Z", iconCode: { value: 12 }, temperature: { value: { en: 10 } }, lop: { value: { en: 70 } } }] },
      forecastGroup: { forecasts: [
        { period: { textForecastName: { en: "Today" } }, abbreviatedForecast: { icon: { value: 10 }, pop: { value: { en: "20" } } } },
        { period: { textForecastName: { en: "Tonight" } }, abbreviatedForecast: { icon: { value: 12 }, pop: { value: { en: "60" } } } },
      ] },
    }, TZ, new Date("2026-09-29T14:00:00Z"));
    expect(f.now.tempC).toBe(9);
    expect(f.hourly[0]).toEqual({ hour: "2026-09-29T11:00:00-04:00", tempC: 10, precipProb: 70, precipType: "rain" });
    expect(f.daily7).toEqual([{ date: "2026-09-29", precipProb: 60, precipType: "rain" }]);
  });
});

describe("the provider and its 30-minute cache", () => {
  const f: Forecast = { now: { tempC: 1, condition: "clear" }, hourly: [], daily7: [] };
  const counting = () => { const p = { name: "mock" as const, calls: 0, fail: false, async forecast() { p.calls++; if (p.fail) throw new Error("down"); return f; } }; return p as typeof p & WeatherProvider; };
  it("asks once in half an hour, again after, and serves an old answer when the source is down", async () => {
    clearForecastCache();
    const p = counting();
    const t0 = 1_000_000_000_000;
    await forecastCached(p, 43.7, -79.4, TZ, t0);
    await forecastCached(p, 43.7, -79.4, TZ, t0 + 29 * 60_000);
    expect(p.calls).toBe(1);
    await forecastCached(p, 43.7, -79.4, TZ, t0 + 31 * 60_000);
    expect(p.calls).toBe(2);
    p.fail = true;
    await expect(forecastCached(p, 43.7, -79.4, TZ, t0 + 90 * 60_000)).resolves.toBe(f);
    await expect(forecastCached(p, 43.7, -79.4, TZ, t0 + 8 * 3_600_000)).rejects.toThrow("down");
  });
  it("picks WeatherKit only with all four credentials, else Environment Canada, and the mock only by name", () => {
    expect(getProvider({} as NodeJS.ProcessEnv).name).toBe("eccc");
    expect(getProvider({ WEATHER_PROVIDER: "mock" } as NodeJS.ProcessEnv).name).toBe("mock");
    expect(getProvider({ WEATHERKIT_TEAM_ID: "a", WEATHERKIT_SERVICE_ID: "b", WEATHERKIT_KEY_ID: "c" } as NodeJS.ProcessEnv).name).toBe("eccc");
    expect(getProvider({ WEATHERKIT_TEAM_ID: "a", WEATHERKIT_SERVICE_ID: "b", WEATHERKIT_KEY_ID: "c", WEATHERKIT_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----" } as NodeJS.ProcessEnv).name).toBe("weatherkit");
  });
});
