# QuoteAI — The assistant you talk to (Phases 132-141)

Written 2026-09-27. Turns the existing assistant (a text chat on the job page and `/dashboard/assistant`) into one assistant for the whole app: open it from anywhere, talk or type, it talks back, and it can do the work — brief you on the day, send a quote or invoice, text a client, change a job, start a call — within limits the owner sets.

Design reference: `design/stitch-v2/06-voice-assistant-calm.png` (the conversation screen) and `design/stitch-v2/07-today-calm.png` (the assistant row on Today). The original Stitch concepts are in `design/stitch/`; the design system is `design/stitch-export/.../field_architecture/DESIGN.md`.

Same conventions as every plan: one phase per conversation, in order, one commit per phase pushed to `main`, a build-log entry at the bottom, a runbook section when behaviour changes. Every phase that changes a screen passes the phone contact sheets (MOBILE-AND-APP-PLAN §A.4).

**Ordering.** 132-134 need nothing from other plans and can run any time. 135 (the voice screen) should land after Phase 104's Today (done) and before the app mockups are frozen in Phase 114, so the assistant is in the approved app design. 139 (calling bridge) and 141 (hands-free) are optional and can wait until after launch.

---

## Status

| Phase | Title | State |
|---|---|---|
| 132 | Streaming turns and one assistant everywhere | not started |
| 133 | Permissions you control: can do / ask me first / never | not started |
| 134 | New tools: brief me, quotes, contracts, messages, clients, navigation | not started |
| 135 | The assistant screen (text first) | not started |
| 136 | It talks: real-time voice | not started |
| 137 | Confirm by voice, interrupt, undo | not started |
| 138 | Calls I: "Call Mike" opens your dialer | not started |
| 139 | Calls II: the bridged call and the call note (optional) | not started |
| 140 | Trust: evals, cost limits, audit screen, French | not started |
| 141 | Hands-free in the truck (optional, app only) | not started |

---

## 1. What exists today (2026-09-27)

| Piece | Where | State |
|---|---|---|
| Model + loop | `artifacts/api-server/src/assistant/service.ts` | OpenAI `gpt-4o`, Chat Completions + function calling, 6 tool rounds, 40 messages of history, **no streaming** |
| Read tools (7) | `assistant/tools.ts` | job summary, jobs, costs, invoices, time entries, schedule risks, company overview |
| Proposal tools (8) | `assistant/tools.ts`, `assistant/apply.ts` | cost, milestone, task, invoice draft, **send invoice**, payment, change order, job note — each saved as a pending proposal the user confirms; runs through the normal services; audited with `actorType: "ai"` |
| Access | `routes/assistant.ts`, `lib/permissions` | plan feature `assistant` (Business/Elite); `jobs:view` to chat, `jobs:edit` to confirm, `invoicing:edit` / `jobs:full` per action; 120 turns/hour |
| Voice in | `hooks/use-voice-input.ts`, `routes/speech.ts` | MediaRecorder → Whisper (`whisper-large-v3-turbo`); also on the job page's voice actions and WhatsApp voice notes |
| Voice out | — | **none** |
| Sending that exists but the assistant can't reach | `routes/quotes.ts` send-pdf-email, `contracts/service.ts` send, `routes/leads.ts` send, `lib/sms.ts` `sendSms`, `lib/jobMessaging.ts`, `lib/connectedEmailSend.ts` | services exist; no assistant tools |
| Calling | `today.tsx`, `worker-today.tsx`, `me.tsx` | `tel:` links only |
| Today data | `routes/today.ts`, `today/service.ts` | `/today/needs-you` + `/today/stats`, role-filtered |

The safety model (propose → confirm → run through the same services → audit) is right and stays. Everything below extends it.

## 2. Principles

1. **One assistant, everywhere.** A single entry point — the violet mic on Today and in the header — opens the same conversation from any screen. It knows where you are ("this job", "this quote") without being told.
2. **Talk or type, same conversation.** Switching between voice and keyboard never loses context.
3. **It does work, not just answers.** Every answer that implies an action offers the action.
4. **Nothing leaves the building without you — unless you said so.** Anything that sends money, messages a client, or signs something asks first by default. The owner can loosen that per action, never beyond the user's role.
5. **Calm.** No orb, no glow. A transcript, a quiet waveform, what it is doing ("Looked up Today · Found INV-1042"), and a card for what it wants to do.
6. **Every action is visible and reversible where possible.** Audit trail, an undo window for the reversible ones.

## 3. Decisions to make (recorded here once made)

