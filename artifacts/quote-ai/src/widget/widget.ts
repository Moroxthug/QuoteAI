// Phase 92 (docs/LAUNCH-FINISH-PLAN.md) — the embeddable quote-request widget.
//
// Contractors paste the snippet from Settings → Widget on their own site:
//
//   <div id="quoteai-widget"><a href="https://quoteai.ca">…</a></div>
//   <script src="https://quoteai.ca/widget.js" data-api-key="…" async></script>
//
// This file is that /widget.js. It is deliberately one self-contained file
// with no imports and no React: vite.config.ts compiles it on its own to an
// IIFE (dev: served at /widget.js; build: emitted as dist/public/widget.js).
//
// - Everything renders inside a shadow root on the container, so the host
//   site's CSS cannot break the form and ours cannot leak onto their page.
//   Styles go in through adoptedStyleSheets (not subject to the host's CSP
//   style-src) with a <style> fallback.
// - It talks only to the origin it was loaded from (/api/public/config and
//   POST /api/public/quotes, both CORS-open and rate-limited server-side).
// - No innerHTML anywhere: company names, error text and the visitor's own
//   words all go through textContent.
// - A bad, revoked or missing key shows a neutral "not available" box, never
//   an error dump.
//
// Optional attributes on the script tag:
//   data-lang="fr|en"      default: the page's <html lang>, else English
//   data-target="#id"      default: #quoteai-widget (created after the script if missing)
//   data-color="#101031"   accent colour for buttons and focus rings
//
// The container receives a `quoteai:submitted` CustomEvent (bubbles) with
// { quoteId, estimate } after a successful request, for site analytics.

