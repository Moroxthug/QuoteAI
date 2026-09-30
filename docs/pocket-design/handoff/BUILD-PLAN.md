# Build plan

Seven phases. Each one ends with something you can put in testers' hands. Don't start a phase until the one before meets its "done" line. Every screen is built in light and night, English and French, from the first commit.

## Recommended stack (a recommendation, not a decision)

**Expo (React Native) with TypeScript**, `expo-router` for navigation, `react-native-reanimated` for the expanding cards and the orb, `react-native-svg` for the gradient icons, `expo-font` for Geist and Manrope, and `i18next` (or `expo-localization` + a small dictionary) for EN/FR.

Why:
- One codebase for iPhone and Android.
- It works well with Claude Code and in Replit.
- The same TypeScript tokens drive the app and the client-facing web pages.

The trade-off: the floating pop and the glass tab bar need care to feel native. Budget time in phase 0 to tune them on a real phone, not the simulator. Native SwiftUI + Kotlin would feel slightly more polished but doubles the work. It isn't worth it at this stage.

## Phase 0: Foundations
**Build:** tokens, theme switching (light / night / auto, grounds), fonts with the digit rule, icons, the translation layer, and all 24 components from `COMPONENTS.md` on one sandbox screen that mirrors `Components.dc.html`.

**Done when:**
- The sandbox matches `Components.dc.html` side by side, in light, night and French.
- The expand card and swipe row feel right on a real phone at 60fps.
- Every digit on the sandbox is Manrope.
- Nothing is hard-coded: search the code for hex colours outside `tokens.ts`; there should be none.

## Phase 1: Getting in
**Screens (11):** Welcome, SignIn, SignUp, Verify, TwoStep, ForgotPassword, Invites, JoinCode, CompanyPicker, Onboarding, FirstQuote.

**Done when:**
- A new owner can sign up, verify, finish onboarding and reach an empty Home.
- An invited crew member can join with a code.
- Every state on the boards is reachable: wrong code, locked, expired link, email taken, weak password, offline.

## Phase 2: Quote to cash (the product)
**App screens (11):** SmartHome, Quotes, NewQuote, Quote, QuoteEditor, PriceCheck, Clients, Client, Leads, Invoices, Invoice.

**Web and messages (7):** ClientQuote, ClientSign, ClientInvoice, ClientDeposit, Portal as web pages on quoteai.ca; EmailQuote and TextMessages as email and SMS templates. All of these have their own EN/FR switch.

**Done when:**
- A contractor can describe a job by voice, get a quote, send it, and the client can open, accept and sign it on the web and pay a deposit.
- The contractor then invoices and records payment.
- Home shows the live numbers.
- This is the first build worth giving to real contractors.

## Phase 3: Jobs and crew
**Screens (16):** Jobs, JobSetup, Job, Schedule, ChangeOrder, ServiceCalls, Team, Teammate, CrewNow, CrewMap, CrewHours, CrewTravel, CrewExpired, LiveLocation, ForemanHome. SubPortal is a web page for subcontractors.

**Done when:**
- An accepted quote becomes a job with stages.
- The crew can clock in and out (location only while on the clock, as designed) and log hours and travel.
- The foreman gets their own Home.
- A change order goes out and comes back signed.

## Phase 4: Money and office
**Screens (13):** Books, Pay, AccountantView, Compliance, Group, Contracts, Contract, PriceBook, Inventory, Suppliers, Supplier, Documents, Analytics.

**Done when:**
- Month-end closes: bank lines are matched, receipts attached, HST owed shown.
- Payroll exports.
- The accountant gets read-only access.
- Contracts can be signed.
- The price book feeds quotes.

## Phase 5: Assistant, settings and account
**Screens (31):**
- Assistant and personalisation: AssistantProposals, AssistantActivity, AssistantPermissions, Notifications, Search, CustomizeHome, RoleHomes.
- Menu and settings: Menu, Settings, Profile, SetCompany, SetInvoices, SetMessaging, SetPlan, SetQuotes, SetRoles, SetSecurity, SetTaxes, SetWidget, Integrations, Integration, MessageTemplates, Imports, Archive.
- Help and account: HelpCentre, VideoPlayer, Feedback, WhatsNew, Dunning.
- Web: WidgetForm (lead form for the contractor's website), Unsubscribe.

**Done when:**
- The assistant proposes, asks before acting and logs what it did, within the permissions set.
- Every setting persists.
- SetPlan and Dunning show the plan and send people to quoteai.ca; there is no purchase in the app.

## Phase 6: Polish and release
**Screens (2):** SystemStates (offline, sync, limits, server refusals) and Tablet (two-column layout at 1366).

**Done when:**
- Every screen passes the accessibility baseline in `COMPONENTS.md` at the largest text size.
- Offline behaves as SystemStates shows.
- A native Quebec speaker has reviewed the French.
- Store screenshots and the app icon are made in both languages.

## Checklist for every screen (put it in the PR template)
- [ ] Matches the board in light and night, EN and FR (open the `.dc.html` side by side)
- [ ] Every state listed in `SCREENS.md` is built
- [ ] Every link in `navigation.json` for this screen goes where the design goes
- [ ] Only tokens and the 24 components; no new colours, sizes or one-off styles
- [ ] Every digit in Manrope; money and dates formatted per locale
- [ ] Works at the largest text size; touch targets ≥ 44
- [ ] Status shown as word + colour + shape
- [ ] Reduced motion respected
