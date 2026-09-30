# Screen inventory

92 screens. Each has a night version; French is a separate board unless marked "built-in switch". Frame is the board size in the design (tall boards show the whole scroll). States are the Tweaks the board exposes: build each one. Links are what each screen navigates to. Full data: `screens.json`, `navigation.json`.


## Home and assistant

| Screen | Route | Frame | States | French | Goes to |
|---|---|---|---|---|---|
| Crew map `CrewMap` | `/crew-map` | 390×844 | state: default, empty, locked | board | SetPlan, SmartHome |
| Customize home `CustomizeHome` | `/customize-home` | 390×1780 | — | board | RoleHomes, SetRoles |
| Home (foreman) `ForemanHome` | `/foreman-home` | 390×844 + tab bar | state: default, clockedOut, offline | board | Clients, CrewHours, CrewNow, Job, Jobs, Menu, Quotes, Schedule, SmartHome |
| Role homes `RoleHomes` | `/role-homes` | 390×844 + tab bar | role: officeManager, estimator, projectManager, dispatcher, bookkeeper, safety | board | Analytics, Books, ChangeOrder, Clients, Compliance, CrewMap, CustomizeHome, Documents, Job, Jobs, Menu, NewQuote, Notifications, Quotes, Schedule, SmartHome |
| Smart Home `SmartHome` | `/smart-home` | 390×844 + tab bar | — | board | Books, Clients, CrewMap, Invoices, Jobs, Leads, Menu, Quote, Quotes, Schedule |

## Sales

| Screen | Route | Frame | States | French | Goes to |
|---|---|---|---|---|---|
| Client `Client` | `/client` | 390×1760 | — | board | Clients, NewQuote, Quote |
| Clients `Clients` | `/clients` | 390×844 + tab bar | — | board | Client, Jobs, NewQuote, Quotes, SmartHome |
| Contract `Contract` | `/contract` | 390×2140 | — | board | Contracts, Quote |
| Contracts `Contracts` | `/contracts` | 390×1120 | — | board | Contract, Menu |
| Leads `Leads` | `/leads` | 390×1440 | — | board | Client, Menu, NewQuote, Quote |
| New quote `NewQuote` | `/new-quote` | 390×2040 | — | board | Quote, Quotes |
| Price check `PriceCheck` | `/price-check` | 390×1800 | state: default, loading, noHistory | board | QuoteEditor |
| Quote draft `Quote` | `/quote` | 390×1420 | — | board | QuoteEditor, SmartHome |
| Quote editor `QuoteEditor` | `/quote-editor` | 390×3250 | state: default, readOnly | board | Client, ClientQuote, Contract, PriceBook, PriceCheck, Quote |
| Quotes `Quotes` | `/quotes` | 390×844 + tab bar | — | board | Clients, Jobs, NewQuote, Quote, SmartHome |

## Jobs

| Screen | Route | Frame | States | French | Goes to |
|---|---|---|---|---|---|
| Change order CO-3 `ChangeOrder` | `/change-order` | 390×844 | step: describe, review, sent, signed | board | Job |
| Materials `Inventory` | `/inventory` | 390×1840 | state: default, loading, empty, offline, readOnly, locked | board | Menu, SetPlan, Supplier |
| Basement finish `Job` | `/job` | 390×2600 | — | board | ChangeOrder, Jobs, Schedule |
| Job setup `JobSetup` | `/job-setup` | 390×1760 | — | board | Jobs |
| Jobs `Jobs` | `/jobs` | 390×844 + tab bar | — | board | Clients, Job, JobSetup, Quotes, SmartHome |
| Schedule `Schedule` | `/schedule` | 390×844 | — | board | Job, SmartHome |
| Warranty and service `ServiceCalls` | `/service-calls` | 390×2000 | state: default, empty, offline, readOnly | board | Job, Jobs |
| Home Depot Pro `Supplier` | `/supplier` | 390×1700 | state: default, offline, readOnly | board | PriceCheck, Suppliers |
| Suppliers `Suppliers` | `/suppliers` | 390×844 | state: default, loading, empty, offline, readOnly | board | Inventory, Menu, Supplier |

## Money and team

| Screen | Route | Frame | States | French | Goes to |
|---|---|---|---|---|---|
| Accountant view `AccountantView` | `/accountant-view` | 390×1960 | state: default, accessEnded | board | CompanyPicker, Compliance |
| Books `Books` | `/books` | 390×1750 | — | board | Invoices, Menu, Team |
| Compliance `Compliance` | `/compliance` | 390×2380 | state: default, accountant, empty | board | Menu, SetTaxes |
| Group `Group` | `/group` | 390×1420 | state: default, locked | board | Menu, SetPlan, Team |
| Invoice INV-0412 `Invoice` | `/invoice` | 390×2010 | — | board | Invoices |
| Invoices `Invoices` | `/invoices` | 390×1720 | — | board | Dunning, Invoice, Menu |
| Pay `Pay` | `/pay` | 390×1880 | — | board | Menu, Team |
| Team `Team` | `/team` | 390×1860 | — | board | Menu, Teammate |