| # | Decision | Options | Recommendation |
|---|---|---|---|
| V-1 | Voice engine | (a) OpenAI Realtime API — speech-to-speech, one model, lowest latency, interruptible, same function calling; (b) pipeline — Whisper (have it) → text model streaming → TTS; cheaper, ~1.5-3 s slower, clunkier interruptions | **(a) Realtime** for the conversation screen; keep (b) as the fallback and for one-shot dictation. Both call the same tools. |
| V-2 | Text model | stay on `gpt-4o` / move to the current OpenAI flagship / change provider | Stay on OpenAI for now (Realtime is OpenAI); revisit in Phase 140 with the eval set, which makes a switch measurable |
| V-3 | Which plans get voice | Business/Elite only (as the assistant today) / text assistant on Pro, voice on Business+ | **Text on Pro, voice on Business/Elite** with included minutes (V-4); the assistant is the best upgrade reason we have |
| V-4 | Voice minutes | unlimited / included minutes + soft cap / metered | **Included minutes per seat per month** (start ~300 on Business, ~1000 on Elite), a warning at 80 %, then fall back to text; real numbers from Phase 140 cost data |
| V-5 | Assistant-placed calls (the AI speaks to a customer) | never / later with disclosure + consent | **Not in this plan.** Bridged calls only (139). Revisit after legal review (CRTC ADAD rules, recording consent, provincial privacy law) |
| V-6 | Call recording / transcript for bridged calls | off / on with spoken notice | Off by default; opt-in per company with the "this call may be recorded" notice played to both sides |
| V-7 | French | at launch / later | **At launch** for text and voice (the model handles it; system prompt and tool descriptions already EN/FR); QC is a pilot province |

## 4. Permissions model (Phase 133)

Three levels per action type, set by the owner in **Settings → Assistant**, optionally tightened per role:

| Level | Meaning |
|---|---|
| **Can do it** | Runs immediately, shows a done card with **Undo** for 10 s where the action is reversible |
| **Ask me first** | Shows the confirm card; say "yes" or tap Confirm |
| **Never** | The tool is not offered to the model at all |

Defaults:

| Group | Actions | Default |
|---|---|---|
| Read | briefings, look-ups, summaries, "open the Highland job" | Can do it (always; cannot be turned off) |
| Notes & tasks | job note, task, cost entry, milestone date/status | Can do it |
| Drafts | draft a quote, invoice, change order, message | Can do it (a draft is not sent) |
| Money & customers | send quote / invoice / contract, text or email a client, record a payment, change order | **Ask me first** (floor for "send money / sign": cannot be set to Can do it) |
| Destructive | delete, void, cancel a job | **Never** by default; Ask me first at most |
| Calls | open dialer / bridged call | Ask me first |

The role matrix always wins: a foreman whose role cannot send invoices cannot do it through the assistant regardless of the setting. Enforced server-side at confirm/execute time (extend `FEATURE_FOR` / `PERMISSION_FOR` in `apply.ts`), and tools the user can never run are removed from the tool list sent to the model.

---

## Phase 132 — Streaming turns and one assistant everywhere

- Stream assistant turns (server-sent events) so text appears as it is written and tool progress shows live ("Looking up Highland Reno…").
- One conversation per user across the app, with page context passed along (current job / quote / client id and screen), replacing "per job" threads; job-scoped history still searchable.
- A global entry point: the assistant opens as a sheet from any screen (phone) or a side panel (desktop). The existing `/dashboard/assistant` page and job tab reuse the same component.
- **Done when:** a turn's first words appear in < 1.5 s on 4G; the same conversation continues from Today → a job → a quote.

## Phase 133 — Permissions you control

- `assistant_permissions` per company (+ optional per-role overrides) as in §4; Settings → Assistant page in the Phase 102 layout.
- Server: filter tools by permission and role before each model call; enforce again at execute; "Can do it" actions execute directly with an undo record.
- Audit: every AI action already writes `actorType: "ai"`; add the level it ran under.
- **Done when:** tests prove a "Never" tool is never offered, an "Ask me first" tool never executes without a confirm, and a role without `invoicing:edit` cannot send an invoice via the assistant under any setting.

## Phase 134 — New tools

| Tool | Kind | Uses |
|---|---|---|
| `brief_me` (today / this week / one job) | read | `today/service.ts` needs-you + stats, schedule risks, crew on site |
| `find` (clients, jobs, quotes, invoices by name/address/number) | read | existing search queries |
| `open_screen` | read (client-side) | navigates the app: "show me the Highland job" |
| `draft_quote` from a description | draft | the existing AI quote generator |
| `send_quote`, `send_contract`, `send_lead_reply` | send | `send-pdf-email`, `sendContractToCustomer`, leads send |
| `message_client` (SMS / WhatsApp / email) | send | `sendSms`, `lib/jobMessaging.ts`, `connectedEmailSend.ts`; respects SMS opt-out |
| `update_client` (phone, email, address, notes) | edit | clients service |
| `schedule_crew` (assign / move a visit) | edit | schedule service |
| `on_my_way` | send | `POST /jobs/:id/sms/on-my-way` |
| `call` | call | Phase 138 |

- Every tool: zod args, userId/company scoping, a one-line spoken summary for the confirm card ("Send quote Q-2024-091, $46,200, to Sarah Lin by email").
- **Done when:** each tool has a unit test and appears in the eval set (Phase 140).

