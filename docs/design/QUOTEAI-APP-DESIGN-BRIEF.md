# QuoteAI: the complete app, for design

This brief lists every screen, section, state and role the QuoteAI app has today, plus the ones coming once the integrations are set up and the planned features ship. Design all of them in one consistent style so nothing is left to improvise when the app is built.

It covers **what each screen must show and do**, not how it should look. The style is yours.

---

## 0. What QuoteAI is, and the ground rules

**The product.** QuoteAI runs a Canadian contracting business from a phone. You describe a job out loud or in text, and the AI writes an itemized quote with the right provincial taxes. The client accepts and signs online. The quote becomes a job with milestones, a crew schedule, costs, photos and field reports. Invoices come from the job's payment schedule, and the client pays by card or Interac e-Transfer. Money, crew hours, pay and tax deadlines are tracked along the way.

**Who uses it.** Three kinds of people:

1. **The company** signs in. Five roles see different things:

   | Role | What it can do |
   |---|---|
   | **Owner** | Everything |
   | **Admin** | Everything except billing, integrations and security, which are read-only |
   | **Office** | Quotes, jobs, costs, invoicing |
   | **Foreman** | Jobs and costs on site, everything else read-only |
   | **Viewer** | Read-only everywhere |

2. **The crew** (workers and subcontractors) don't sign in. They use a personal link on their phone to clock in, see tasks, send photos and reports, and log hours.
3. **The company's clients** open links: a quote to accept, a contract to sign, an invoice to pay, and a portal for everything about their job.

**Platforms.**
- An Android and iOS app. This is the priority and the first thing to design.
- The same app in a phone browser.
- A desktop web app. It is secondary, but every screen exists there too as a wider layout: sidebar navigation, two columns, tables instead of lists.

**Hard requirements for every screen.**
- **Phone first.** Frames are 390 × 844, and layouts must also work at 360 and 430 wide. Nothing may scroll sideways.
- **Two languages, English and French (Canada).** French runs about 20% longer, so design every label to survive it. Show the French version for any tight spot: tabs, buttons, chips.
- **Large text.** Every screen must still work with the phone's text at 2×. Labels wrap or shrink; they are never clipped.
- **Touch and accessibility.** Targets are at least 44 × 44. Text contrast is at least 4.5:1. Every icon-only button needs a name. Status can never be colour alone: always a word too.
- **Offline.** Screens must show work saved on the phone, waiting to send, or in conflict (see §2.4).
- **Plans and roles.** Many screens have a locked-by-plan and a read-only-for-your-role variant (see §2.5).
- **No prices or purchases in the phone app** (store rules). Plan changes happen on the website; the app only says so.
- **Money is Canadian.** "$48,230" on cards and "$4,131.05" on documents in English; "48 230 $" and "4 131,05 $" in French. Tax names are **GST, HST, QST, PST, RST**, which in French are **TPS, TVH, TVQ, TVP, TVD**.
- **Dark mode.** The app should follow the phone's light or dark setting. Please design a dark version of the system; Settings will then offer Light, Dark and Auto.

**Please also design a component sheet** covering everything in §1, with every state (default, pressed, disabled, loading, error, empty, selected), light and dark.

---

## 1. Components the whole app is built from

List every one with its states:

- **Navigation:**
  - bottom tab bar (4 sections), with the assistant button beside it
  - the header on inner screens: back, title or an identifier, and a ⋯ menu
  - a large page title
  - a sticky tab strip inside a screen (Job has 10 tabs), which scrolls horizontally when it doesn't fit
- **Cards and lists:**
  - list row: title, meta line, amount, status, chevron, leading avatar or icon tile, swipe actions
  - menu row: icon tile, label, value, chevron
  - settings row: label, hint, control (switch, stepper, segmented, chevron)
  - section header with a link
  - group label
  - stat strip / KPI tiles
- **Status:**
  - quotes: draft, sent, viewed, accepted, declined, expired
  - invoices: draft, scheduled, sent, viewed, awaiting confirmation, partially paid, paid, overdue, void
  - jobs: planning, active, on hold, completed
  - contracts: draft, sent, viewed, signed, declined, voided, expired
  - leads: new, contacted, quoted, won, lost, unsubscribed
  - time entries: to approve, approved, rejected
  - permits: needed, applied, issued, closed, not required
- **Controls:**
  - primary, secondary, destructive and link buttons
  - chip button
  - floating bottom action bar (one primary action plus "more")
  - switch, segmented control, −/+ stepper
  - checkbox and round tick
  - radio list
  - date and time pickers
  - search field
  - filter chips with counts
- **Inputs:**
  - text, email, phone, money, number with unit, multi-line
  - select
  - one-time code (6 digits)
  - signature pad (draw or type)
  - file / photo drop zone, and the camera / gallery choice
  - address field
  - colour-free validation error
- **Overlays:**
  - bottom sheet: title, content, actions; draggable; tall variant with scrolling content
  - action sheet (the ⋯ list)
  - confirm dialog, destructive confirm dialog, and "type DELETE" confirm
  - toast with Undo
  - full-screen takeover (camera, the assistant)