## Crew and clients

| Screen | Route | Frame | States | French | Goes to |
|---|---|---|---|---|---|
| Client · pay deposit `ClientDeposit` | `/client-deposit` | 390×2020 | state: pay, eTransfer, paid, declined | built-in switch | ClientQuote, Portal |
| Client · Invoice `ClientInvoice` | `/client-invoice` | 390×1900 | — | built-in switch | Portal |
| Client · Quote `ClientQuote` | `/client-quote` | 390×2300 | — | built-in switch | ClientDeposit |
| Client · Sign `ClientSign` | `/client-sign` | 390×2080 | — | built-in switch | Portal |
| Crew · link expired `CrewExpired` | `/crew-expired` | 390×844 | state: expired, replaced, invalid, offline | board | CrewNow |
| Crew · hours by hand `CrewHours` | `/crew-hours` | 390×1320 | state: default, submitted, offline | board | CrewNow |
| Crew · Now `CrewNow` | `/crew-now` | 390×1800 | — | board | — |
| Crew · travel `CrewTravel` | `/crew-travel` | 390×1600 | state: default, perDiem, offline | board | CrewNow |
| Email · quote sent `EmailQuote` | `/email-quote` | 390×2520 | lang: en, fr | — | ClientInvoice, ClientQuote, Unsubscribe |
| Crew · share location `LiveLocation` | `/live-location` | 390×844 | state: ask, on, off | board | CrewNow |
| Client · Portal `Portal` | `/portal` | 390×1680 | — | built-in switch | ClientInvoice, ClientQuote, ClientSign |
| Subcontractor portal `SubPortal` | `/sub-portal` | 390×1600 | state: default, expired | board | — |
| Texts to clients `TextMessages` | `/text-messages` | 390×1960 | channel: sms, whatsapp; lang: en, fr | — | ClientQuote, Unsubscribe |
| Unsubscribe `Unsubscribe` | `/unsubscribe` | 390×844 | state: choose, done, resubscribed | built-in switch | — |
| Website lead form `WidgetForm` | `/widget-form` | 390×1100 | step: form, photos, contact, working, done, unavailable | built-in switch | — |

## Getting in

| Screen | Route | Frame | States | French | Goes to |
|---|---|---|---|---|---|
| Choose company `CompanyPicker` | `/company-picker` | 390×844 | state: default, loading, opening, removed | board | JoinCode, SignIn |
| Your first quote `FirstQuote` | `/first-quote` | 390×844 | step: describe, check, send, done | board | QuoteEditor, SmartHome |
| Reset password `ForgotPassword` | `/forgot-password` | 390×844 | step: request, requestOffline, sent, newPassword, linkExpired, done | board | SetSecurity, SignIn, SmartHome |
| Pending invitations `Invites` | `/invites` | 390×844 | state: single, multiple, picker, wrongAccount, expired | board | ForemanHome, JoinCode, Onboarding, SignIn, SmartHome |
| Join with a code `JoinCode` | `/join-code` | 390×844 | state: empty, typing, invalid, crew, foreman | board | CrewNow, SignIn, SignUp, Welcome |
| Set up `Onboarding` | `/onboarding` | 390×844 | step: 1, 2, 3 | board | SmartHome, Verify |
| Sign in `SignIn` | `/sign-in` | 390×844 | state: default, wrong, unverified, offline, expired, cancelled | board | ForgotPassword, JoinCode, SignUp, Verify, Welcome |
| Create account `SignUp` | `/sign-up` | 390×844 | state: default, emailTaken, weakPassword, closed | board | SignIn, Verify, Welcome |
| Two-step check `TwoStep` | `/two-step` | 390×844 | state: default, wrong, locked, backup, verified | board | SignIn, SmartHome |
| Verify email `Verify` | `/verify` | 390×844 | state: empty, typing, wrong, locked, verified | board | Onboarding, SignIn, Welcome |
| Welcome `Welcome` | `/welcome` | 390×844 | — | board | JoinCode, SignIn, SignUp |

## Menu and settings