(() => {
  type Lang = "en" | "fr";
  type Config = { companyName: string; phone: string | null; email: string | null; supportedCategories: string[] };
  type Estimate = { min: number; max: number };

  const PROVINCES: [string, string, string][] = [
    ["AB", "Alberta", "Alberta"],
    ["BC", "British Columbia", "Colombie-Britannique"],
    ["MB", "Manitoba", "Manitoba"],
    ["NB", "New Brunswick", "Nouveau-Brunswick"],
    ["NL", "Newfoundland and Labrador", "Terre-Neuve-et-Labrador"],
    ["NS", "Nova Scotia", "Nouvelle-Écosse"],
    ["NT", "Northwest Territories", "Territoires du Nord-Ouest"],
    ["NU", "Nunavut", "Nunavut"],
    ["ON", "Ontario", "Ontario"],
    ["PE", "Prince Edward Island", "Île-du-Prince-Édouard"],
    ["QC", "Quebec", "Québec"],
    ["SK", "Saskatchewan", "Saskatchewan"],
    ["YT", "Yukon", "Yukon"],
  ];

  const COPY = {
    en: {
      loading: "Loading the quote form…",
      unavailable: "Online quotes are not available right now.",
      unavailableHint: "Please contact the company directly.",
      title: (c: string) => `Get an estimate from ${c}`,
      intro: "Describe the work and get a price range in about a minute. No obligation.",
      step: (n: number) => `Step ${n} of 2`,
      typeOfWork: "Type of work",
      typeOfWorkAny: "Choose (optional)",
      description: "Describe the work",
      descriptionHint: "What needs doing, the size of the space, materials you have in mind.",
      area: "Approximate area in sq ft (optional)",
      city: "City",
      province: "Province or territory",
      provinceAny: "Choose",
      postalCode: "Postal code (optional)",
      next: "Next",
      back: "Back",
      name: "Your name",
      email: "Email",
      phone: "Phone",
      contactHint: "An email or a phone number, so they can reach you.",
      consent: (c: string) => `I agree that ${c} may contact me about this request.`,
      privacy: (c: string) => `Your details go to ${c} only, to prepare your quote.`,
      privacyLink: "Privacy",
      submit: "Get my estimate",
      submitting: "Preparing your estimate. This can take up to half a minute…",
      thanks: (n: string) => `Thank you, ${n}`,
      rangeLabel: "Estimated range, taxes included",
      rangeNote: (c: string) => `An automatic estimate from your description. ${c} will confirm the final price, usually after a visit.`,
      noRange: (c: string) => `${c} has your request and will send you a quote.`,
      emailSent: (e: string) => `A confirmation was sent to ${e}.`,
      callUs: "Questions? Call",
      again: "Start another request",
      poweredBy: "Quotes by QuoteAI",
      errors: {
        description: "Describe the work in a sentence or two (at least 15 characters).",
        city: "Enter the city where the work is.",
        province: "Choose a province or territory.",
        name: "Enter your name.",
        contact: "Enter an email or a phone number.",
        email: "This email address doesn't look right.",
        phone: "This phone number doesn't look right.",
        consent: "Tick the box so they can contact you.",
        rateLimited: "Too many requests from this connection. Please try again in a little while.",
        generic: "Something went wrong and your request was not sent. Please try again.",
        timeout: "This is taking too long. Please try again.",
      },
    },
    fr: {
      loading: "Chargement du formulaire…",
      unavailable: "Les soumissions en ligne ne sont pas disponibles pour le moment.",
      unavailableHint: "Veuillez communiquer directement avec l'entreprise.",
      title: (c: string) => `Obtenez une estimation de ${c}`,
      intro: "Décrivez les travaux et obtenez une fourchette de prix en une minute environ. Sans engagement.",
      step: (n: number) => `Étape ${n} sur 2`,
      typeOfWork: "Type de travaux",
      typeOfWorkAny: "Choisir (facultatif)",
      description: "Décrivez les travaux",
      descriptionHint: "Ce qu'il faut faire, la taille de l'espace, les matériaux envisagés.",
      area: "Superficie approximative en pi² (facultatif)",
      city: "Ville",
      province: "Province ou territoire",
      provinceAny: "Choisir",
      postalCode: "Code postal (facultatif)",
      next: "Suivant",
      back: "Retour",
      name: "Votre nom",
      email: "Courriel",
      phone: "Téléphone",
      contactHint: "Un courriel ou un numéro de téléphone, pour qu'on puisse vous joindre.",
      consent: (c: string) => `J'accepte que ${c} communique avec moi au sujet de cette demande.`,
      privacy: (c: string) => `Vos coordonnées sont transmises à ${c} seulement, pour préparer votre soumission.`,
      privacyLink: "Confidentialité",
      submit: "Obtenir mon estimation",
      submitting: "Préparation de votre estimation. Cela peut prendre jusqu'à une demi-minute…",
      thanks: (n: string) => `Merci, ${n}`,
      rangeLabel: "Fourchette estimée, taxes incluses",
      rangeNote: (c: string) => `Estimation automatique à partir de votre description. ${c} confirmera le prix final, habituellement après une visite.`,
      noRange: (c: string) => `${c} a bien reçu votre demande et vous enverra une soumission.`,
      emailSent: (e: string) => `Une confirmation a été envoyée à ${e}.`,
      callUs: "Des questions? Appelez le",
      again: "Faire une autre demande",
      poweredBy: "Soumissions par QuoteAI",
      errors: {
        description: "Décrivez les travaux en une phrase ou deux (au moins 15 caractères).",
        city: "Indiquez la ville des travaux.",
        province: "Choisissez une province ou un territoire.",
        name: "Indiquez votre nom.",
        contact: "Indiquez un courriel ou un numéro de téléphone.",
        email: "Cette adresse courriel semble incorrecte.",
        phone: "Ce numéro de téléphone semble incorrect.",
        consent: "Cochez la case pour qu'on puisse vous joindre.",
        rateLimited: "Trop de demandes depuis cette connexion. Veuillez réessayer un peu plus tard.",
        generic: "Un problème est survenu et votre demande n'a pas été envoyée. Veuillez réessayer.",
        timeout: "Cela prend trop de temps. Veuillez réessayer.",
      },
    },
  } as const;

  type Copy = (typeof COPY)[Lang];

  const CSS = `
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }
.qa { --accent: #101031; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #393a3d; background: #fff; border: 1px solid #dfe1e6; border-radius: 14px; padding: 24px; max-width: 560px; margin: 0 auto; text-align: left; }
.qa [hidden] { display: none !important; }
h2 { font-size: 20px; line-height: 1.25; margin: 0 0 6px; color: #101031; font-weight: 700; letter-spacing: -0.01em; }
h2:focus { outline: none; }
p { margin: 0 0 12px; }
.muted { color: #5f6168; font-size: 14px; }
.step { font-size: 13px; font-weight: 600; color: #5f6168; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 4px; }
.field { margin: 0 0 16px; }
label, .label { display: block; font-size: 14px; font-weight: 600; color: #101031; margin: 0 0 6px; }
.hint { display: block; font-size: 13px; color: #5f6168; margin: -2px 0 6px; font-weight: 400; }
input[type=text], input[type=email], input[type=tel], input[type=number], select, textarea { display: block; width: 100%; font: inherit; font-size: 16px; color: #101031; background: #fff; border: 1px solid #b9bcc4; border-radius: 10px; padding: 10px 12px; min-height: 44px; }
textarea { min-height: 112px; resize: vertical; }
input:focus-visible, select:focus-visible, textarea:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
[aria-invalid=true] { border-color: #bf3d09; }
.err { display: block; color: #bf3d09; font-size: 13px; margin-top: 6px; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 480px) { .qa { padding: 18px; border-radius: 12px; } .row { grid-template-columns: 1fr; gap: 0; } }
.check { display: flex; gap: 10px; align-items: flex-start; font-weight: 400; font-size: 14px; color: #393a3d; }
.check input { width: 20px; height: 20px; margin: 2px 0 0; flex: none; accent-color: var(--accent); }
.actions { display: flex; gap: 10px; align-items: center; margin-top: 20px; flex-wrap: wrap; }
button { font: inherit; font-size: 15px; font-weight: 600; border-radius: 10px; min-height: 44px; padding: 10px 18px; cursor: pointer; border: 1px solid transparent; }
.primary { background: var(--accent); color: #fff; }
.primary:hover { filter: brightness(1.15); }
.primary[disabled] { opacity: 0.6; cursor: progress; }
.secondary { background: #fff; color: #101031; border-color: #b9bcc4; }
.box { background: #f4f5f7; border-radius: 10px; padding: 16px; margin: 16px 0; }
.range { font-size: 26px; font-weight: 700; color: #101031; letter-spacing: -0.01em; margin: 2px 0 6px; font-variant-numeric: tabular-nums; }
.status { display: flex; gap: 10px; align-items: center; font-size: 14px; color: #393a3d; margin-top: 14px; }
.spinner { width: 18px; height: 18px; border-radius: 50%; border: 2px solid #dfe1e6; border-top-color: var(--accent); animation: spin 0.8s linear infinite; flex: none; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spinner { animation: none; border-top-color: #dfe1e6; } }
.alert { border-left: 3px solid #bf3d09; background: #fdeee5; color: #7a2606; padding: 10px 12px; border-radius: 6px; font-size: 14px; margin-top: 14px; }
.foot { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 20px; padding-top: 14px; border-top: 1px solid #eceef2; font-size: 12px; color: #5f6168; }
.foot a { color: #5f6168; }
a { color: var(--accent); }
.m0 { margin: 0; }
.hp { position: absolute !important; left: -10000px !important; width: 1px; height: 1px; overflow: hidden; }
.sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
`;

  // ── Where we were loaded from and where to draw ─────────────────────────────

  const script =
    (document.currentScript as HTMLScriptElement | null) ??
    Array.from(document.querySelectorAll<HTMLScriptElement>("script[data-api-key]")).find((s) => /\/widget\.js(\?|$)/.test(s.src)) ??
    null;
  if (!script || !script.src) return;

  const origin = new URL(script.src, location.href).origin;
  const apiKey = (script.dataset.apiKey ?? "").trim();
  const attrLang = (script.dataset.lang ?? document.documentElement.lang ?? "").toLowerCase();
  const lang: Lang = attrLang.startsWith("fr") ? "fr" : "en";
  const t: Copy = COPY[lang];
  const accent = /^#[0-9a-f]{3,8}$/i.test(script.dataset.color ?? "") ? script.dataset.color! : "#101031";
  const money = new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

  let host = document.querySelector<HTMLElement>(script.dataset.target || "#quoteai-widget");
  if (!host) {
    host = document.createElement("div");
    host.id = "quoteai-widget";
    script.insertAdjacentElement("afterend", host);
  }
  // A snippet pasted twice (or a page that re-runs scripts) must not draw two forms.
  if (host.shadowRoot || host.dataset.quoteaiMounted) return;
  host.dataset.quoteaiMounted = "1";

  const root = host.attachShadow({ mode: "open" });
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
    root.adoptedStyleSheets = [sheet];
  } catch {
    const style = document.createElement("style");
    style.textContent = CSS;
    root.appendChild(style);
  }

  // ── Tiny DOM helper (text only, never HTML) ─────────────────────────────────

  type Attrs = Record<string, string | boolean | undefined>;
  function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Node | string | null | false)[]): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === false) continue;
      if (k === "class") el.className = String(v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children) if (c !== null && c !== false) el.append(c);
    return el;
  }

  let uid = 0;
  const id = (name: string) => `qa-${name}-${++uid}`;

  const shell = h("div", { class: "qa", lang: lang === "fr" ? "fr-CA" : "en-CA" });
  shell.style.setProperty("--accent", accent);
  root.appendChild(shell);

  function render(...nodes: (Node | null)[]) {
    shell.replaceChildren(...nodes.filter((n): n is Node => n !== null));
  }

  function focusHeading() {
    const heading = shell.querySelector<HTMLElement>("h2");
    heading?.focus({ preventScroll: true });
    // Only scroll when the top of the widget is off-screen: a contractor's page shouldn't jump for nothing.
    const r = host!.getBoundingClientRect();
    if (r.top < 0 || r.top > window.innerHeight) host!.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function footer(company: string | null): HTMLElement {
    return h(
      "div",
      { class: "foot" },
      h("span", {}, company ? t.privacy(company) : ""),
      h(
        "span",
        {},
        h("a", { href: `${origin}/privacy-policy`, target: "_blank", rel: "noopener" }, t.privacyLink),
        " · ",
        h("a", { href: "https://quoteai.ca", target: "_blank", rel: "noopener" }, t.poweredBy),
      ),
    );
  }

  function unavailable() {
    render(h("h2", { tabindex: "-1" }, t.unavailable), h("p", { class: "muted" }, t.unavailableHint));
  }

  // ── Form fields ─────────────────────────────────────────────────────────────

  type Field = { wrap: HTMLElement; input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement; setError: (msg: string | null) => void };

  function field(label: string, input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, hint?: string): Field {
    const inputId = id("f");
    input.id = inputId;
    const errId = `${inputId}-err`;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const err = h("span", { class: "err", id: errId, hidden: true });
    if (hintId) input.setAttribute("aria-describedby", hintId);
    const wrap = h("div", { class: "field" }, h("label", { for: inputId }, label), hint ? h("span", { class: "hint", id: hintId }, hint) : null, input, err);
    return {
      wrap,
      input,
      setError(msg) {
        if (msg) {
          err.textContent = msg;
          err.hidden = false;
          input.setAttribute("aria-invalid", "true");
          input.setAttribute("aria-describedby", [hintId, errId].filter(Boolean).join(" "));
        } else {
          err.textContent = "";
          err.hidden = true;
          input.removeAttribute("aria-invalid");
          if (hintId) input.setAttribute("aria-describedby", hintId);
          else input.removeAttribute("aria-describedby");
        }
      },
    };
  }

  function select(options: [string, string][], placeholder: string): HTMLSelectElement {
    const s = h("select", {}, h("option", { value: "" }, placeholder));
    for (const [value, label] of options) s.append(h("option", { value }, label));
    return s;
  }

  // State that survives Back / Next.
  const state = { category: "", description: "", area: "", city: "", province: "", postalCode: "", name: "", email: "", phone: "", consent: false };

  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const digits = (s: string) => s.replace(/\D/g, "");

  // ── Step 1: the work ────────────────────────────────────────────────────────

  function stepOne(config: Config) {
    const categories = config.supportedCategories.filter(Boolean).slice(0, 20);
    const category = categories.length > 0 ? field(t.typeOfWork, select(categories.map((c) => [c, c]), t.typeOfWorkAny)) : null;
    const description = field(t.description, h("textarea", { maxlength: "4000", required: true }), t.descriptionHint);
    const area = field(t.area, h("input", { type: "number", inputmode: "numeric", min: "0", step: "1" }));
    const city = field(t.city, h("input", { type: "text", autocomplete: "address-level2", required: true, maxlength: "80" }));
    const province = field(t.province, select(PROVINCES.map(([code, en, fr]) => [code, lang === "fr" ? fr : en]), t.provinceAny));
    province.input.setAttribute("required", "");
    province.input.setAttribute("autocomplete", "address-level1");
    const postal = field(t.postalCode, h("input", { type: "text", autocomplete: "postal-code", maxlength: "7" }));

    if (category) category.input.value = state.category;
    description.input.value = state.description;
    area.input.value = state.area;
    city.input.value = state.city;
    province.input.value = state.province;
    postal.input.value = state.postalCode;

    const next = h("button", { type: "submit", class: "primary" }, t.next);
    const form = h(
      "form",
      { novalidate: true },
      category?.wrap ?? null,
      description.wrap,
      area.wrap,
      h("div", { class: "row" }, city.wrap, province.wrap),
      postal.wrap,
      h("div", { class: "actions" }, next),
    );
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      state.category = category?.input.value ?? "";
      state.description = description.input.value.trim();
      state.area = area.input.value.trim();
      state.city = city.input.value.trim();
      state.province = province.input.value;
      state.postalCode = postal.input.value.trim().toUpperCase();
      const checks: [Field, string | null][] = [
        [description, state.description.length >= 15 ? null : t.errors.description],
        [city, state.city ? null : t.errors.city],
        [province, state.province ? null : t.errors.province],
      ];
      let first: Field | null = null;
      for (const [f, msg] of checks) {
        f.setError(msg);
        if (msg && !first) first = f;
      }
      if (first) {
        first.input.focus();
        return;
      }
      stepTwo(config);
    });

    render(
      h("p", { class: "step" }, t.step(1)),
      h("h2", { tabindex: "-1" }, t.title(config.companyName)),
      h("p", { class: "muted" }, t.intro),
      form,
      footer(config.companyName),
    );
  }

  // ── Step 2: who to contact, then send ───────────────────────────────────────

  function stepTwo(config: Config, errorMessage?: string) {
    const name = field(t.name, h("input", { type: "text", autocomplete: "name", required: true, maxlength: "120" }));
    const email = field(t.email, h("input", { type: "email", autocomplete: "email", maxlength: "200" }));
    const phone = field(t.phone, h("input", { type: "tel", autocomplete: "tel", maxlength: "30" }));
    name.input.value = state.name;
    email.input.value = state.email;
    phone.input.value = state.phone;

    const consentId = id("consent");
    const consentErrId = `${consentId}-err`;
    const consent = h("input", { type: "checkbox", id: consentId, required: true });
    consent.checked = state.consent;
    const consentErr = h("span", { class: "err", id: consentErrId, hidden: true });

    // Honeypot: off-screen, out of the tab order and hidden from assistive tech; people never fill it.
    const trap = h("input", { type: "text", name: "website", tabindex: "-1", autocomplete: "off", "aria-hidden": "true" });

    const status = h("div", { class: "status", role: "status", "aria-live": "polite" });
    const alert = h("div", { class: "alert", role: "alert", hidden: !errorMessage }, errorMessage ?? "");
    const back = h("button", { type: "button", class: "secondary" }, t.back);
    const submit = h("button", { type: "submit", class: "primary" }, t.submit);

    const form = h(
      "form",
      { novalidate: true },
      name.wrap,
      h("p", { class: "hint" }, t.contactHint),
      h("div", { class: "row" }, email.wrap, phone.wrap),
      h("div", { class: "field" }, h("label", { class: "check", for: consentId }, consent, h("span", {}, t.consent(config.companyName))), consentErr),
      h("div", { class: "hp", "aria-hidden": "true" }, trap),
      h("div", { class: "actions" }, back, submit),
      status,
      alert,
    );

    back.addEventListener("click", () => {
      state.name = name.input.value.trim();
      state.email = email.input.value.trim();
      state.phone = phone.input.value.trim();
      state.consent = consent.checked;
      stepOne(config);
      focusHeading();
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (submit.disabled) return;
      state.name = name.input.value.trim();
      state.email = email.input.value.trim();
      state.phone = phone.input.value.trim();
      state.consent = consent.checked;

      const emailBad = state.email !== "" && !EMAIL.test(state.email);
      const phoneBad = state.phone !== "" && (digits(state.phone).length < 10 || digits(state.phone).length > 15);
      const neither = state.email === "" && state.phone === "";
      name.setError(state.name ? null : t.errors.name);
      email.setError(neither ? t.errors.contact : emailBad ? t.errors.email : null);
      phone.setError(phoneBad ? t.errors.phone : null);
      if (state.consent) {
        consentErr.hidden = true;
        consent.removeAttribute("aria-invalid");
        consent.removeAttribute("aria-describedby");
      } else {
        consentErr.textContent = t.errors.consent;
        consentErr.hidden = false;
        consent.setAttribute("aria-invalid", "true");
        consent.setAttribute("aria-describedby", consentErrId);
      }
      const firstBad = [!state.name && name.input, (neither || emailBad) && email.input, phoneBad && phone.input, !state.consent && consent].find(Boolean);
      if (firstBad) {
        (firstBad as HTMLElement).focus();
        return;
      }

      submit.disabled = true;
      back.disabled = true;
      alert.hidden = true;
      status.replaceChildren(h("span", { class: "spinner", "aria-hidden": "true" }), h("span", {}, t.submitting));

      const rawInput = [state.category ? `${t.typeOfWork}: ${state.category}` : "", state.description].filter(Boolean).join("\n");
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 75_000);
      try {
        const res = await fetch(`${origin}/api/public/quotes`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": apiKey },
          body: JSON.stringify({
            rawInput,
            lang,
            website: trap.value,
            misure: state.area ? { [lang === "fr" ? "Superficie (pi²)" : "Area (sq ft)"]: state.area } : undefined,
            clientData: {
              nome: state.name,
              email: state.email || undefined,
              phone: state.phone || undefined,
              city: state.city,
              province: state.province,
              postalCode: state.postalCode || undefined,
            },
          }),
          signal: controller.signal,
        });
        if (res.status === 401 || res.status === 403) {
          unavailable();
          focusHeading();
          return;
        }
        if (!res.ok) {
          stepTwo(config, res.status === 429 ? t.errors.rateLimited : t.errors.generic);
          return;
        }
        const body = (await res.json()) as { quoteId?: string | null; estimate?: Estimate | null };
        const estimate = body.estimate && Number.isFinite(body.estimate.min) && Number.isFinite(body.estimate.max) ? body.estimate : null;
        host!.dispatchEvent(new CustomEvent("quoteai:submitted", { bubbles: true, composed: true, detail: { quoteId: body.quoteId ?? null, estimate } }));
        done(config, estimate);
      } catch (err) {
        stepTwo(config, (err as Error)?.name === "AbortError" ? t.errors.timeout : t.errors.generic);
      } finally {
        window.clearTimeout(timer);
      }
    });

    render(
      h("p", { class: "step" }, t.step(2)),
      h("h2", { tabindex: "-1" }, t.title(config.companyName)),
      form,
      footer(config.companyName),
    );
    alert.tabIndex = -1;
    // A failed send re-draws this step with the reason: put the reader on it.
    if (errorMessage) alert.focus();
  }

  // ── Done ────────────────────────────────────────────────────────────────────

  function done(config: Config, estimate: Estimate | null) {
    const again = h("button", { type: "button", class: "secondary" }, t.again);
    again.addEventListener("click", () => {
      state.category = "";
      state.description = "";
      state.area = "";
      stepOne(config);
      focusHeading();
    });
    const phoneDigits = config.phone ? digits(config.phone) : "";
    // North American numbers read as (613) 555-0100 whatever way the contractor typed them; anything else as typed.
    const nanp = phoneDigits.length === 11 && phoneDigits.startsWith("1") ? phoneDigits.slice(1) : phoneDigits;
    const phoneLabel = nanp.length === 10 ? `(${nanp.slice(0, 3)}) ${nanp.slice(3, 6)}-${nanp.slice(6)}` : config.phone;
    render(
      h("h2", { tabindex: "-1" }, t.thanks(state.name.split(/\s+/)[0] || state.name)),
      estimate
        ? h(
            "div",
            { class: "box" },
            h("p", { class: "label" }, t.rangeLabel),
            h("p", { class: "range" }, `${money.format(estimate.min)} – ${money.format(estimate.max)}`),
            h("p", { class: "muted m0" }, t.rangeNote(config.companyName)),
          )
        : h("div", { class: "box" }, h("p", { class: "m0" }, t.noRange(config.companyName))),
      state.email ? h("p", { class: "muted" }, t.emailSent(state.email)) : null,
      config.phone && phoneDigits.length >= 10 ? h("p", { class: "muted" }, `${t.callUs} `, h("a", { href: `tel:+${phoneDigits.length === 10 ? "1" : ""}${phoneDigits}` }, phoneLabel ?? ""), ".") : null,
      h("div", { class: "actions" }, again),
      footer(config.companyName),
    );
    focusHeading();
  }

  // ── Boot ────────────────────────────────────────────────────────────────────

  render(h("div", { class: "status", role: "status" }, h("span", { class: "spinner", "aria-hidden": "true" }), h("span", {}, t.loading)));

  if (!apiKey) {
    unavailable();
    return;
  }

  fetch(`${origin}/api/public/config`, { headers: { "x-api-key": apiKey } })
    .then(async (res) => {
      if (!res.ok) return unavailable();
      const body = (await res.json()) as Partial<Config> & { success?: boolean };
      if (!body.success || !body.companyName) return unavailable();
      stepOne({
        companyName: body.companyName,
        phone: body.phone ?? null,
        email: body.email ?? null,
        supportedCategories: Array.isArray(body.supportedCategories) ? body.supportedCategories.filter((c): c is string => typeof c === "string") : [],
      });
    })
    .catch(() => unavailable());
})();