- **Data display:**
  - progress bar
  - line chart with period switch
  - bar chart, stacked bar, pie, aging bar, budget vs actual bars
  - timeline / Gantt, per-person schedule lanes, agenda list
  - activity timeline
  - document preview (quote, invoice, contract)
  - photo grid with multi-select
  - message thread
- **Feedback:**
  - skeleton loading for each layout: list, detail, stat strip, card, tabs
  - empty state (illustration or icon, one line, one action, and an optional "Watch how" video link)
  - error state ("This didn't load" + Retry)
  - offline notices
  - banners: info, warning, success, error
  - upgrade / locked card
  - read-only notice
- **People:** avatar (photo or initials), avatar row with status rings (on site, later today, off), company logo.
- **Voice:** mic button (idle, listening with level, transcribing), and the assistant's live orb (listening, thinking, speaking, muted).

---

## 2. Global pieces

### 2.1 App shell
- **Phone:**
  - A bottom tab bar with **Home · Quotes · Jobs · Clients**, and a separate **assistant** button. A foreman gets Jobs first.
  - The tab bar shows on those four screens only. Inner screens show the back header.
- **Avatar top right on Home** → **Menu**. It shows a dot when something is unread.
- **"More actions" (⋯) on every screen:** the screen's own actions, then what can be started from it:
  - new quote, new lead, new job, new invoice
  - photo of a receipt (asks "which job?" and then opens the document scanner)
  - job note by voice (asks "which job?")
- **Desktop:** a collapsible sidebar with the groups Overview · Sales · Delivery · Insights · Workspace; a search / command palette (⌘K) with "Quick actions" and "Pages"; a notifications bell; and an account menu with the company switcher, profile, company profile, plan & billing, settings and sign out.

### 2.2 Notifications
- **Bell / list:** title, body, time, unread dot, and a link to the thing. "Mark all read". Empty state.
- **Kinds:**
  - quote viewed; quote accepted
  - contract signed or declined; change order signed
  - payment received; e-Transfer reported (to confirm); invoice overdue; milestone payment due
  - client message; SMS reply
  - crew hours to approve; blocker from the site; job ready to start
  - job budget at 90% or over
  - filing or licence deadline
  - crew check-in or check-out
  - **morning brief** at 6:30 ("Your day": what's booked, who's on, the weather)
  - team member joined; group invitation; invoice drafted or sent; client opted out of texts
- **Push opt-in:** a one-time sheet after the first quote goes out ("Know the moment they accept?").

### 2.3 Search
Global search across quotes, clients, jobs, invoices and pages, with recent items and results grouped by type.

### 2.4 Offline and sync (must be designed)
- **Offline:** "anything you save is kept on this phone", and "N waiting to send".
- **Sending:** "Sending N…"; "Showing what was synced at 9:41, updating".
- **Photos:** "N photos waiting for Wi-Fi", with a "Send now" option.
- **Rejected by the server:** "1 change couldn't be sent", with Retry / Discard per item and a details list of what each change was.
- **Conflict:** "N changes need you, also changed on another device". Show each field side by side (yours vs now) with **Keep mine / Keep theirs**.
- **Update:** "A new version is ready" → Reload.
- **Server unreachable:** "Can't reach QuoteAI right now" → Try again.
- **Saved offline:** a toast, "Saved on this phone, it will be sent when you're back online".

### 2.5 Plans, roles, locks
- **Plans:**

  | Plan | Price | Adds |
  |---|---|---|
  | Free | | Quotes only |
  | **Starter** | $29 | 15 quotes/month, watermarked PDFs, 1 login |
  | **Pro** | $79 | 60 quotes, price list, contracts, jobs (3 active at a time), costs, invoicing, 2 logins |
  | **Business** | $249 | Unlimited; team time, assistant, analytics, QuickBooks / Wave, calendar sync, card payments, Gmail; 5 logins |
  | **Elite** | Custom | Financing (Financeit), bank feed (Flinks), Facebook / Google lead imports, public API, multi-company group; 10+ logins |

- **Designs needed:**
  - **Locked-by-plan** card or screen: what it is, "Included in {plan}", See plans. In the app it reads "Plans can't be changed in the app".
  - **Read-only banner** ("Your role can view this but not change it").
  - **"Not part of your role"** screen.
  - **Job-limit** message ("3 active jobs on Pro").
  - **Quota** meter and "quota reached".
  - **Trial** banner (7 days, 3 PDF downloads left).
  - **Unlock-a-quote paywall** (web only): plan cards, or a one-off purchase.
- **Monthly allowances:** receipt scans, WhatsApp messages and SMS texts, each with a usage meter, an "almost used" warning and a "used up" state.

### 2.6 Phone-app-only pieces
- **App lock:** "QuoteAI is locked", "Unlock with Face ID / fingerprint", "Sign out and use my password". There's also a one-time offer sheet to turn it on.
- **Permission explainers** before the phone asks:
  - camera: receipts and site photos
  - microphone: only while the mic is on
  - location: only at clock-in and clock-out
  - notifications
- **Share into QuoteAI** from another app: "Add to QuoteAI" → a receipt / photos for a job / start a quote from this → "Which job?". Also an "unsupported file" state.
- **In-app browser** for pages that live on the website: terms, help, client links.

