# Weather

Weather is a working feature of the app, not decoration, and not mock data. Contractors plan outdoor work around rain. It appears in four places. All four read from one backend service.

## Where it shows

| Place | Board | What it shows |
|---|---|---|
| Home header | SmartHome, first line | `Tue, Sep 29 · ☁ 12°, rain after 3 pm`. Date, then a 14pt weather glyph, then the temperature and a short summary. 12.5/500, `muted`. |
| Site weather widget (Today row) | SmartHome, "Site weather" card | **Collapsed:** temperature in Manrope 34, a summary ("Rain after 3 pm"), a cloud icon, 8 hourly rain bars (height = probability, opacity .25 to 1, staggered grow-in) with hour labels, and one practical line ("Plan exterior work before 14:00"). **Expanded:** one block per active site: name, area, current temperature, summary, 6 two-hour slots (hour, temperature, rain %; slots at 50% or more get the `info-soft` background), and one practical note. |
| This week widget | SmartHome, "This week" card | A 7-day strip. Days with rain at 50% or more get a rain-drop glyph. The footer names the best dry day for outside work. |
| Assistant proposals | AssistantProposals, Schedule | Rain-driven suggestions such as "Fri Oct 2 · rain all day → inside work only" and "Gill deck stain moves to Wed". Phase 5. Uses the same service. |

The header and the Site weather widget are **Phase 2** (Home). This week is Phase 2 as well. Assistant proposals are Phase 5.

## Which location

Weather is for **job sites**, not for the phone's location. The app never asks for device location for weather.

1. **Header and collapsed widget:** the site where most crew are scheduled today. In solo mode, use the site of the next visit today.
2. **If nothing is scheduled today:** the company address from SetCompany.
3. **Expanded widget:** every site with a visit or crew today, up to 4. Sort by how many people are there.
4. Sites are geocoded once, when the job's address is saved. Store lat/lng on the site; never geocode on Home load.

## Copy rules (EN / FR)

| Situation | EN | FR |
|---|---|---|
| Rain starts later today (≥ 50% in a future hour) | `rain after 3 pm` | `pluie après 15 h` |
| Rain now | `raining until 2 pm` | `pluie jusqu’à 14 h` |
| Rain all day | `rain all day` | `pluie toute la journée` |
| Dry | `dry all day` | `sec toute la journée` |
| Snow | `snow after 3 pm` | `neige après 15 h` |
| Cold enough to matter (≤ 0°) | `−4°, freezing` | `−4°, gel` |

- Temperature is always °C, rounded, with the real minus sign (−). Digits in Manrope like everywhere else.
- Times follow the locale: `3 pm` / `15 h`. Never "15:00" in the header.
- **Practical line:** one sentence, picked by rule, no AI call.
  - Rain later: `Plan exterior work before 14:00` (1 hour before rain starts).
  - Rain all day: `Inside work only today`.
  - Dry: `Good day for exterior work`.
  - French versions from SmartHomeFR.
- Copy the exact strings from SmartHome.dc.html and SmartHomeFR.dc.html; this table explains the logic.

## Data source

**Recommended: Apple WeatherKit REST API, called from the quoteAI backend.**

- 500,000 calls a month are included with the Apple Developer Program membership the iOS app needs anyway. Paid tiers start at 1M calls for US$49.99 a month.
- It's a REST API, so the same backend serves iPhone and Android.
- **Attribution is required:** wherever Apple weather data is shown, display the Apple Weather mark ("Weather") and the legal link to its data sources.
  - Put it in the expanded Site weather card, under the last site: 11.5, `muted`, linking to the legal page.
  - Add the same line in Settings → About.
  - Check the header line against Apple's current attribution guidelines before launch.
- Don't use Open-Meteo's free API: its terms say it's for non-commercial use only. Its paid plans (Standard, 1M calls a month) are an alternative if WeatherKit is ruled out.

Keep the provider behind one interface (`WeatherProvider.forecast(lat, lng)`) so it can be swapped.

## Backend contract

`GET /v1/weather/today` (auth: the user's company)

```json
{
  "fetchedAt": "2026-09-29T13:02:00Z",
  "primarySiteId": "site_hart",
  "sites": [
    {
      "siteId": "site_hart",
      "name": "Galloway Rd basement",
      "area": "Scarborough",
      "crewCount": 2,
      "now": { "tempC": 12, "condition": "cloudy" },
      "hourly": [ { "hour": "2026-09-29T07:00:00-04:00", "tempC": 11, "precipProb": 0, "precipType": "rain" } ],
      "daily7": [ { "date": "2026-10-01", "precipProb": 80, "precipType": "rain" } ],
      "summaryKey": "rain_after", "summaryAt": "2026-09-29T15:00:00-04:00",
      "adviceKey": "exterior_before", "adviceAt": "2026-09-29T14:00:00-04:00"
    }
  ]
}
```

- The backend computes `summaryKey` and `adviceKey`. The app turns them into words with i18n, so EN and FR always match.
- The backend caches each site for 30 minutes, which keeps calls far under the free quota. The app refetches on Home focus if older than 30 minutes, and on pull-to-refresh.
- `condition` values: `clear`, `partly_cloudy`, `cloudy`, `rain`, `showers`, `snow`, `sleet`, `fog`, `thunder`. Each maps to one glyph in `icons.json`; use the `cloud` glyph with the `sky` tone as default.

## States (build all of them)

| State | Header | Widget |
|---|---|---|
| Loaded | as above | as above |
| Loading (first load) | date only, then the weather fades in | skeleton: number block, 8 bar stubs |
| Stale (offline, cache under 6 h old) | shows cached values | adds `Updated 9:40 am` in `faint` |
| No data (offline, nothing cached, or error) | date only, no gap | collapsed card shows `Weather unavailable` and a retry text button |
| No sites yet (new account) | uses company address | widget shows the company city |

Never show a spinner, and never block Home on weather.

## Mock first, real second

During Phase 2, build the UI against a `MockWeatherProvider` that returns exactly the board's numbers: Galloway Rd 12°, rain probabilities `[0,0,5,20,70,85,60,30]` from 7 am, and Whitfield 13° dry. Then wire the real endpoint in the same phase. **Phase 2 isn't done until Home shows live weather for a real address.**