## Phase 135 — The assistant screen (text first)

- Build the calm conversation screen from `design/stitch-v2/06-voice-assistant-calm.png`: transcript as text (no heavy bubbles), progress lines, action cards (Confirm / Edit, "or say yes"), suggestion chips from context, bottom bar (keyboard, violet mic, stop).
- The Today assistant row (`07-today-calm.png`): one field + mic, replacing the separate dictate box and assistant button.
- States: empty (three context suggestions), thinking, action pending, done with undo, error with retry, offline ("I'll send this when you're back online" for queued drafts only — never for sends).
- **Done when:** phone contact sheets pass; keyboard-only and screen-reader pass on the screen.

## Phase 136 — It talks: real-time voice

- OpenAI Realtime over WebRTC from the browser/app. The server mints a short-lived session token (`POST /assistant/realtime/session`) with the system prompt and the **permission-filtered** tool list; the API key never reaches the client.
- Tool calls from the realtime session are executed by our server (`POST /assistant/realtime/tool`), through the same code path as text turns — one implementation, one audit.
- Transcript of both sides saved into the same conversation, so switching to typing continues it.
- Voice choice (a calm, neutral voice; EN and FR), speaking rate setting, "text only" mode.
- Fallback to the Whisper → text → TTS pipeline when Realtime is unavailable.
- **Done when:** median time from end of speech to first audio < 1 s on Wi-Fi, < 1.8 s on 4G; minutes metered per seat (V-4).

## Phase 137 — Confirm by voice, interrupt, undo

- Barge-in: talking stops its speech immediately.
- Spoken confirmation reads the essentials back ("Send invoice 1042, seven thousand one hundred and twelve dollars, to Marcus Vance by email?") and accepts "yes / go ahead / send it" — and only a clear yes; anything else keeps it pending.
- Amounts and recipients always shown on screen too; money actions over a threshold (owner-set, default $5,000) need a tap, not just voice.
- "Undo that" within the undo window.
- **Done when:** the eval set includes ambiguous confirmations ("yeah, wait no") and none execute.

## Phase 138 — Calls I: the dialer

- `call` tool: finds the right number (client, supplier, crew, lead) and, after "Ask me first", opens the phone's dialer with it filled (`tel:`); on desktop shows the number and a QR code.
- Suppliers: a simple supplier contact list (name, company, phone, email) if one doesn't already exist, so "call Mike at Rona" resolves.
- After the call: "Want me to add a note?" → dictated note on the job.

## Phase 139 — Calls II: the bridged call (optional)

- Twilio: calls the user's phone first, then connects the other party, showing the company number as caller ID (verified). Needs a Twilio voice number per company (or shared with verified caller ID).
- Optional recording + transcript (V-6), with the spoken notice, saved to the job; the assistant summarises it into a note and suggested tasks.
- **Owner items:** Twilio voice number, caller-ID verification, a recording-consent decision.

## Phase 140 — Trust: evals, cost, audit, French

- An eval set of ~150 realistic requests (EN + FR, noisy transcripts, ambiguous names, wrong-permission attempts) with expected tool calls; runs in CI on prompt or model changes; tracks accuracy, wrong-action rate (target 0), latency and cost per turn.
- Cost dashboard per company: voice minutes, tokens, $/seat; alerts in the ops channel.
- Settings → Assistant → **Activity**: every AI action, who asked, what ran, under which permission level, with undo/void links where possible.
- Prompt-injection hardening: client/lead text and email bodies are passed as data, never as instructions; tools that send are never triggered by content the assistant reads, only by the user's request.

## Phase 141 — Hands-free in the truck (optional, app only)

- After Phase 118 (native shell): a home-screen shortcut and lock-screen-safe "Hey, QuoteAI" via the phone's assistant integration (Android App Actions / iOS App Intents / Siri Shortcuts: "Brief me", "Log a cost", "Call my next client").
- Bluetooth/CarPlay audio routing; a driving mode that reads less and never shows confirm cards that need reading — money actions wait for a tap when parked.

---

## Owner items

| # | Item | When | Cost |
|---|---|---|---|
| VA-1 | Decisions V-1 … V-7 (§3) | before 133 (V-3, V-4), before 136 (V-1, V-2, V-7), before 139 (V-5, V-6) | — |
| VA-2 | OpenAI org: Realtime API access and a monthly spend limit | before 136 | usage |
| VA-3 | Pick the assistant's voice (EN and FR) from samples the assistant generates | Phase 136 | — |
| VA-4 | Twilio voice number + caller-ID verification | before 139 | ~$1-2 / month / number + per-minute |
| VA-5 | Legal read on recorded calls and AI-assisted outreach (can go in the Phase 98 legal packet) | before 139 | — |
| VA-6 | Try it for a week on real jobs and list what it got wrong (feeds the eval set) | after 137 | — |

---

## Build log

*(one entry per phase: date, built, found, deferred, verification — sheets, eval results, latency numbers)*