---

## 3. Getting in (phone app and web)

- **Welcome** (first open only):
  - 3 swipeable slides: "Quotes in minutes, from your phone" / "Every job in one place" / "Get paid sooner"
  - EN/FR switch; optional "Watch the 60-second tour"
  - Create an account / I have an account / "On a crew? Join your team"
- **Join your team (crew):** paste a link or a 10-character access code. Invalid-code error.
- **Sign in:**
  - email, password (show/hide), Forgot password
  - errors: wrong details, not verified, no connection
  - banners: "account deletion cancelled" / "link expired"
- **Two-step verification:** 6-digit code from an authenticator, or a backup code.
- **Forgot password:** email → "Check your email". **Set a new password** (reached from the email link): new password, confirm, done. *This screen doesn't exist yet; design it.*
- **Sign up:** name, email, password (8+). "Registration closed (beta)" state with "Request access".
- **Verify email:** 6-digit code, auto-submits; "Send a new code in 30 s"; wrong code / too many tries; "Use a different email".
- **Onboarding** (3 steps, skippable):
  1. **Your work:** trade chips (general, renovation, painting, electrical, plumbing, HVAC, roofing, carpentry, flooring, drywall, masonry, landscaping, concrete, cleaning, other) and province, with a live line such as "Your quotes will show HST 13%".
  2. **Your business:** company name, phone, email. Optional extras: logo, business number, licence (RBQ in Québec), address, e-Transfer email, default payment schedule.
  3. **Your team:** team size, logins wanted, field crew yes/no. Then invite by email or create access codes (with a role); "Field crew never need a login".
- **Pending invitations** interstitial: "{company} invited you as {role}" → Join, or "Set up my own company".
- **Join by access code:** code → preview "{company} · {role}" → Join (or create an account / sign in first).
- **Accept a team invite link:** valid, invalid, wrong-account ("signed in as another email") and success states.
- **Guided first quote:** a 3-step coach (describe the job → check it and send it to yourself → "Your first quote is out. From sign-up to sent: 6 min"), then the notifications ask.
- **Welcome to the team** (new member): photo, name, job title, phone → Save and continue.

---

## 4. Home

The daily cockpit for the owner and office. A foreman gets **Foreman Home** (§4.2).

### 4.1 Home (owner / office)
- **Header:** date, weather ("12°, rain after 3 pm", from Environment Canada), a greeting by time of day, and the avatar → Menu.
- **New quote composer:**
  - describe the job by typing or dictating
  - attach photos (1–5 by plan); pick or add a client
  - send → progress steps: "Reading the scope" → "Pricing at {city} rates" → "Adding {tax} and terms"
  - **Draft ready:** total incl. tax, item count, the first lines, **Review and send**, **Redo**
  - hints for listening, no photos allowed on this plan, and quota reached
- **Schedule:** this week as a day strip (dots on busy days); the chosen day's agenda (time, type, title, place, "On site" / "Next"); "Nothing booked" → Add visit. Links to the full Schedule.
- **Today checklist:** "3 of 6 done", round ticks. Items:
  - chase an overdue invoice (amount, days late)
  - confirm an e-Transfer
  - approve timesheets (hours, people)
  - answer a site blocker
  - call a lead back
  - follow up an unanswered quote
  - job tasks due today or late

  Ticked items stay struck through until midnight.
- **Business:** Week / Month / Quarter switch. Shows:
  - "Collected in September" with the change vs the last period, and a trend line (8 weeks / 6 months / 4 quarters)
  - **Quotes won %**, **Outstanding** (with overdue), **Margin after labour**
- **Crew:** "3 on site · 1 later today". Avatars ringed on site / later / done, and the chosen person's line: job, site, "On site 7:12" / "Starts 7:30" / "Done for the day". *Later: live "On the way, 14 min" with crew location (§15).*
- **Sites:** open jobs with a progress bar, next milestone and crew names; "All N".
- **New account state:** 3 starter cards (complete your profile / describe a job / send it), and "first quote in 30 s".
- **Trial / upgrade** banners (web).

### 4.2 Foreman Home
- **Blockers first:** answer them or mark sorted.
- **Who is where:** on site since / elsewhere / not in / later / not booked.
- **Hours to approve:** swipe to approve; Approve all.
- **"From the field":** reports with photos; answer, mark sorted, "in cost review".
- **Next up** (5 items) and quick links: Schedule, Jobs, Hours.

---

## 5. Sales

### 5.1 Quotes list
- Filters: All / Draft / Sent / Accepted / Pending; search by client or description.
- Row: client, quote title, date, status, total. Swipe or ⋯: view, duplicate, archive, delete (with confirm).
- Empty states: none yet / no results.

### 5.2 New quote (full screen)
- Three modes: **Write with AI**, **Manual**, **From the price list**.
- **AI mode:**
  - big describe box, mic, attachments (photos, PDFs, spreadsheets)
  - example chips by trade
  - options: PDF layout (Standard / Professional / Elegant), target total
  - client picker or new-client form (name, address, city, province, postal code, email, phone, business number, GST/HST, "remember this client")
  - Write → "Writing your quote…"
