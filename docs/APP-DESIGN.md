# QuoteAI app — design spec (Phase 114)

Source of truth for Phases 115-126. The pictures are `docs/mockups/app/index.html` (published privately for review at https://claude.ai/artifact/Jx2qihtQht7soqPR67yZ2T, where the owner approves or asks for a change on each screen). This file is the words; where they disagree, the approved mockup wins.

Decisions it assumes (APP-PLAN §2): **D-1 dark mode follows the phone** (app only at first), **D-2 phone only**.

## 1. The map, per role

| Role | Tabs | First screen shows | + creates |
|---|---|---|---|
| Owner · office · admin · viewer | Today · Quotes · Jobs · Money · More | Needs you (≤ 3 rows, one button each), the month in 4 numbers, crew on site, recent quotes | quote, lead, job, invoice, receipt photo, job note |
| Starter plan (no jobs/invoices) | Today · Quotes · Clients · Leads · More | as owner | quote, lead |
| Foreman | Today · Jobs · Schedule · Crew · More | clocked in (x / y), hours to approve, today's jobs with what is next | note, photo, receipt, schedule block |
| Worker (crew) | Now · Tasks · Report · Me | the shift, the job, address → Maps, site contact, today's notes, **Clock in** | — (Photo and Report docked on Now) |

- The **violet mic** (the assistant, VOICE-ASSISTANT-PLAN) is in the top bar of every tab's first screen and in Today's ask row. Violet is used for nothing else.
- **More** is a menu of rows: account; Notifications and Sync; Work (clients, leads, contracts, catalog); Business (company, taxes, integrations, team); This app (appearance, language, face/fingerprint unlock, help and videos); sign out. **No prices or upgrade in the app build** (store rules, Phase 118 `isNativeApp`).
- Each tab keeps its own history and scroll (as Phase 101).

## 2. Screens and their one action

| Screen | Screen one | Primary (docked unless noted) | ⋯ / elsewhere |
|---|---|---|---|
| Today | greeting, ask row, Needs you, 2×2 strip, crew, recent quotes | New quote (pill by the greeting) | company switch on the name; period in the numbers' ⋯ |
| Quotes | search, filter chips with counts, rows grouped This week / Earlier | New quote | sort, archived, export |
| New quote (typing) | For (client), the job box focused with room to type | Write my quote; mic beside it | Options sheet: layout, target, tax, deposit |
| New quote (dictating) | sheet over the form: live words, waveform, timer | Done | Cancel |
| Quote detail | status chip, client · number · date, total 34 px, lines as the client sees them, activity | Send → Remind → Start the job (by status) | edit, copy link, PDF, duplicate, contract, delete |
| Send | sheet: Email / Text / Link, to, message pre-written, follow-up on | Send quote | attach PDF, CC me |
| Jobs | search, filter chips, rows with one status word | + in the top bar | map, sort, archived |
| Job | address (Maps), stage + day x of y + bar, scrolling tabs on screen one, blocker, 2-number budget, on site, latest | Note (dictate); Photo second | edit plan, hold, complete, share, invoice |
| Photo capture | full-screen camera (always dark), job chip at top, Receipt / Photo / Document | shutter | flash, gallery (thumbnail) |
| Money | Owed · Overdue · Paid (one strip), filter chips, invoices needing action first, Also in Money (Pay, Books) | New invoice | — |
| Invoice + record payment | late chip, still-owed large, billed/paid; record sheet with keypad, method chips, date | Record $x | reminder, pay link, PDF, void |
| Client | name, 4 contact buttons, one-line client quality, open, history, notes | New quote for this client | edit, merge, portal link, archive |
| Assistant | transcript: you / looked up / answer / action card | big violet mic; Confirm on the card | keyboard, stop, history |
| Notifications | Today / Earlier, unread dot, tap opens the exact screen | — | mark all read, settings |
| More | account, then grouped rows | — | — |
| Integrations | search, category chips, Connected (with health), Add, Coming (one line) | tap an app → its own screen with Connect | — |
| Offline | same screen + calm banner "Offline — showing what was synced at 9:42…", rows with changes waiting say so, sync pill in the bar | unchanged | sync pill → Sync |
| Sync | Needs you (conflicts in words, both values), Sending, Sent today | per conflict: keep mine / keep theirs | discard (confirmed), copy details |
| Foreman Today | strip (clocked in, hours to approve), approve rows, today's jobs | Approve (button + swipe) | — |
| Schedule day | week strip with dots (red = double-booked), By person / By job, agenda, Free today | Add block | copy yesterday; week grid stays on a computer |
| Crew Now | Now card with Clock in (60 px, green) | Clock in / out; Report docked, Photo beside | hours by hand, travel, company, language |
| Welcome | line drawing, one-sentence promise, EN/FR switch | Create an account; "I have an account" second | — |
| Sign in | email (autofill), password, code by email, Google | Sign in | forgot; 2FA screen follows; offer face/fingerprint after first sign-in |
| First run · business | 3 steps, trades as wrapping chips, province (sets tax), business name | Continue (every step skippable) | Skip |
| First quote sent | success, then the only notification ask, with its reason | Turn on notifications; Not now (asks again after 30 days at most) | — |

## 3. Visual language

Figtree (as the web). Neutrals lean navy. Light then dark:

| Token | Light | Dark | Use |
|---|---|---|---|
| `--a-bg` | #f6f6f9 | #0d0e1a | ground |
| `--a-surface` | #ffffff | #171828 | grouped lists, sheets |
| `--a-surface-2` | #eef0f4 | #212336 | fills, search, icon tiles |
| `--a-line` / `--a-line-2` | #e3e5eb / #d3d6de | #2a2c42 / #383b55 | 1 px separators / control borders |
| `--a-title` / `--a-ink` / `--a-muted` / `--a-faint` | #16172e / #34354a / #666879 / #8a8c9b | #eeeff8 / #cfd1dd / #9a9cae / #77798d | text |
| `--a-primary` / `--a-on-primary` | #101031 / #fff | #e4e4fa / #101031 | the one primary button, active chip |
| `--a-violet` | #5b2bd6 | #7c4dff | assistant only |
| `--a-green` (+ `-t`) | #227a15 / #e7f4e3 | #79d466 / 14 % | paid, accepted, on track, Clock in |
| `--a-teal` | #0a7580 / #e1f3f2 | #5cccd6 / 14 % | sent, viewed, in progress, links |
| `--a-amber` | #7a5c00 / #fdf3c4 | #f0cf4b / 14 % | draft, due, at risk, offline |
| `--a-red` | #bf3d09 / #fdece3 | #ff8f66 / 14 % | late, blocked, conflict, destructive |

- **Type**: big number 34/800 · tab title 26/800 · screen title and section 17/700 · row 15/600 · body 15/400 · meta 13/400 · chip 11.5/700. Fields 16 px (no iOS zoom).
- **Space and shape**: 16 px gutters, 12 px between blocks, rows ≥ 60 px, targets ≥ 44 px, docked buttons 48 px; lists/cards 16 px radius, buttons 14, sheets 22 (top), chips pills. Shadows only on sheets; everything else a 1 px line.
- **Icons**: lucide, 1.75 stroke; 22-23 px in bars, 19 in rows, 16 inline; active tab 2.2 stroke. No emoji.
- **Numbers**: tabular figures; no cents in lists and totals, cents on invoices and payments; French `14 500 $`, `7,5 h`, `64 %`, `9 h 42`, `1er oct.`; relative time only under a day.
- **Status**: always a chip with a word; one status colour per row.
- **Empty states**: a quiet line drawing in the title colour with one teal detail, one sentence, one button. No mascots, glow or gradients ([[feedback-professional-visual-design]]).
- **Dark**: designed, not inverted — navy-black ground, pale-lavender primary with navy text, lighter status colours on 14 % tints; the camera is always dark.

## 4. Motion and feel (built in Phase 120)

| Moment | Motion | Haptic | Reduced motion |
|---|---|---|---|
| Open a screen | slide in from the right 300 ms `cubic-bezier(.2,.8,.2,1)`; old screen drifts 28 % left, dims | — | 120 ms fade |
| Back (‹, Android back, edge swipe) | reverse 260 ms; edge swipe follows the finger, springs home before 40 % | — | fade |
| Switch tab | 160 ms cross-fade; tab keeps history + scroll | selection | instant |
| Sheet | rise 320 ms `cubic-bezier(.2,.9,.25,1)`, scrim 220 ms; drag follows finger; closes past 30 % or a flick | — | fade |
| Success (sent, paid, approved) | check in the button 900 ms, row updates in place | success | check, no scale |
| Destructive confirm | sheet only | warning | — |
| Pull to refresh | spinner follows; threshold 72 px | light at threshold | spinner |
| Swipe a row | row follows; action colour beneath; springs back if cancelled | tick at commit | button only |
| Listening | waveform from voice level | light on start/stop | static level bar |

Never animated: counting numbers, staggered lists, parallax, confetti, anything on a timer. Skeletons shaped like the content, shown only past 300 ms.
