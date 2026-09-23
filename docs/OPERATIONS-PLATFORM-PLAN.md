# QuoteAI — Operations platform plan (Phases 85-90)

Written 2026-09-22, after the pilot plan closed at Phase 84. `PILOT-LAUNCH-PLAN.md` took the product to something a contractor can be sold; this plan takes it to something a *company* runs on. Same conventions: one phase per commit, a build log entry per phase, owner-track items called out separately because they need a person, not code.

**Order is deliberate.** Each phase either closes a gap a pilot user will hit in week one, or lays the data the next phase needs. Nothing here blocks launch — `LAUNCH-GO-NO-GO.md` §1 still does.

---

## 1. What already exists (so we build on it, not beside it)

| Area | State today |
|---|---|
| Roles | Five (`owner`, `admin`, `office`, `foreman`, `viewer`), one matrix in `lib/permissions`, enforced server-side by `requirePermission` and mirrored in the UI by `useCan()`. `office` is the estimator role. |
| Multiple companies | A person can belong to several; `GET /api/team/orgs` + the sidebar switcher scope every request. No rollup *across* companies. |
| Schedule | `schedule_blocks` (worker × job × window), a drag-and-drop board at `/dashboard/schedule` (Pro), conflict detection, milestones with planned start/end. |
| Calendar | **One-way push only**: a block becomes an event in Google Calendar or Outlook (`calendar/sync.ts`, Elite). Nothing is ever read back. No ICS. No widget anywhere. |
| Time | GPS clock-in at `/t/:token`, approvals, `payroll-summary.csv` (hours only, no pay math). |
| Accounting | One-way QuickBooks and Wave sync (confirmed costs, paid invoices). Flinks bank feed for matching. |
| Tax | Province profiles drive quotes, invoices and contracts (GST/HST/QST split, QC at three decimals). |
| Compliance | Province-specific contract clauses, holdbacks, lien periods, e-signature evidence, CASL consent, PIPEDA/Law 25 export + deletion. No deadlines, no filings, no permits. |

---

## 2. Phases

### Phase 85 — The calendar the dashboard never had
The schedule board is a planning tool you go to. A contractor's day is a question you ask: *what is happening today?* There is no answer on the dashboard, and the calendar integration only ever pushed — so QuoteAI has never known that the owner is at a dentist on Thursday.