- **Manual mode:**
  - title, subject, description
  - chapters with lines (description, unit, quantity, unit price, total); "improve with AI" per line
  - chapter subtotals, add chapter
  - taxes by province or tax-exempt; payment terms; final notes; layout
- **Price list mode:** search the price book and add items.

### 5.3 Quote (detail)
- **Top:** number, "Draft · valid until Oct 29" / "Sent · viewed today" / "Accepted Oct 3 by Dana".
- **Body:** title; client with Change; **Scope, as understood** with Edit.
- **Line items** grouped by chapter. A measured item has a −/+ stepper (for example "1,120 sq ft"); a lump sum shows "fixed". Tap a line to edit it fully; delete; Add item.
- **Totals:** subtotal, discount, tax per province ("HST, Ontario 13%"), total.
- **Deposit on acceptance** switch (how the client can pay: card / Interac e-Transfer) and "due on acceptance".
- **Send by:**
  - Email / SMS / WhatsApp, each showing a masked address or number
  - "not set up" and "add number / add address" states
  - Preview (what the client sees); Send $X → "Sent to Dana"
- **Status actions:**
  - after acceptance: **Start the job** / **Open the job**
  - after sending: Copy the client's link, Send again
- **Full editor** (⋯): company header and logo, Bill To, summary table by chapter, detailed breakdown, totals, payment terms, notes.
- **Also in the full editor:**
  - **Price check:** lines that moved against your price list or receipts → Reprice
  - **Good / Better / Best options** (up to 3)
  - PDF layout picker; Download PDF; Download Professional PDF
  - "Upgrade to Pro spec"; Regenerate with AI (with new instructions); Duplicate / Archive / Delete
- **Contract card:** "Draft contract with AI" → the contract. Locked on Starter.
- **Payment schedule editor:** terms (label, when: on signing / milestone / on completion / N days, % or $, due days), holdback %, total check.
- **Paywall** to unlock a draft (web).

### 5.4 Clients
- **List:** name, contact, number of quotes, lifetime value, Active / Prospect, last activity; swipe → Call; search; add client.
- **Client page:**
  - contact actions (Call, Text, Email, Map)
  - stats (quotes won, total value, owed, jobs)
  - details (GST/HST, business number, address)
  - tabs: **Quotes**, **Jobs**, **Invoices**, **Messages** (thread with the client, and the client-portal card: copy link, invite, last opened)

### 5.5 Leads
- Pipeline **New → Contacted → Quoted → Won / Lost / Unsubscribed**. Board on desktop; stage tabs on the phone.
- **Lead card:** name, source (website form, manual, import, Facebook / Instagram, Google Local Services), channel, next follow-up, "Send now".
- Move to another stage with Undo; switch follow-ups between SMS and email.
- **New lead:** name, email, phone, follow up by email or text, notes.
- Empty states, including "connect a lead source".

### 5.6 Contracts
- **List:** filters (drafts / awaiting / signed / closed); number, client, status, sent, signed.
- **Contract page:**
  - progress "Review → Sign → Send → Customer signs"
  - the agreement text (AI-drafted sections editable, legal clauses locked), with fold/unfold on phone
  - signers (company, customer) with pending / viewed / verified / signed / declined
  - details: province, language, subtotal, tax, total, holdback
  - activity timeline
- **Actions:**
  - sign as company (name, signature pad, consent)
  - send to customer (email, message); resend
  - edit terms: start date, duration, warranty, holdback, "signed away from the business" (10-day cancellation), "client asked for English" (Québec)
  - download the PDF or the signed PDF; void (with reason); archive
- **Change orders** are contracts too (from a job).

---

## 6. Jobs

### 6.1 Jobs list
- Filters: review setup / planning / active / on hold / completed.
- Row: name, client, dates or "Next: milestone", crew, progress, value.
- New job: name, address, value, start and end dates.
- Also on this screen: the "receipts to review" row, job-limit message, and empty state ("an accepted quote becomes a job").

### 6.2 Job setup (review the AI's plan after signing)
- Name, value, schedule window.
- **Milestones:** reorder, title, number of tasks, % of work, dates, the linked payment term. Add, delete, "shift everything to start on…".
- **Cost budget** by category (materials, labour, subcontractors, permits & fees, equipment, misc) → expected costs and projected margin.
- "Looks good, start the job".

### 6.3 Job (detail), 10 tabs
- **Top:**
  - contract number, dates, name (rename), client, address (maps), status
  - milestones done and %
  - KPIs: contract value (+ change orders), invoiced (collected / outstanding), costs (to review, % of budget), projected margin
- **Actions:**
  - **On my way** (texts the client an ETA)
  - start / resume, put on hold
  - **mark complete** (final invoice amount, holdback release, open milestones and permits that block it)
  - reopen, archive, edit the plan
  - **Photo** and **Dictate** always one tap away
