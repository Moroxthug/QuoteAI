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

### Phase 90 — Multi-entity (held until someone needs it)
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