- **Read the other way.** Inbound sync from Google (`events.list`, `singleEvents`) and Microsoft Graph (`/me/calendarView`) into a local `calendar_external_events` mirror, on the cron tick and on demand. Read-only: we never edit someone's personal calendar beyond the events we created.
- **ICS both ways**, which is what makes "and others" honest. **Subscribe** to any ICS URL (Calendly's per-booking feed, Apple Calendar, Jobber, a municipal inspection calendar) with a small RRULE expander so recurring entries appear on every occurrence. **Publish** a private, token-addressed ICS feed of QuoteAI's own schedule, so Apple Calendar, Thunderbird and anything else can subscribe without an OAuth app.
- **One agenda endpoint** merging what is otherwise five separate reads: schedule blocks, job milestones, invoice due dates, quote follow-ups and external events.
- **The widget** on `/dashboard`: month grid with a dot per kind, click a day for its agenda, today/prev/next, click an entry to open the job, invoice or quote. Own data at Pro (like the schedule board); external calendars stay Elite (`calendar_sync`). Honest empty and locked states, as everywhere else.
- **Owner track**: the Microsoft app registration (`OUTLOOK_CALENDAR_*`) is still not done — Outlook stays honest-disabled until it is. Calendly works through its ICS feed today; a first-class Calendly OAuth app can follow if a pilot user asks for it.

### Phase 86 — The crew's app
A labourer's entire product surface is `/t/:token`: a clock and a list of dates. Everything else the field needs — what am I doing today, what did the office change, here is a photo of the problem — either lives behind a login they do not have or does not exist.

- Today's work on the worker page: the jobs they are booked on, the tasks under each, the site address as a map link, the site contact.
- Report from the field without an account: a photo with a note, a "blocked" flag that notifies the office, materials used against the job's budget.
- The foreman's own landing page instead of the owner's dashboard with things hidden: today's crews, today's jobs, hours awaiting approval, the two or three things only a foreman does.
- Offline-first throughout (the outbox from Phase 40 already queues writes).

### Phase 87 — Compliance and filings
The highest-value thing the product knows that no contractor tracks: every deadline their business has. All of the source data is already captured.

- **A filing calendar** (feeding Phase 85's widget): GST/HST and QST remittance periods by registration, instalments, WCB/WorkSafeBC/CNESST reporting, T5018 contractor reporting, licence renewals (RBQ, Alberta prepaid contractor, municipal business licences).
- **Remittance preparation**: net tax from issued invoices minus input tax credits from scanned receipts, per period, as a worksheet to hand to a bookkeeper — never a filing, never advice.
- **Per-job permit checklists** by trade and municipality: what is typically required, links to the actual municipal page, a status per permit, and blocking a "mark complete" when a permit is still open.
- Every screen states plainly that it prepares and reminds, and that the contractor or their accountant files.

### Phase 88 — Accounting, both directions
QuickBooks and Wave only ever receive. The loop never closes, so the books and QuoteAI drift.

- Two-way: payments recorded in the accounting package come back as invoice payments; a chart-of-accounts mapping UI instead of the current fixed account guesses; customer/vendor matching that does not duplicate.
- Reconciliation using the Flinks bank feed already in place: bank line ↔ cost entry ↔ receipt, with a one-click "these are the same thing".
- A month-end close checklist that says what is still unmatched.

### Phase 89 — Time to pay (no payroll engine)
Deliberately **not** a payroll engine: source deductions, T4s and remittances are a regulated, high-liability domain, and every contractor already has a payroll provider or an accountant. What is missing is everything *before* that.

- Provincial overtime rules (daily/weekly thresholds, averaging agreements), statutory holiday pay by province, and travel/per-diem lines on approved hours.
- Exports in the shapes payroll providers actually ingest (Wagepoint, Payworks, QuickBooks Payroll, plus a generic CSV), not the current hours-only dump.
- Labour cost per job from the same approved hours, so job margin stops being an estimate.

### Phase 90 — Multi-entity (built 2026-09-23 on request, see the build log)
Switching companies works. What does not exist is a *group*: consolidated reporting across two numbered companies, a shared price catalog, a crew member on both payrolls, one bill. **Held deliberately** — it is real work for a customer who does not exist yet. The trigger is a pilot contractor with a second company, and then it is a phase.

---

## 3. Build log

*(one entry per phase: date, built, found, deferred, verification)*

### Phase 85 — The calendar the dashboard never had (2026-09-22)

**Built**
- **The other direction.** Calendar sync has existed since Phase 12 and only ever *pushed*: a milestone, and later a schedule block, became an event in someone's Google Calendar or Outlook, and nothing was ever read back. So QuoteAI booked a crew for Thursday without knowing the owner had a dentist appointment at the same hour. `calendar/inbound.ts` mirrors a connected account (Google `events.list`, Graph `/me/calendarView` — both expand recurring series server-side) and every subscribed `.ics` feed into a new `calendar_external_events` table, 14 days back and 92 forward, on the cron tick and on demand. The mirror is **replaced** rather than merged, because the source is the truth and an event cancelled there has to disappear here. Events QuoteAI itself pushed come back flagged `is_ours` and are hidden, so one block is never two rows on the same day. New `listGoogleEvents` / `listOutlookEvents` on the two existing thin clients; `last_inbound_sync_at` on the connection, distinct from the push's `last_synced_at`.
- **iCalendar, both ways** — the honest answer to "and Calendly, and others", since every one of them publishes `.ics` and almost none of them will grant an OAuth app to a two-person product. `calendar/ics.ts` is a deliberately small parser: unfold per RFC 5545 §3.1, split VEVENTs, read the properties that matter, and expand RRULE for DAILY/WEEKLY/MONTHLY/YEARLY with INTERVAL, COUNT, UNTIL and BYDAY (which is what Calendly, Apple Calendar and municipal inspection feeds actually emit); anything it cannot understand is **skipped rather than guessed at**, and a cancelled event is dropped, a TRANSPARENT one is not busy. The writer is the same file: `buildIcs` serialises the company's own blocks and milestones with CRLF line endings, 75-octet folding and escaped text, and the round trip is a test.
- **Two new surfaces in Settings → Integrations.** *Subscribed calendars*: name a feed, paste its link, and it is fetched once immediately so the person sees whether the URL actually works instead of waiting a day to find out. Ten per company; pause, resume, delete (the mirrored events cascade). *Publish your schedule*: one private URL serving blocks and milestones as a calendar, for Apple Calendar or anything else — the token is shown exactly once and only its sha256 is stored, and "Replace the link" or "Revoke" breaks every subscriber immediately.
- **`GET /api/calendar/agenda`** — one sorted list out of what used to be four pages and someone's phone: schedule blocks (with the worker and job), job milestones, invoices due (with the amount outstanding and an overdue flag), quote follow-ups, and the mirrored personal events. Read-only and derived; window capped at 120 days.
- **The widget.** "What is happening" on the dashboard home: a month grid with a dot per kind of thing, the selected day's agenda beside it, today/prev/next, and a refresh that pulls the connected calendars. Each entry links where it belongs — the job, the invoice, the quote — and an external event links back to its own calendar. On a day with nothing (most days, early on) it answers the question actually being asked and shows the next three things instead of a void. The widget rides on `jobs` (Pro, like the schedule board); the personal-calendar half stays `calendar_sync` (Elite), and each degrades to one honest line rather than an empty month.
- Migration `0045` (applied): `calendar_external_events`, `calendar_feeds`, `calendar_publish_tokens`, `calendar_connections.last_inbound_sync_at`. Cron tick gained `calendarInbound` + `calendarPruned`. Runbook §22. Route matrix 396 → 406, with the published feed on the public allowlist and its reason. 40 EN/FR strings.

**Found**
1. **The publish route was gated `jobs:edit`, which a foreman has.** Minting a URL that serves the whole company schedule to anyone holding it is an integration decision, not a scheduling one — it is `integrations:full` now, and the e2e case that caught it (a foreman getting 201) is the regression test.
2. `role="grid"` on the month, caught by axe the first time the widget was swept: a grid promises rows and arrow-key navigation, and this is a read-only overview. It is a group of buttons, each named with its own full date — the honest shape, and 0 axe findings.
3. The agenda's follow-up column is `next_follow_up_at`, not the `follow_up_at` the first draft assumed — the kind of thing a typecheck catches and a reader would not.

**Not done / deferred**
- **Outlook still needs its app registration** (`OUTLOOK_CALENDAR_CLIENT_ID/SECRET`, owner track). The code path is the same shape as Google's and the inbound reader is written; the card stays honest-disabled until the registration exists.
- **Calendly through its ICS feed, not its API.** A first-class Calendly app (OAuth + webhooks, so a new booking arrives in seconds rather than at the next sync) is worth doing when a pilot user asks for it.
- **Read-only, by design.** Nothing here creates or edits an event in someone's personal calendar; the push half (blocks and milestones) is unchanged. Dragging a QuoteAI block onto a free hour *seen* in the widget is Phase 86 territory at the earliest.
- A `TZID` on a floating time is read as-is rather than converted — carrying real IANA offsets means shipping a tz database for read-only context. UTC values, which is what most feeds emit, are exact. Stated in the runbook.
- The widget reads a month at a time; a company with hundreds of blocks per month will want pagination or a narrower default window before that is comfortable.

**Verification**: `pnpm typecheck` (libs + both apps + scripts) · `pnpm lint` **0 errors**, 69 warnings (all pre-existing) · `pnpm knip` no new unused exports · `i18n-audit` **3706 = 3706** keys (+40), 0 missing, 0 one-sided · `env:inventory` **no problems** (no new variables) · migration `0045` applied, `schema-drift` **0 missing in DB** · `docs/ROUTE-MATRIX.md` regenerated, **406 routes** (+10), the published feed allowlisted with its reason and rule 1b still green · unit **22 files / 129 tests** (+13: the ICS parser, the RRULE expander and the writer's round trip) · e2e **20 files / 141 tests** (+12: the merged agenda and its bounds, plan gating both ways, tenant isolation, a mocked feed read end to end, seven SSRF refusals, a non-calendar URL reported rather than swallowed, and mint → serve → rotate → revoke on the published link) · `pnpm build` 438 pages prerendered, `validate-prerender` clean · `qa:visual` full sweep **248 pages** (EN+FR × 1280/375, now including `/dashboard/settings?tab=integrations`): 0 overflow, 0 phone-gutter, **0 axe of any impact**, 0 screen-reader findings, 0 console errors · screenshots of the widget with seeded data at both widths, and of the new Settings card.

### Phase 86 — The crew's app (2026-09-22)

**Built**
- **The worker's day on `/t/:token`.** Before this, the page was a clock and a list of dates. Now it opens on *Today*: each job the worker is booked on (a schedule block on the company's local date, worked out in the province's zone so a 5 pm Vancouver shift is not "tomorrow" because UTC says so), the time window, the block's notes ("gate code 4471"), a maps link for the address, a call button for the client on the job, and the job's open tasks as checkboxes. A tick goes through the offline outbox, is audited as `task_status_from_field`, and stays visible (struck through) for the rest of the day instead of vanishing. The worker sees their own day only, and nothing with a price on it (the e2e suite asserts that on the raw response).
- **Report from site, without an account.** One card with three kinds: *Update* (a photo and/or a note), *Blocked* (pushes to the office), and *Materials* (what was used and what it cost). The photo goes into the job's existing gallery (`job_photos`, captioned with who sent it), materials become a **pending-review** cost entry (a number typed on a ladder is a claim until someone matches it to a receipt), and a new `field_reports` row ties it together with who sent it and, for a blocker, whether it has been answered. The whole thing, photo included, queues offline as `worker.report`, and a replay returns the same report, photo and cost because all three share the op's `clientRef`. Photos are re-encoded to a ~2000 px JPEG before sending (`lib/image-shrink.ts`) because a site often has one bar of signal. "What you sent" lists the last two weeks, with a blocker's status and the office's answer.
- **The office side.** A *From the field* card on the job's Overview (red-edged while a blocker is open), with photo thumbnails and "Answer → Mark sorted" (an optional note the worker sees). `field_blocker` joins the push list; ordinary reports ring the bell once per worker per job per day.
- **The foreman's own landing page.** A foreman signing in used to land on the owner's dashboard, a page about quotes and revenue, with parts hidden. `/dashboard` now gives them *The crew today*: open blockers first, then each job with who is booked on it and whether they have clocked in ("In since 7:12", "Not clocked in", "Clocked in elsewhere"), anyone clocked in who is not on the board, hours waiting for approval (approve one or all in place), and the latest reports, followed by the Phase 85 calendar. The owner's dashboard carries the same card, but only when a crew is out or something is waiting. `GET /api/crew/today` is the one read behind it, gated on `team_time`, with an honest locked state.
- Migration `0046` (applied): `field_reports`. Route matrix 406 → 411. 61 EN/FR strings. Runbook §23.

**Found**
1. **A worker booked on a job they were not assigned to could see the shift and not clock in on it.** `workerJobs` returned "assigned jobs, else every open job", so once a worker was assigned to *any* job, a foreman who put them on Thursday's board for a different one produced a phone that showed Thursday and refused the clock-in. A job they are booked on within ±2 weeks now counts as assigned. The e2e case (assigned to the garage, booked on the kitchen) is the regression test.
2. **A foreman could approve hours one row at a time but not with "Approve all".** `PUT /team/time-entries/:tid` (approve one) was `jobs:edit` and `POST /team/time-entries/approve` (approve many) was `jobs:full`. The same act had two different bars. Both are `jobs:edit` now, and the Team page's button follows. A viewer still gets 403.
3. The IDOR sweep caught the new `/api/field-reports/:id` param as unseeded on its first run (not a leak, just an untested route), so the fixture set now includes a field report.
4. The job name on a report ran straight into its body ("…456 Client AveNo power on site") because `.text-link` is `inline-flex` and beat the `block` class. Caught on the sweep's screenshot, not by any automated check.
5. `calendar/agenda.ts` had carried one lint **error** since Phase 85 (a `const` used only as a type), although the Phase 85 log records 0 errors. Fixed here.

**Not done / deferred**
- **Materials are a claim, not a cost.** There is no link yet between a materials report and the receipt that later confirms it. Someone in the office matches them in the review queue. Linking the two is a small Phase 88 (reconciliation) item.
- **Tasks can only be ticked, not added, from the field.** A worker who finds work that is not on the list sends an *Update*. Letting crews create tasks is a permission question worth asking a pilot foreman before building.
- **The foreman page is read-and-approve.** Moving people between jobs is still the schedule board. The page links to it rather than duplicating drag-and-drop on a phone.
- **No per-worker "what changed since I last looked".** The plan mentioned surfacing office changes. Today the worker sees the current state (tasks, notes on the block) but not a diff. That needs a last-seen marker per worker link and is left until someone asks.
- `qa:visual` sweeps the owner's dashboard, not a foreman session. The foreman page was checked by e2e (the data) and by typecheck. A foreman-session sweep needs a second signed-in user in the sweep harness.

**Verification**: `pnpm typecheck` (libs + both apps + scripts) · `pnpm lint` **0 errors** (69 warnings, all pre-existing; the one pre-existing error fixed) · `pnpm knip` no new unused exports · `i18n-audit` **3767 = 3767** keys (+61), 0 missing, 0 one-sided · `env:inventory` **no problems** (no new variables) · migration `0046` applied, `schema-drift` **0 missing in DB** · `docs/ROUTE-MATRIX.md` regenerated, **411 routes** (+5), rules test green · unit **23 files / 133 tests** (+4: the local-day rule across BC/ON/QC/NS and midnight edges) · e2e **phase86 13/13** (the worker's day and that it carries no prices, booked-counts-as-assigned, task ticks and their tenant boundary, photo report idempotent on replay, empty reports refused, materials as pending review, blocker notification, the job's list, the foreman's day, bulk approve for a foreman and not a viewer, answering a blocker with the answer visible to the worker, the locked state) + the neighbouring suites (offline/push, schedule, team, security incl. the IDOR sweep, public tokens, phase83) **all green** · `qa:visual` on the changed pages (`/t/:token`, `/dashboard`, the job page and its setup, EN+FR × 1280/375, 16 pages) with the showcase seed now booking its worker today with a task, a blocker and a note: 0 overflow, 0 phone-gutter, **0 axe serious/critical**, 0 screen-reader findings, 0 raw keys · screenshots of the worker page at 375 and the dashboard crew card at 1280 reviewed by eye.

### Phase 89b — The pay leftovers (2026-09-23)

What Phase 89's "Not done" list could close without a provider account.

**Built**
- **Travel and per diem from the site.** An employee logs km or per-diem days on the magic link (offline too — a `worker.allowance` outbox op, idempotent by `client_ref`). Only the kinds the company has a rate for are offered, and no amount ever reaches the crew page. The line waits: *Pay → From the crew* approves it (paid, and a labour cost on the job) or rejects it with a reason the crew sees; until then the crew can take it back. Subcontractors are refused.
- **Shifts across midnight.** The hours of a clocked shift after local midnight count toward the next day's daily threshold and holiday, as a share of the recorded hours. A tail into the next week's first day opens that day's count. A 22:00–08:00 BC shift is 2 + 8, not 10 on one day.
- **The holiday pay base.** Overtime wages and vacation pay (when it is paid on each cheque) can count in the base; vacation pay counts by default in ON, AB and BC.
- **Substitute days.** Optionally, a weekend statutory holiday is taken on the next weekday that is not a holiday (Christmas and Boxing Day 2027 → Monday and Tuesday); the worksheet shows the real date.
- **Trade presets**: ON construction, sewer and watermain, road building (7.7 % of wages in lieu, overtime past 44 / 50 / 55 h — holiday hours become ordinary hours) and QC residential construction under R-20 (8 h / 40 h, holiday indemnity through the CCQ). A new holiday method `pct_of_wages`.
- Migration `0051` (applied). Route matrix 448 → 451. 46 EN/FR strings. Runbook §27.

**Found**
1. My e2e draft expected only 2027's Christmas and Boxing Day to move; Boxing Day 2026 is a Saturday too, and the engine moved it to Monday the 28th. The engine was right.

**Not done / deferred**
- Provider layouts are still unverified against live accounts (owner track, as in Phase 89).
- BC averaging agreements' own daily limits; the R-20 preset covers overtime only (worked-holiday rates and the other terms stay with the sector agreement).
- Substitute days are company-wide: they don't know which weekdays each employee normally works.
- The crew can't log an "other" allowance, and can't edit a line (delete and log again).

**Verification**: `pnpm typecheck` (libs + both apps) · `pnpm lint` **0 errors** (69 warnings, pre-existing) · `pnpm knip` no new unused exports · `i18n-audit` **4340 = 4340** (+46), 0 missing · migration `0051` applied, `schema-drift` **0 missing, 0 mismatched** (98 tables) · route matrix **451** · unit **27 files / 186 tests** (+9: substitute days, local midnight across DST and in Newfoundland, the midnight split, a tail from the previous week, the vacation/overtime base, 7.7 %, presets) · e2e **phase89b 9/9** (crew km: submitted → approved → paid and costed, replay, NO_RATE, DATE_RANGE, rejected with a reason, delete while waiting, foreman 403, other company 404, subcontractor 403; BC night shift 2 + 8 and the next morning's overtime, which goes away with the shift; ON vacation pay 8000 → 8320; weekend holidays moved; the ON construction preset's 15 400 in lieu with Labour Day as an ordinary day; back to the general rules) · regression **phase89, security (incl. the IDOR sweep), phase86, phase86b, offline-push, team, money, phase88, phase87, schedule — 96/96** · `qa:visual` on Pay (3 tabs + foreman) and the worker page, EN+FR × 1280/375: 0 overflow, 0 gutter, **0 axe serious/critical**, 0 screen-reader findings, 0 raw keys; the period at 375 (From the crew), Rules at 1280 and the worker page at 375 checked by eye.

### Phase 89 — Time to pay, no payroll engine (2026-09-23)

**Built**
- **Overtime by province, on the job it was worked on.** Approved employee hours split into straight time, overtime and double time — BC 8/12 a day and 40 a week, AB 8/44, ON 44 a week, QC 40, NS and PE 48, and so on — plus hours worked on a statutory holiday. The split is stored on each entry with its premium, walked in the order the hours were worked, and re-done for the whole week whenever an entry in it is added, edited, moved, (un)approved or deleted. The job's labour cost is now `hours × rate + premium`, then burden, so **job margin carries the overtime** instead of assuming straight time.
- **Statutory holidays by province** (Easter, the n-th-Monday holidays, Victoria Day, Quebec's July 2 rule, 21 holidays across 13 jurisdictions), with the company adding or removing days. **Holiday pay** by the province's method (four weeks ÷ 20, average day over 30 or 28 days) with its eligibility (BC's 15 of 30 days, 30 days on the payroll); an employee who doesn't qualify is shown with the reason.
- **Averaging agreements** (the weekly threshold over 2–12 weeks) and every threshold and multiplier overridable; "whichever is greater" (AB) needs no switch because daily-then-weekly-on-straight-time is the same total.
- **Travel and per diem**: km and per-diem lines at the company's rates (or any other amount), paid with the hours and, on a job, a labour cost on that job.
- **/dashboard/pay**: the pay period (weekly, biweekly, semi-monthly, monthly) with each employee's earning lines, holidays, allowances and gross; subcontractors listed apart; *Labour by job* (straight, premium, burden, travel); *Rules and export* with payroll employee numbers in one table.
- **Exports**: spreadsheet CSV, Wagepoint, Payworks (employee number + earning code) and QuickBooks Payroll timesheets (per day, job and pay item). Every download is logged; the period then names who changed since.
- Migration `0050` (applied): `pay_allowances`, `pay_exports`, `business_profiles.pay_settings`, `collaborators.payroll_id`, four `time_entries` columns. Route matrix 441 → 448. 171 EN/FR strings. Runbook §26.

**Found**
1. **The payroll CSV answered anyone signed in to the company** — a viewer or foreman could download everyone's wages, and a Pro company without time tracking could too. It is now `costs:full` and `team_time`, and shows overtime, holiday hours and the premium.
2. **The job Costs tab would crash on a confirmed bank-line cost** (Phase 88): the icon map had no `bank_feed`, so `<Icon/>` rendered `undefined`. `bank_feed` and the new `allowance` now have icons and labels, and allowance costs are protected from edit/delete like time-entry costs.
3. My own first e2e draft assumed 8 + 4.5 h in BC is 4.5 h overtime; it is 4 + 0.5 double (past 12). The engine was right.
4. The first cut re-split any period just by opening it, so looking at January after a rules change would have rewritten January's job costs. Opening re-splits only periods a rules change reaches (the previous one on); the e2e suite asserts January keeps its split.

**Not done / deferred**
- **Provider layouts are unverified against live accounts.** Wagepoint's and Payworks' import templates are per-account and behind a login (Wagepoint's help pages return 403); the files use each provider's vocabulary and the company's own earning codes. First pilot with a provider account should try an import (owner track).
- **Vacation pay, deductions, remittances, T4s, ROEs** — the provider's, by design.
- Holiday pay uses straight-time wages only; provinces that count overtime or prior holiday/vacation pay in (e.g. ON adds vacation pay) will be a little low — the provider or the company adjusts. Substitute days off for holidays that fall on a non-working day are not modelled.
- Trade-specific rules (ON construction 7.7%, QC R-20, BC's averaging daily limits) are overrides the company sets, not presets.
- A day that crosses midnight still lands on the clock-in day (Phase 23 behaviour), so its hours count toward that day's threshold.
- Allowances are office-entered; the crew can't log km from `/t/:token` yet.

**Verification**: `pnpm typecheck` (libs + both apps + scripts) · `pnpm lint` **0 errors** (69 warnings, all pre-existing) · `pnpm knip` no new unused exports · `i18n-audit` **4294 = 4294** (+171), 0 missing, 0 one-sided · `env:inventory` **no problems** · migration `0050` applied, `schema-drift` **0 missing, 0 mismatched** (98 tables) · `docs/ROUTE-MATRIX.md` regenerated, **448 routes** · unit **27 files / 177 tests** (+18: holidays per province and year, Easter and Monday rules, periods, the BC/AB/ON/averaging splits, holiday pay eligibility) · e2e **phase89 17/17**:
  - two jobs in a day: the later entry carries the hours past 8 and the premium lands in that job's cost
  - a 13-hour BC day is 4 overtime + 1 double; editing, moving and deleting an entry moves the week's overtime with it; a rejected entry loses its premium and cost
  - BC Labour Day: no pay, with the reason, for someone a week on the payroll
  - employee → subcontractor drops the overtime in the open periods, and back
  - ON: 5 × 10 h is 44 + 6; the worksheet's lines, Labour Day pay from four weeks ÷ 20; the subcontractor apart; labour by job
  - mileage on the job: a protected labour cost, in the worksheet and the job table; refused for a subcontractor
  - generic, Payworks and QuickBooks files; exports logged; working the holiday flags the period as changed since export
  - settings: province defaults, an override re-splits the open period and undoing it restores it, January keeps its split even when opened; added/removed holidays
  - office 200, foreman 403 on the worksheet, the export, the settings and the old payroll CSV; Pro 403; other companies see nothing

  security **incl. the IDOR sweep** (`/api/pay/allowances/:id` seeded), team, money, phase88, phase87, phase86, phase86b, offline-push, lifecycle, integrations, ops, account, schedule all green · `qa:visual` on the three Pay tabs (owner) and Pay + Team (foreman), EN+FR × 1280/375: 0 overflow, 0 phone-gutter, **0 axe serious/critical**, 0 screen-reader findings, 0 raw keys · the period at 375 (earning lines stack instead of hiding the amount) and Rules at 1280 reviewed by eye.

### Phase 88 — Accounting, both directions (2026-09-23)

**Built**
- **QuickBooks follows the invoice through its life.** Phase 11 posted one SalesReceipt when an invoice was paid, so QuickBooks never knew anything was owed, and a payment taken in QuickBooks never reached QuoteAI. Now a sent invoice becomes a QBO **Invoice** (accounts receivable), each payment recorded in QuoteAI a QBO **Payment** applied to it (deposited where the company says), a removed payment is deleted there and a void voids it there. Invoices already paid the old way are left alone. Four internal automation events carry this through the retrying runner without joining the public webhook catalogue, and are only raised for companies that have QuickBooks connected.
- **Payments come back.** The daily tick (and *Check now*) reads QBO payments since a cursor and records the ones applied to an invoice QuoteAI sent. A payment QuoteAI pushed, or already pulled, is skipped; a pulled payment is linked before anything else runs, so it is never pushed back. **It never guesses**: a payment larger than what QuoteAI says is owing (it was entered in both places), or on a void/draft invoice, is logged for a person and not recorded.
- **`accounting_links` instead of "find by name every time".** Clients map to one QBO customer (found by email first, then name; a name QBO already uses for a vendor gets the email appended rather than failing), suppliers and vendor names to one QBO vendor (`"  home depot. "` is Home Depot), and every invoice and payment to its QBO twin. An invoice push also adopts a QBO invoice with the same number, so a crash between "created" and "linked" does not make a twin. Wave customers use the same links.
- **The chart-of-accounts mapping**, instead of the fixed guesses: the income account invoices are booked to (was "the first income account QuickBooks lists"), the deposit account for payments (default Undeposited Funds), and a **sales-tax code per tax set** the company's invoices actually carry (`HST 13%`, `GST 5% + QST 9.975%` …). Mapped, an invoice goes over pre-tax and QuickBooks adds the tax; a total that then differs by more than a cent is noted in the sync log. Expense accounts now include Cost of Goods Sold. *Send invoices already out* backfills open invoices and their payments.
- **Reconciliation, both directions.** `/dashboard/books` → *Bank lines*: money out matches a cost entry, money in matches an invoice payment, **each thing at most once**, and the auto-matcher acts only on **exactly one** candidate (Phase 27 took the first same-amount cost, even one another line had claimed). A deposit nobody recorded can *record the payment* on the invoice it settles, dated the deposit day. A card charge with no receipt yet becomes a pending cost to review. On a phone the lines stack instead of hiding the amount and the button off-screen.
- **The materials-to-receipt link from Phase 86.** *Crew claims* lists each materials report still standing on the number typed on site, with receipts near its date and job. *Same thing* keeps the receipt (vendor, date, tax split), points the field report and any bank match at it, gives it the claim's job if it had none, and removes the claim. A claim already sent to QuickBooks/Wave is refused rather than deleted behind the books' back.
- **The month-end close.** For a month (default: last month), eight counts with amounts and links: bank lines not matched, payments not seen in the bank (cash excluded), costs waiting for review, claims with no receipt, receipts with tax not split, drafts never sent, hours not approved, and — since the connection — what is not in QuickBooks/Wave yet. *Close* records who, when, a note and a snapshot; a closed month says so when a count later rises. Nothing is locked, and a month that is not over cannot be closed.
- **T5018 by payment date** (deferred from Phase 87): a subcontractor cost matched to a bank line counts on the day the money left the bank; the page and CSV say how many entries were dated that way.
- Migration `0049` (applied): `accounting_links`, `books_closes`, six `quickbooks_connections` columns, `flinks_transactions.matched_invoice_payment_id`. OpenAPI spec + generated client extended (`/quickbooks/pull`, `/quickbooks/backfill`, wider status/accounts/mapping). Route matrix 430 → 441. 139 EN/FR strings. Runbook §25.

**Found**
1. **The Phase 27 auto-matcher could match two bank lines to one receipt**, and picked "the first" of two same-amount receipts. Both now need exactly one unclaimed candidate; the e2e suite asserts the twin case.
2. **The settings mapping card had seven unnamed dropdowns** (axe `button-name`, critical) — the payment account and every cost-category select since Phase 11. The sweep never saw them because the showcase company never had QuickBooks connected. It does now (answered from a stub), and every select is named by its label and its current value.
3. **Notices with a button squeezed their text into a one-word column on a phone.** Seen on the month-end notice at 375 px; fixed in the shared `.notice` style, so every page's notices wrap their button under the text.
4. A foreman opening `/dashboard/books` saw a blank page and the sweep saw a 403: the role loads a beat after the page, and the role defaults to owner until then. The page waits for the role and tells a foreman the books are the office's.
5. Filtering bank lines by status after a 300-row limit could hide an old unmatched line behind recent matched ones; the filter is in SQL now.
6. A line flagged in the i18n audit as an English literal was a `>` comparison inside JSX; reworded.

**Not done / deferred**
- **Wave stays one-way** (paid invoices as money-in, costs as money-out). Its public API documentation could not be checked for a supported way to record an invoice payment, and pushing invoices without being able to push their payments would double-count revenue. Wave customers do use the new links.
- **Edits and deletions of a payment in QuickBooks after it was pulled are not followed**, and neither are invoices created directly in QuickBooks. Credit notes are not sent (QBO CreditMemo mapping is its own piece of work).
- **One line per invoice**, as before: line-by-line and per-line tax codes would need the item catalog mapped too.
- **Customers split across two QuoteAI client rows** stay two QBO customers; merging is a manual step (runbook §25).
- **Bank-line matching is one-to-one.** A deposit that pays two invoices, or one cheque for three receipts, is recorded by hand and matched to one of them.
- **The close does not lock the month.** It records and warns; locking periods is the accounting package's job.
- The QuickBooks half is proven against a stub at the `fetch` boundary, not a live sandbox company — same limit as Phase 65; the owner's sandbox pass (QA plan §3 Phase 65) now has invoices, payments both ways, voids and the tax-code mapping to try.

**Verification**: `pnpm typecheck` (libs + both apps + scripts) · `pnpm lint` **0 errors** (69 warnings, all pre-existing) · `pnpm knip` no new unused exports (seven un-exported) · `i18n-audit` **4123 = 4123** keys (+127: 139 new, 12 orphaned Phase 27/11 keys removed), 0 missing, 0 one-sided · `env:inventory` **no problems** (no new variables) · migration `0049` applied, `schema-drift` **0 missing, 0 mismatched** (96 tables) · `docs/ROUTE-MATRIX.md` regenerated, **441 routes** · unit **26 files / 159 tests** (+4: name and tax-set keys) · e2e **phase88 14/14**:
  - sent → Invoice with the mapped tax code and chosen income account; customer found by email and remembered
  - a taken QBO name gets the email appended
  - payments pushed, pulled once, never looped back, over-balance logged and not recorded, a repeated page records nothing, foreman refused
  - payment removed → deleted in QBO; void → voided
  - two spellings of a vendor → one QBO vendor
  - backfill sends an invoice from before the connection, and a second run sends nothing
  - auto-match only on one candidate; a cost matched once; money in is not a cost; a charge becomes a pending cost
  - a deposit records its payment, dated the deposit day, and cannot pay more than is owing
  - unmatch/ignore; other companies 404, foremen 403, Pro without the bank feed 403
  - a claim merges into its receipt (report, bank line, job follow), once; a synced claim is refused
  - the close counts, closes, notices what turned up, reopens; future and unfinished months refused
  - T5018 moves a December bill paid in January to January's year

  integrations (QuickBooks now Invoice + Payment + vendor), security **incl. the IDOR sweep** (new `/api/books/*` routes mapped), phase87, phase86, money, lifecycle and ops all green · `qa:visual` on the three Books tabs (owner and foreman) and Settings → Integrations with QuickBooks connected, EN+FR × 1280/375: 0 overflow, 0 phone-gutter, **0 axe serious/critical** after the fix above, 0 screen-reader findings, 0 raw keys · Month-end at 375, Bank lines at 375 (FR) and the QuickBooks cards reviewed by eye.

### Phase 87 — Compliance and filings (2026-09-22)

**Built**
- **A filing calendar, derived and not guessed.** `compliance/deadlines.ts` turns *how the company files* into dates. The inputs are the reporting period, the fiscal year end, the business structure, instalments, the PST/RST period and T5018, all set once in *Filing setup* (`business_profiles.compliance_settings`). The rules were checked against CRA's "Reporting requirements and deadlines" page on 2026-09-22. Monthly and quarterly returns are due one month after the period, and quarters follow the fiscal year. Annual returns are due three months after year end, except a sole proprietor with a Dec 31 year end, who gets two rows: pay by April 30, file by June 15. Instalments are due one month after each fiscal quarter for annual filers whose net tax was $3,000 or more. Québec gets one GST/QST row with Revenu Québec. BC PST is due at the end of the following month, SK PST and MB RST on the 20th, and those rows appear only when a PST/RST number is on file. T5018 is due June 30. **With no setup there are no sales-tax deadlines at all**, rather than a plausible wrong one. The rules are pure functions over `YYYY-MM-DD` strings, with a test per rule.
- **The remittance worksheet.** Tax on invoices *issued* in the period (drafts and voids excluded, credit notes subtract) minus credits from *confirmed* purchases whose tax is split into GST/HST/QST. It is laid out with the GST34 line numbers (101, 105, 108, 109) so a bookkeeper can check it against the return, QST collected and refunded separately, and PST paid on purchases shown as not recoverable. **It never guesses**: tax that was never split, receipts still awaiting review and a hand-entered generic "Tax" rate each become a warning with the amount, never a credit. Days are the company's local day (a UTC-midnight value is taken as date-only; a real instant is read in the province's zone). A CSV has every invoice and purchase with "counted: yes / no (why)".
- **T5018 preparation.** Confirmed *Subcontractor* costs (grouped by supplier, or by vendor name) and approved hours of workers set up as subcontractors, per recipient for the year, with the $500 line flagged. It is a list to reconcile, not a slip: the slip needs a BN/SIN and address QuoteAI does not hold, and the page says so.
- **The company's own reminders.** Workers' compensation reports, licence renewals and insurance, with presets by province (WorkSafeBC, WSIB, CNESST with its usual March 15 pre-filled and flagged "check it", WCB-Alberta, RBQ, HCRA, Alberta prepaid contracting, plus municipal licence and insurance for everyone). *Done* moves a repeating reminder to its next date and removes a one-off.
- **The bell and the calendar.** The daily tick rings `compliance_due` (on the push list) 10 days before a filing deadline and `remind_days_before` before a reminder, once per occurrence. Deadlines, reminders and permit inspections are two new kinds in the Phase 85 widget (`filing`, `permit`), titled in the viewer's language.
- **Permits on a job.** A Permits card on the job Overview. *Suggest* asks what kind of work it is and lists the permits that work usually needs, with who usually issues them: ESA and TSSA in Ontario, Technical Safety BC, RBQ declarations in Québec, otherwise "the municipality" with a search link for that permit in the job's own town, which never goes stale. Each permit has a status (needed → applied → issued → closed, or not required), a number, dates and the next inspection. **A permit still needed, applied for or issued blocks completing the job.** Both `PUT /api/jobs/:id` and the legacy `PUT /api/crm/projects/:id` answer 409 `PERMITS_OPEN`, and the Complete dialog lists the open ones and disables its button.
- `/dashboard/compliance` (Deadlines, Sales tax worksheet, Subcontractors, Reminders), in the sidebar under Invoices, riding on `invoicing` (Pro) with one honest locked line below it. Setup and "mark filed" are `invoicing:full`, viewing is `invoicing:view`, T5018 is `costs:view`, and permits are `jobs:view` / `jobs:edit`. Every screen carries the same sentence: QuoteAI prepares and reminds, and the contractor or their accountant files.
- Migration `0047` (applied): `compliance_filings`, `compliance_reminders`, `job_permits`, `business_profiles.compliance_settings`. Route matrix 411 → 428. 208 EN/FR strings. Runbook §24.

**Found**
1. **The Phase 85 calendar showed every all-day entry a day early.** Milestones, invoice due dates and follow-ups are stored as UTC midnights. The widget read them in local time, and everywhere in Canada that is the previous evening: a milestone planned for Sep 30 was dotted on Sep 29, and a one-day inspection covered two days. It was caught because the new inspection dot landed on the 24th *and* the 25th in the sweep's screenshot. All-day entries are now read by their UTC date.
2. **A new company would have been told it was "146 days late".** Deadlines are derived back six months, so setting up today listed last spring's returns (almost certainly filed elsewhere) as overdue. The first save now records `configuredAt`, and deadlines due more than a month before it are not listed. The e2e suite asserts both the cutoff and that a second save keeps the first date.
3. **The reminder sweep would have notified real companies from the test suite.** The e2e database is shared and the sweep walks every profile, so `runComplianceReminders` takes an explicit user list and the tests always pass one (an empty list touches nobody, which is also a test).
4. **The IDOR sweep would have tested the permit routes with the wrong ids.** The sweep maps `:pid` to an invoice *payment*, so `/jobs/:id/permits/:pid` would have 404'd for the wrong reason and proved nothing. The param is `:permitId` now, with permit and reminder fixtures seeded.
5. Fading "not counted" purchase rows with `opacity-60` pushed their text to 2.35:1 (axe). The chip already says why a row is not counted, so the fade went. The worksheet tables scroll sideways at 375, so they are focusable, labelled regions.
6. The two CSV routes briefly sent a raw BOM character, then the literal text "FEFF", after two tool edits each rewrote the `﻿` escape. Lint caught the first and a byte dump the second; both now match the payroll CSV byte for byte.

**Not done / deferred**
- **Nothing is filed and nothing is advice**, by design and on every screen. No CRA/Revenu Québec API integration: neither exists for a third party filing on a small business's behalf without a representative authorisation, and filing is exactly the liability this plan said to stay out of.
- **Accrual basis only.** The worksheet counts invoices on issue date. The quick method, cash-basis special cases and self-assessed tax on imports are the accountant's call. An invoice voided *after* its period was filed drops out of the worksheet (the void is the correction). The runbook says so.
- **Workers' compensation dates are reminders the company sets**, not derived. The boards' schedules depend on each account's reporting frequency and class, which we do not know. Only CNESST's March 15 is pre-filled, flagged "check it".
- **Permit suggestions are typical, not bylaws.** Provincial authorities are hard-coded for ON/BC/QC only. Every other province falls back to the municipality with a search link.
- **T5018 by entry date, not payment date**, and without recipient BN/SIN/address. Linking costs to actual payments is Phase 88 (reconciliation) territory.
- **The materials-to-receipt link from Phase 86** stays with Phase 88.

**Verification**: `pnpm typecheck` (libs + both apps + scripts) · `pnpm lint` **0 errors**, 71 warnings (none in the new files, one pre-existing `any` in `crm.ts` now reported on a shifted line) · `pnpm knip` no new unused exports · `i18n-audit` **3975 = 3975** keys (+208), 0 missing, 0 one-sided · `env:inventory` **no problems** (no new variables) · migration `0047` applied, `schema-drift` **0 missing, 0 mismatched** (94 tables) · `docs/ROUTE-MATRIX.md` regenerated, **428 routes** (+17), rules test green · unit **24 files / 149 tests** (+16: every deadline rule, the worksheet arithmetic and its refusals, the local-day rule, permit suggestions) · e2e **phase87 8/8** (no setup → no deadlines, setup permissions, the `configuredAt` cutoff, mark filed and undo, the worksheet against drafts/voids/credit notes/unsplit/pending, CSV, tenant isolation, T5018 grouping and threshold, reminders with a `javascript:` link refused and a foreign company 404'd, the sweep ringing once and then not again, permits blocking completion on both routes without leaking to another company, the inspection and deadline on the agenda, the Starter gate) + **security incl. the IDOR sweep** with permit and reminder fixtures + phase85, phase86, lifecycle, schedule, team, money **all green** · `pnpm build` 438 pages prerendered · `qa:visual` on `/dashboard`, the four Compliance tabs and the job pages, EN+FR × 1280/375 (28 pages): 0 overflow, 0 phone-gutter, **0 axe serious/critical**, 0 screen-reader findings, 0 raw keys · screenshots of the deadlines list, the worksheet, the dashboard calendar and the Permits card at 375 reviewed by eye.

### Phase 86b — The crew's app, finished (2026-09-22)

Phase 86 shipped with three things set aside: crews adding tasks, a per-worker "what changed", and a `qa:visual` sweep as a foreman. All three are done here.

**Built**
- **Tasks from the site, for the workers the office trusts.** `collaborators.can_add_tasks` is **off by default and set per worker** in the worker dialog on the Team page (`team:full`). This is the answer to the permission question Phase 86 left for a pilot foreman: a crew lead yes, every apprentice no. For such a worker, each of today's jobs on `/t/:token` gets a one-line "Another task…" form. It works offline as `worker.addTask`, and a replay returns the same row (`project_tasks.client_ref`). The task records who added it and goes to the end of the list, so the office's order stays the office's. The job page shows it as "From the site · name". The office gets one notification per worker per job per day, because work found on site is often a change order in waiting. The action is audited as `task_created_from_field`.
- **"Since you last looked"** above *Today* on the worker page. It lists shifts the office added, moved or took away (including a shift handed to someone else), tasks added, changed or ticked on the jobs the worker follows, and answers to their blockers, newest first. The data comes from facts that already existed:
  - shift changes come from the schedule's **audit rows**. A block's `updated_at` is useless here: the reminder cron touches it, and a deleted block leaves no row.
  - task changes come from `updated_at`, minus the worker's own changes (new `field_updated_by/at`, both stamped from one instant).
  - answers come from `field_reports.resolved_at`.

  The marker (`collaborators.crew_seen_at`) starts on the first visit rather than listing the whole schedule. It moves only on **Got it**, to the moment the list was built, never backwards, so a reload on one bar of signal does not lose the list and a stale tab cannot bring it back. Created-then-deleted is nothing, handed away and back is "changed", past shifts are left out, and nothing older than 14 days counts.
- **`qa:visual` signs in as a foreman.** Routes now carry a `session` (public / owner / foreman). The sweep adds a foreman member of the showcase company through a second invite (the seeded one must stay unaccepted for `/team-invite`) and sweeps `/dashboard`, the jobs list, the job, the schedule and three Team tabs as that person. `/dashboard/schedule` was never in the owner sweep either, and now is. The showcase worker is a crew lead who last looked an hour ago, so the new cards render with content.
- Migration `0048` (applied): the two collaborator columns, the five task columns, a unique `(created_by_worker_id, client_ref)` index, and an `audit_log (user_id, entity_type, created_at)` index for the schedule half of the change list. Route matrix 428 → 430. 21 EN/FR strings. Runbook §23 (two rows).

**Found**
1. **The foreman sweep failed on its first run.** On `/dashboard/team` at 375 px, the Workers table scrolls sideways but held nothing a keyboard could reach, because the edit buttons are `team:full`. The owner sweep never saw it because the owner has the buttons (axe `scrollable-region-focusable`, serious). The Members, Workers and Equipment tables are now focusable, labelled regions, the same as on the Compliance page.
2. **The Time tab's filters had no names** (axe `select-name`, critical). This affected every role; the tab had simply never been swept. The status and worker selects and the two date fields now have labels.
3. A task the worker added and the office then ticked came back to them as "New task" instead of "Task done". The e2e suite caught it. A worker's own task is never "new" to them.
4. At 375 px the add-task placeholder was cut off mid-word ("Found more work? Add i"). It was found in the screenshot and shortened to "Another task…".

**Not done / deferred**
- **Deleted tasks are not in the list.** `project_tasks` has no tombstone and the task routes do not audit deletes. A task that disappears simply disappears.
- **The list is built from two clocks**: audit rows use the database's, and the marker and `$onUpdate` stamps use the API's. With NTP on both sides this is milliseconds. The e2e suite leaves a 1.5 s beat so it tests the rule, not the skew.
- **Crews cannot edit or delete tasks**, only tick and add. Moving people between jobs is still the schedule board.
- The materials-to-receipt link stays with Phase 88.

**Verification**: `pnpm typecheck` (libs + both apps + scripts) · `pnpm lint` **0 errors** (69 warnings, all pre-existing) · `pnpm knip` no new unused exports (four new ones un-exported) · `i18n-audit` **3996 = 3996** keys, 0 missing, 0 one-sided · no new environment variables · migration `0048` applied, `schema-drift` **0 missing, 0 mismatched** (94 tables) · `docs/ROUTE-MATRIX.md` regenerated, **430 routes** (+2), rules test green · unit **25 files / 155 tests** (+6: every way a block's audit trail collapses for one worker) · e2e **phase86b 7/7**:
  - adding a task is off until `team:full` turns it on
  - an added task is marked, replay-safe and notified once
  - empty titles and other companies' jobs are refused
  - the first visit starts the marker
  - the change list: added, changed and handed-away shifts; a created-then-deleted blip; another worker's shift; the office's task vs the worker's own add and tick; the answer; newest first
  - reload keeps the list, Got it clears it, a stale "Got it" cannot bring it back, a bad timestamp is a 400
  - an office tick on the worker's own task is news

  phase86, offline/push, schedule, team, public tokens, phase83, phase85 and **security incl. the IDOR sweep** are all green · `qa:visual` on `/t/:token`, the owner's and the foreman's `/dashboard`, jobs, the job and its setup, schedule and Team tabs, EN+FR × 1280/375: 0 overflow, 0 phone-gutter, **0 axe serious/critical** after the two fixes above, 0 screen-reader findings, 0 raw keys · the worker page at 375 and the foreman's Team page reviewed by eye.

### Phase 90 — Multi-entity (2026-09-23)

The user asked for it directly, so it was built before a pilot needed it.

**Built**
- **Company groups.** `company_groups` and `company_group_members`: one company creates the group and manages it; it can invite a company the person owns or administers; that company's own owner accepts or declines. Leaving or removal ends everything the group gave. A group without its managing company passes to the oldest remaining member, or ends.
- **The consolidated view** (`GET /api/group/overview`): each included company's own analytics (only where the person is owner or admin, the rest named as not included), totals, aging, the month series and the cash-flow weeks added up, and **intercompany work taken out**: an invoice from one group company to another (matched by business number, then email, then name without legal suffixes) and the matching cost at the other, shown on their own line. Receivables stay as owed.
- **One catalog.** The managing company picks whose catalog the group shares; every other company reads it next to its own (opt-out per company) in the catalog page, AI quote generation, the public quote form and the price check. Shared rows are read-only outside their own company.
- **One person, two payrolls.** `collaborators.group_person_id` links the same person's records across companies; one magic link (`<token>~<workerId>`) reaches each company's page, with a company switch on the worker page. The crew tab shows each linked person's week at every company and flags hours that cross the overtime line only when added up.
- **One bill.** A company can pay for the group: covering another company adds an "extra company" item to its Stripe subscription (prorated) and copies its plan onto the covered profile (`plan_covered_by`). Refused while the covered company pays for itself. Webhooks keep it in step (past due pauses, deleted ends, own subscription leaves). Billing shows "paid by …". Plan code now picks the plan item, not the add-on, everywhere it read `items.data[0]`.
- `/dashboard/group` (Overview, Companies, Crew), a Group nav item when there is something to group. Migration `0052` (applied). Plan feature `multi_entity` (Elite). Route matrix 451 → 465. 136 EN/FR strings. Runbook §28. Env `STRIPE_PRICE_GROUP_COMPANY(_YEARLY)` classified.

**Found**
1. The worker page offered a company whose plan had lost time tracking. The link then answered 410 when the person picked it. The switch now lists only reachable companies, and none at all when fewer than two remain.
2. `/payments/sync-subscription` would have wiped a covered plan ("no Stripe customer, no subscription"). It now leaves a group-paid plan alone. The same guard is in the webhook: a stale event about a covered company's old subscription restores the group plan instead of clearing it.
3. The IDOR sweep flagged the new `:orgId` and `:workerId` params as unseeded. Both are seeded now (A's own company, A's worker).

**Not done / deferred**
- **One bill needs the Stripe price** (owner track): until `STRIPE_PRICE_GROUP_COMPANY` exists the card says so. The price itself is a business decision.
- **One login still owns one company.** Grouping two companies takes both owner logins (one to invite, one to accept). Owning several companies from one login would change the tenant model everywhere and is not attempted.
- Consolidation is **management reporting, not consolidated statements**: no eliminations of receivables/payables, no tax consolidation (each company files its own), CAD only.
- Shared catalog is one source company; no merged or per-company price overrides.
- Combined overtime is a flag for the accountant, not a pay rule. The pay worksheets stay per company.
- Intercompany matching needs the business number, email or name on the document; a cost typed with a nickname for the sister company is not caught.

**Verification**: `pnpm typecheck` (libs + both apps + scripts) · `pnpm lint` **0 errors** (69 warnings, pre-existing) · `pnpm knip` no new unused exports · `i18n-audit` **4474 = 4474** (+134), 0 missing · `env:inventory` **no problems** (2 new variables classified) · migration `0052` applied, `schema-drift` **0 missing, 0 mismatched** (100 tables) · route matrix **465**, rules test green · unit **+5** (name normalising, business numbers, the matching order and its refusals) · e2e **phase90 5/5** (Elite and owner-only creation, invitations only to companies you run, only the invited owner accepts, nothing visible while pending or to an outsider; the shared catalog read-only, opt-out; the overview with intercompany taken out, 10,000 + 3,000 + 5,000 invoiced → 15,000, costs 4,000 → 1,000, a foreman sees no company's money; one link reaching both crews, refused for a stranger's or an unlinked worker id, a 410 while the other company has no time tracking, a clock-in landing in the other company, 30 + 20 h flagged together; one bill: unavailable without the price, refused while paying its own, covered → Elite with `plan_covered_by`, leaving bills down to 0 and ends catalog and crew links) · regression **security (incl. the IDOR sweep), team, billing, quotes, phase86, phase86b, phase89, phase89b, offline-push, money, public-tokens — all green** · `pnpm build` 438 pages prerendered · `qa:visual` on Group (3 tabs + foreman), Catalog, Billing and the worker page, EN+FR × 1280/375, 28 pages: 0 overflow, 0 gutter, **0 axe serious/critical**, 0 screen-reader findings, 0 raw keys. Checked by eye: the overview at 1280, the companies tab at 1280, the crew tab at 375 and the worker page's company switch at 375 (FR).