- **Tabs:**
  1. **Overview:**
     - blockers from the field (answer, mark sorted)
     - who's on it today; up next (milestone, the payment it releases)
     - schedule forecast; unbilled work; earned vs invoiced; budget vs actual; cost and cash curve; timeline
     - field reports
     - **permits:** status, AI suggestions by province ("Add N"), add/edit (type, status, issued by, number, link, dates, next inspection, expiry, notes)
     - notes (typed / dictated / from a photo / by the assistant)
     - payment schedule, with each term's invoice and status
  2. **Schedule:**
     - milestone timeline, and editing dates
     - crew blocks for 4 weeks with conflicts
     - milestone cards (start / complete / reopen), each with tasks (tick, delete, "from the site · name", add)
     - other tasks
  3. **Change orders:**
     - needs a signed contract; list with status, ± days and amount
     - new change order: title, schedule change, description, items, tax → "create and go to signing"
  4. **Costs:**
     - receipt capture (scan → AI reads it); "to review" queue
     - entries by category with their source (receipt, time, equipment, manual, bank line, travel)
     - budget vs actual
     - **Cost editor:** AI confidence, job, category, date, vendor, milestone, subtotal, tax split, total, receipt image → Save for later / Confirm
  5. **Invoices:**
     - invoiced / collected / outstanding / still to invoice
     - the billing plan (each term: due now, open or create its invoice); holdback release
     - the job's invoices; manual invoice
  6. **Team:**
     - hours on the job (approve / reject / reopen); log hours
     - equipment use; assigned workers (assign, new worker)
     - **job-site location** (use my location, radius) for clock-in checks
  7. **Photos:**
     - take / choose; grid with multi-select → **Share with the client**; delete
     - photos waiting to upload
  8. **Messages:** the client thread and the portal card.
  9. **Documents:** contract, change orders, quote, invoices, receipts.
  10. **Assistant:** the job's conversation.
- **Voice / photo capture** (from ⋯ or the new-item sheet):
  - dictate ("tap to talk / listening / working") or type
  - a photo with an optional note → the assistant proposes an entry (cost, task, note, milestone update)
  - Confirm / Dismiss; Another / Done
  - offline: "recording kept on this phone"

### 6.4 Schedule
- Week / day, previous / today / next, add block, "only this job" filter.
- **Desktop board:** lanes per worker plus unassigned and a milestones row; drag to create or move; double-booked marker.
- **Phone agenda:** week strip; group by person or by job; free time with "Book"; clash markers.
- **Block editor:** worker, job (or "shop day"), milestone, label, dates, hours or all day, notes for the worker, conflict warning, "reminder already sent".
- Empty: "No workers yet". Locked: Pro.

---

## 7. Money

### 7.1 Invoices
- **List:**
  - outstanding (and overdue), paid this month, drafts
  - **aging bar** (not yet due / 1–30 / 31–60 / 61–90 / 90+)
  - filters with counts; search
  - row: number and type (deposit / progress / final / holdback release / change order), client, issued, due, amount, status
  - swipe → Record payment
- **New invoice:** job or none, client, title, due in N days, lines, notes.
- **Invoice page:**
  - total / paid / balance / due; lines; the client's link; payments; activity timeline; reminder schedule
  - banners: holdback scheduled, auto-send countdown, voided, **"Customer says they sent $X by e-Transfer"** → Confirm received / Not received
  - actions: send / resend (email and message); remind; **record payment** (amount, date, method: e-Transfer / cheque / cash / card / bank transfer / other, reference, email a receipt, overpay warning); download PDF; edit draft; copy or open the client's view; **credit note**; void; archive; discard draft

### 7.2 Pay (payroll prep)
- Tabs: **Pay period**, **Labour by job**, **Rules and export**.
- **Pay period:**
  - period navigation; export (CSV / Wagepoint / Payworks / QuickBooks Payroll)
  - warnings: hours to approve, changed since export, missing payroll numbers, zero rates, holidays in the period
  - totals: gross, hours / overtime, holiday pay, travel and per diem
  - a card per employee with earnings lines
  - crew travel claims (approve / reject); subcontractors
- **Labour by job:** job, hours, overtime, straight time, premium, burden, travel, cost.
- **Rules:**
  - pay frequency; overtime by province or trade presets (Ontario construction, Québec R-20…)
  - statutory holidays and vacation %
  - travel rate and per diem; export codes; payroll numbers

### 7.3 Books (month-end)
- **Month-end:** month, closed or open, N open items, "Close September". Checklist:
  - bank lines unmatched; payments not in the bank; costs pending; claims without a receipt
  - tax not split; draft invoices unsent; hours unapproved
  - not yet in QuickBooks / Wave

  Each item can be opened or marked N/A.
- **Bank lines** (with Flinks connected): filter; date, line, amount, matched to. Match to a cost, a payment or an invoice; "record as a cost"; ignore; undo.
- **Crew claims:** a claim next to the receipt it matches → "Same thing"; scan a receipt.

### 7.4 Compliance (tax and licence deadlines)
- Setup: GST/HST, QST, PST/RST periods, fiscal year end, instalments, T5018 on/off.
- **Deadlines:** late / next 90 days / later; mark filed or paid, undo; open the worksheet.
- **Sales-tax worksheet:** period; the return's lines (101 / 105 / 108 / 109) and the QST block; warnings; invoices and purchases tables; CSV.
- **Subcontractors (T5018):** year, recipients, totals, the "$500 or more" flag, CSV.
- **Reminders:** workers' comp, licence, insurance, other; due date, repeat, "remind N days before".