| Screen | Route | Frame | States | French | Goes to |
|---|---|---|---|---|---|
| Send feedback `Feedback` | `/feedback` | 390×844 | state: compose, sending, sent, offline | board | Job |
| Help `HelpCentre` | `/help-centre` | 390×2610 | state: default, search, noresults, offline | board | Feedback, Menu, VideoPlayer |
| Menu `Menu` | `/menu` | 390×844 | — | board | Analytics, Archive, AssistantProposals, Books, Compliance, Contracts, CrewMap, Documents, Feedback, Group, HelpCentre, Imports, Integrations, Inventory, Invoice |
| Notifications `Notifications` | `/notifications` | 390×844 | state: list, optin | board | Contract, Invoice, Job, Quote, SmartHome |
| Profile `Profile` | `/profile` | 390×1640 | state: default, offline | built-in switch | Menu, Notifications, SetSecurity, SignIn |
| Search `Search` | `/search` | 390×844 | — | board | Client, Invoice, Job, Menu, Notifications, Quote, Settings, SmartHome, Team |
| Settings `Settings` | `/settings` | 390×2000 | — | board | AssistantPermissions, CustomizeHome, HelpCentre, Integrations, Menu, MessageTemplates, SetCompany, SetInvoices, SetMessaging, SetPlan, SetQuotes, SetRoles, SetS |
| Teammate `Teammate` | `/teammate` | 390×1860 | state: default, readonly, deactivated, nolink | board | Compliance, CrewHours, Job, Team |
| Video player `VideoPlayer` | `/video-player` | 390×844 | video: quotes, overview; state: playing, paused, buffering, offline | board | NewQuote, Quotes, SignUp, Welcome |
| What’s new `WhatsNew` | `/whats-new` | 390×844 | — | board | HelpCentre, SmartHome |

## Settings pages

| Screen | Route | Frame | States | French | Goes to |
|---|---|---|---|---|---|
| QuickBooks Online `Integration` | `/integration` | 390×2060 | state: connected, error, notConnected | board | Integrations |
| Connected apps `Integrations` | `/integrations` | 390×844 | state: default, firstTime, readOnly | board | Imports, Integration, Settings |
| Message templates `MessageTemplates` | `/message-templates` | 390×1720 | state: default, offline, readOnly, locked | built-in switch | SetMessaging |
| Company details `SetCompany` | `/set-company` | 390×1540 | state: default, unsaved, readOnly | board | Settings |
| Invoices and payments `SetInvoices` | `/set-invoices` | 390×1960 | state: default, stripeNotConnected, readOnly | board | Integration, Settings |
| SMS and WhatsApp `SetMessaging` | `/set-messaging` | 390×2300 | state: default, whatsappNotConnected, textsUsedUp | board | Settings |
| Plan and billing `SetPlan` | `/set-plan` | 390×1720 | state: default, paymentFailed, downgraded, member | board | Settings |
| Quotes and follow-ups `SetQuotes` | `/set-quotes` | 390×1680 | state: default, readOnly | board | Settings |
| Roles `SetRoles` | `/set-roles` | 390×1720 | state: default, readOnly, locked | board | CustomizeHome, RoleHomes, SetPlan, Settings |
| Sign-in and security `SetSecurity` | `/set-security` | 390×1880 | state: default, twoStepOff, deleteScheduled | board | ForgotPassword, Settings, TwoStep |
| Taxes `SetTaxes` | `/set-taxes` | 390×1720 | state: default, readOnly | board | Books, Client, Settings |
| Website widget `SetWidget` | `/set-widget` | 390×2330 | state: default, notInstalled | board | Leads, Settings |

## Assistant

| Screen | Route | Frame | States | French | Goes to |
|---|---|---|---|---|---|
| Assistant · activity `AssistantActivity` | `/assistant-activity` | 390×2000 | state: default, empty, offline | board | AssistantPermissions, AssistantProposals, Invoice, SmartHome |
| Assistant · permissions `AssistantPermissions` | `/assistant-permissions` | 390×2090 | state: default, readonly, offline | board | AssistantActivity, AssistantProposals, Settings, SmartHome |
| Assistant · proposals `AssistantProposals` | `/assistant-proposals` | 390×2200 | state: default, empty, offline, readonly, locked | board | AssistantActivity, AssistantPermissions, Invoice, Schedule, SetPlan, SmartHome, Supplier |

## Insights and workspace

| Screen | Route | Frame | States | French | Goes to |
|---|---|---|---|---|---|
| Analytics `Analytics` | `/analytics` | 390×3180 | state: default, loading, locked | board | Client, Clients, Invoice, Job, Jobs, Leads, Menu, Quotes, Team |
| Archive `Archive` | `/archive` | 390×844 | state: default, empty | board | Menu, Quotes |
| Documents `Documents` | `/documents` | 390×1640 | state: default, empty | board | Job, Menu, PriceBook |
| Imports `Imports` | `/imports` | 390×1200 | step: source, mapping, importing, done | board | Clients, Menu |
| Price book `PriceBook` | `/price-book` | 390×844 | state: default, empty | board | Imports, Menu |

## System

| Screen | Route | Frame | States | French | Goes to |
|---|---|---|---|---|---|
| Components `Components` | `/components` | 390×8230 | — | — | Quote, Quotes |
| Subscription payment `Dunning` | `/dunning` | 390×2240 | role: owner, teammate | board | SetPlan, Teammate |
| System states `SystemStates` | `/system-states` | 390×5140 | — | board | — |
| Tablet · two columns `Tablet` | `/tablet` | 1366×1024 | — | board | Client, Clients, Invoices, Job, Jobs, Menu, NewQuote, Profile, Quotes, Schedule, SmartHome |