---

## 8. Team and crew (company side)

### 8.1 Team
- **Workers:**
  - name, type (employee / subcontractor), trade, rate, hours this month, hours to approve, time-link status
  - add / edit (burden %, contact, payroll number, "can add tasks from site"); send or revoke their time link; deactivate, delete
- **Time entries:**
  - filters (to approve / approved / rejected; worker; dates)
  - approve selected or all (swipe on phone)
  - geofence flag, overtime, holiday, "logged by the worker"; payroll CSV
- **Equipment:** owned / rented / financed, rate per day or hour, charged this month, financing (lender, monthly payment, months left).
- **Team members (logins):**
  - seats "3 of 5 used"; buy logins (web)
  - invite by email with a role (and a copy-link fallback); resend, suspend, remove
  - **access codes** (create N codes with a role, shown once, print or copy); leave this team
  - **Leaderboard:** quotes sent, won, win rate, invoiced
- **Crew today** (shared by Home, Foreman Home and the job):
  - blocked right now; who is where; not on a job
  - hours to approve; from the field

### 8.2 Profile (me) and teammate
- Photo, name, role, job title, phone, about.
- **My numbers** by period: quotes made and sent, won %, invoiced, hours, jobs.
- By-month table; history feed. A teammate's page is read-only.

### 8.3 Group (multi-company, Elite)
- **Overview:** invoiced, costs, margin, outstanding; by company, by month; intercompany eliminations.
- **Companies:** members, roles, invites, shared price book, **one bill** (who pays for whom), rename, leave.
- **Crew:** people on several crews (combined hours, over-the-line warning), link records as one person.

---

## 9. Insights and workspace

- **Analytics:**
  - invoiced / collected / costs / margin / outstanding / upcoming
  - profit by month; receivables aging; 8-week cash flow; **jobs at risk** (over budget, burning budget, behind, overdue invoices, unbilled, completed but not billed); margin by job
  - quote stats: count, value, average, per month, by status
- **Assistant (full screen):** threads (company, per job, new), suggestion chips, the conversation, and proposal cards. See §12.
- **Documents (price intelligence):**
  - upload past quotes, invoices or price sheets → the AI extracts prices
  - "almost ready 2/3"; average prices; price-trend alerts; supplier comparison
  - document list with status
- **Imports:**
  - bring in clients and quotes from a spreadsheet (template) or PDFs (AI)
  - import history; a review queue of each found record (matched / new client) → Confirm / Reject
- **Archive:** archived quotes, clients, invoices, jobs, contracts → Restore.
- **Price list (price book):**
  - items (name, category, unit, price, "from {company}" when shared)
  - add / edit; import from quotes, from a photo or PDF (review what was found), from CSV
  - stats; search

---

## 10. Menu and Settings

### 10.1 Menu (from the avatar)
- Profile card → me.
- **Plan strip:** plan, renewal, seats, Manage. Owner only.
- **Companies:** switch.
- **Business:** company profile, price book, taxes, leads, contracts, documents, analytics, group, imports, archive.
- **Team:** crew and roles, timesheets (N to approve), schedule, pay.
- **Money:** invoices, payments and payouts, accounting sync, books, compliance.
- **App:** settings, notifications, help. Also sign out and the build number.

### 10.2 Settings
- **Assistant:** voice (three voices), language (English / Français), speak replies aloud, ask before sending. Later: **permissions per action** (§15).
- **Quote defaults:** province and tax, deposit %, valid for N days, materials markup %, send me a copy.
- **Notifications:** morning brief, quote viewed, payment received, crew check-ins, signatures, client messages, crew hours and blockers, job budgets, deadlines; "notifications on this phone".
- **Display:** **appearance (light / dark / auto)**, units (ft / m / both), text size, photos on Wi-Fi only.
- **Security:** lock with Face ID / fingerprint, export my data.
- **Sections that open as pages:**
  - **Profile.**
  - **Sign-in & security:** two-step verification setup (password → QR code → verify → backup codes) and turning it off; active sessions; security activity; export my data (ready / preparing / failed / download); **delete account** (password, code, type DELETE; scheduled-deletion state with cancel).
  - **Company details:** name, business number, licence, phone, email, address, logo.
  - **Taxes & province:** province, GST/HST, QST, PST numbers.
  - **Invoices & payments:** e-Transfer email; default payment schedule; auto-send invoices (and delay); overdue reminders.
  - **Quotes & follow-ups:** follow-up days for leads and quotes; email me on acceptance; review requests (Google and HomeStars links, auto-send, delay).
  - **Website widget:** key, embed code, test page.
  - **Email sender** (Gmail): see §13.
  - **SMS:** preview, from number, CASL note; toggles (lead follow-ups, reminders, crew schedule reminders); usage; send a test; recent texts log (sent / failed / skipped / received and why).
  - **WhatsApp:** connect your number (verify with a code), usage meter, how-to, enable / disable, disconnect.
  - **Connected apps:** see §13.
  - **Plan & billing:** plan, renewal, quota meter, usage meters, manage in the Stripe portal, plan picker (monthly / annual), invoice history. The app says "manage your plan on the website". Members see usage only.
  - **Unsaved changes** bar and leave dialog.

---

## 11. The crew's phone (no account, personal link)

This is a separate, simpler app-like page for workers and subcontractors.

- **Opened from a link or code.** States: expired / invalid / offline (retry). Company switcher if they work for several companies.
- **"What changed" chip:** shifts added / moved / removed, tasks changed, answers to their blockers → Got it.
- **Now card:**
  - "On the clock" / "Today · 7:00–15:30"
  - job (change job); running timer; address → maps; call the site contact; gate code; phase
  - **Clock in / Clock out** (locating…, done); "location off" and why; "pending sync" offline
- **Today's tasks:** tick, add (if allowed), "All done".
- **Coming up:** their schedule.
- **Bottom bar:** Photo, **Report**, more (hours by hand, travel).
- **Report:** update, **Blocker** (alerts the office), **Materials** (what and $); photo; job; their reports with pending / failed / answered states.
- **Hours by hand:** job, date, hours (stepper and quick picks), phase, note; "your hours this week" (geofence flag, approval status).
- **Travel / per diem:** km or days, date, job, note. No money is shown to them.
- **Install prompt and offline bar.**
- **Crew messages they get:** the schedule reminder for tomorrow / today (email or SMS) and their timesheet link.

---

## 12. The assistant

**Today.** The black orb button opens a full-screen layer, and the screen behind steps back.
- **Voice:**
  - a live orb: listening (moves with your voice), thinking, speaking, muted
  - controls: keyboard, mute, close
  - "mic blocked" and "didn't hear that" states
- **Keyboard mode:** the orb rises and the conversation shows. Your bubbles, its replies streaming in, and a text input.
- **Proposals:** when it wants to change something (add a cost, a task, a milestone update, an invoice draft, send an invoice, record a payment, a change order draft, a job note) it shows a card → **Confirm / Dismiss** → Done / Dismissed / Failed / Open.
- **Full-screen thread list** (desktop and the Assistant page): company conversation, per-job conversations, new conversation, suggestion chips, "Start over".

**Coming** (design these too):
- Streaming progress lines ("Looking up the job… Drafting the invoice…").
- **Undo for 10 s** after an action.
- **Spoken read-back** before confirming. Anything over $5,000 always needs a tap.
- Waveform, voice picker, speaking rate, text-only mode.
- Minutes used this month, with an 80% warning.
- **"Call Mike":** opens the phone dialer (desktop shows the number and a QR code); "Add a note about the call?" afterwards. Later, a bridged call with a recording notice and an automatic call note.
- **Settings → Assistant → Permissions:** each action group set to "Can do it / Ask me first / Never".
- **Settings → Assistant → Activity:** everything the assistant did, with undo / void, and a usage and cost view.
- **Driving mode** (hands-free, big controls). Siri and Google Assistant shortcuts ("Ask QuoteAI…").

---

## 13. Integrations (Connected apps)

The directory has search, group chips, "Connected" first, then groups, "Coming soon", and a trademarks footer.

- **Tile states:** Connect / Set up · Connected (detail line) · **Needs attention** (a sync failed, sign-up unfinished) · Paused · Coming soon · Locked ("Included in Business").
- **Detail page for each app:** what it does, what's shared, connect, on/off switch, account and company, connected since, last sync, **sync log** (sent / failed → Retry, Run now), disconnect (confirm).
- **Return messages:** connected, cancelled, failed.

| App | What it does | Extra screens / where it shows up |
|---|---|---|
| **QuickBooks Online** | Invoices, payments and confirmed costs go to QuickBooks with tax codes; payments come back | Account mapping (income, deposit, payment accounts; tax codes; category → expense account), backfill, "pull payments now"; Books checklist; Menu "Accounting sync" |
| **Wave** | Paid invoices and costs go to Wave | Mapping; Books |
| **Google Calendar** | Job milestones and visits go to a chosen calendar | Pick calendar; event log |
| **Outlook Calendar** *(coming)* | Same as Google | Same |
| **Calendar feeds (ICS)** | Subscribe to outside calendars; publish a private schedule link | Feed list with errors; publish / replace / revoke link (shown once) |
| **Gmail** | Quotes, invoices and follow-ups go out from your own address | "Sends from", last send or failure |
| **Outlook email** *(coming)* | Same as Gmail | Same |
| **SMS (Twilio)** | Quote and invoice links, reminders, "on my way", replies | SMS settings; Send by → SMS on quotes |
| **WhatsApp** | Quote bot for the contractor; client messages, lead follow-ups and review requests once templates are approved | WhatsApp settings; Send by → WhatsApp on quotes |
| **Stripe (card payments)** | Clients pay invoices and deposits by card | Connect / finish / manage; payouts status; fee note; Pay by card on client pages |
| **Financeit** | Monthly-payment offer on quotes | Dealer ID, offer on/off; financing widget on the client's quote |
| **Flinks (bank feed)** | Bank lines matched to payments and costs | Connect → choose account; Books → Bank lines |
| **Facebook / Instagram Lead Ads** | Leads arrive in Leads | Page, import on/off, import log |
| **Google Local Services** | Leads arrive in Leads | Customer ID, import log |
| **HomeStars** | Review link | Link only |
| **Website widget** | Lead form on your site that gives an instant estimate | Key, embed code, test |
| **Public API & webhooks** | For developers | Keys (reveal once, revoke); webhooks (URL, events, secret, pause, delete) |
| **Calendly** *(planned)* | Booking visits | Settings; bookings in Schedule |

---

## 14. What the company's clients see (links, no account)

All of these share a light document frame: "From {company}", the document name, an EN/FR switch and the company logo.

- **Quote** (`/p/…`):
  - the quote document (chapters, lines, taxes, total, note)
  - **Good / Better / Best** option cards
  - **Accept:** full name → confirmed. Accepted banner: "Confirmed by Dana on Oct 3".
  - **rebates and incentives** that apply
  - **financing** (Financeit: estimate $X/month → apply → status)
  - **pay the deposit** by card or e-Transfer *(to design, coming)*
  - **download the PDF** *(to design)*
  - states: loading / not available / open / accepted
- **Contract / change order signing:**
  - review the contract (scroll to the end)
  - verify by email code
  - sign (draw or type, consent) → "Sign · $total"
  - decline (reason)
  - done ("download a copy") or "waiting for others"
  - states: expired, closed, not found
- **Invoice / credit note:**
  - balance due, due date, paid so far
  - how to pay: e-Transfer email (copy), cheque, reference
  - **Pay by card**; **"I sent it"** (e-Transfer confirm); download PDF
  - states: paid, void, awaiting confirmation, overdue
- **Client portal:**
  - sign in with an email code
  - tabs **Home · Quotes · Contracts · Invoices · Photos · Messages**
  - "needs your attention"; job progress with milestones; pay invoices; photos per job; message the company
- **Unsubscribe pages** (quote follow-ups, lead follow-ups, marketing): a simple branded confirmation.
- **Review request:** thank-you with the review link *(a branded page is to design)*.
- **Website widget** (on the contractor's site):
  - step 1: type of work, description, area, city, province, postal code
  - step 2: name, email or phone, consent
  - "working, up to half a minute" → **estimated range, taxes included**, call, start again
  - errors and unavailable state
- **Emails and texts** (design templates, EN/FR):
  - **to clients:** quote with PDF; follow-ups (3 steps); contract to sign; signing code; signed copy; signature reminder; invoice; overdue reminder; payment receipt; portal code and invite; new message; progress photos; review request; website-request received; "on my way" text
  - **to the company:** verify email and code; reset password; welcome; quote accepted; new website lead; contract declined; client replied; data export ready; account deletion scheduled
  - **to the crew:** timesheet link; team invite; schedule reminder

---

## 15. Coming next: design these now as well

- **Dark mode** for everything (and the Appearance setting).
- **Live crew location:** consent screen for the crew ("shared only while on the clock"), "On the way, 14 min" on Home, and a crew map with ETAs.
- **Role homes** (Home and tabs per role): office manager, estimator, project manager, dispatcher, bookkeeper, foreman, crew, safety coordinator.
  - "Customize home" (show / hide / reorder sections, pick tabs, density).
  - Settings → Team → Roles defaults.
  - Per-person sensitive switches (see pay, see margins).
- **Outside people:**
  - subcontractor (uploads licence, insurance and WSIB/CNESST clearance, sees their jobs)
  - consultant or architect (their jobs, read and comment)
  - accountant (read-only Books and Compliance)
- **In-app feedback:** shake or ⋯ → "Send feedback" with a screenshot preview and note → "Thanks, sent". Crash-report consent line in Settings.
- **Videos:**
  - 60-second overview (Welcome)
  - "Watch how" on first-time and empty screens (Quotes, Jobs, Integrations, crew's first day), in an in-app player with captions and speed
  - a video at the top of help articles; a video library page
- **Help centre inside the app:** search, articles, contact support.
- **What's new** sheet after an update.
- **Deposit payment on the client's quote**, and PDF download there.
- **Suppliers:** vendor list, contacts, price history, "call supplier".
- **Materials / inventory:** stock by item, reorder.
- **Warranty and service calls:** after completion, calls and visits tied to a finished job.
- **Subscription dunning:** payment failed, grace period, downgrade banners.
- **Editable message templates:** follow-ups, reminders, review requests.
- **Multi-company under one login** (a company picker at sign-in).
- **Tablets:** later; a phone-first design stretched to two columns is enough to plan for.

---

## 16. Checklist for delivery

For each screen: phone frame (390 wide) in **English**, the **French** variant where text is tight, **empty**, **loading**, **error**, **offline**, **locked by plan** / **read-only role** where they apply, and **dark**. Also the component sheet (§1), with every state.

Priority order:

1. Home, Quote (detail and new), Quotes list
2. Jobs list and Job (all tabs)
3. Invoices and invoice
4. Clients and client
5. Schedule
6. Menu, Settings and its pages
7. The assistant
8. Crew phone page
9. Client-facing pages
10. Getting in
11. Everything else
