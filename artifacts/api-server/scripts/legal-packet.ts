// Phase 98 (docs/LAUNCH-FINISH-PLAN.md): the legal packet for Phase 99 L-3,
// one PDF for the lawyer.
//
//   pnpm --filter @workspace/api-server ops:legal-packet [--site https://quoteai.ca] [--out docs/legal-packet/QuoteAI-legal-packet.pdf]
//
// Contents, in order:
//   1. cover: what this is, the version of each document, what is not yet decided
//   2. the questions (LAUNCH-GO-NO-GO §2, kept current here)
//   3. who receives personal information (the privacy policy's list, verbatim from the page)
//   4. how a contract is signed: the evidence each signature carries, the consent sentence
//   5. every contract template — ON, BC, AB, generic in English; QC in French and in
//      English-at-the-customer's-request — rendered by the product's own contract
//      renderer (contracts/render.ts) with sample values, the cooling-off variant on
//   6. terms of service and privacy policy, English and French, as the site serves them
//
// The contract text comes from this checkout; the legal pages come from --site (the
// live site by default — deploy first so the lawyer reads what customers read).
// Printed by the same Chrome qa:visual uses (QA_CHROME_PATH or the installed "chrome").

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { execSync } from "node:child_process";
import { chromium } from "playwright-core";
import type { ContractVariables } from "@workspace/db";
import { LEGAL_ENTITY, isLegalEntityConfigured } from "@workspace/legal-entity";
import type { Lang, TemplateKey } from "../src/contracts/templates.js";

// The contract modules import @workspace/db, whose entry creates a (lazy) pool
// and refuses to load without a URL. Nothing here queries; give it one it never uses.
process.env.DATABASE_URL ||= "postgresql://unused@127.0.0.1:1/unused";
const { defaultPaymentSchedule } = await import("@workspace/db");
const { buildContractDocument, fallbackSchedule, fallbackScope, TEMPLATE_VERSION } = await import("../src/contracts/templates.js");
const { CONTRACT_CSS, renderContractHtml } = await import("../src/contracts/render.js");

const ROOT = resolve(import.meta.dirname, "../../..");
const argv = process.argv.slice(2);
const flag = (name: string) => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
};
const SITE = (flag("--site") ?? "https://quoteai.ca").replace(/\/$/, "");
const OUT = resolve(ROOT, flag("--out") ?? "docs/legal-packet/QuoteAI-legal-packet.pdf");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const today = new Date().toISOString().slice(0, 10);
let commit = "";
try {
  commit = execSync("git rev-parse --short HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
} catch {
  /* not a checkout */
}

// ── Contract templates with sample values ────────────────────────────────────

function sample(key: TemplateKey, lang: Lang, englishRequestedInQuebec = false): ContractVariables {
  const province = key === "CA" ? "NS" : key;
  const city: Record<string, string> = { ON: "Toronto", BC: "Vancouver", AB: "Calgary", QC: "Montréal", NS: "Halifax" };
  const subtotal = 40000;
  const taxes: Record<string, Array<{ code: string; label: string; rate: number }>> = {
    ON: [{ code: "HST", label: "HST", rate: 13 }],
    BC: [{ code: "GST", label: "GST", rate: 5 }, { code: "PST", label: "PST", rate: 7 }],
    AB: [{ code: "GST", label: "GST", rate: 5 }],
    QC: [{ code: "GST", label: lang === "fr" ? "TPS" : "GST", rate: 5 }, { code: "QST", label: lang === "fr" ? "TVQ" : "QST", rate: 9.975 }],
    NS: [{ code: "HST", label: "HST", rate: 14 }],
  };
  const taxLines = taxes[province]!.map((t) => ({ ...t, amount: Math.round(subtotal * t.rate) / 100 }));
  const taxTotal = taxLines.reduce((n, t) => n + t.amount, 0);
  return {
    contractNumber: "C-2026-0001",
    quoteNumber: "Q-2026-0001",
    contractor: {
      name: "Sample Renovations",
      legalName: "Sample Renovations Inc.",
      address: "100 Example Street",
      city: city[province],
      province,
      postalCode: "A1A 1A1",
      email: "office@sample-renovations.example",
      phone: "555-0100",
      businessNumber: "123456789 RT0001",
      licenceNumber: key === "QC" ? "RBQ 1234-5678-01" : key === "AB" ? "Prepaid contractor licence 000000" : undefined,
    },
    customer: { name: "Alex Sample", address: "200 Sample Avenue", city: city[province], province, postalCode: "A1A 1A2", email: "alex@example.invalid", phone: "555-0101" },
    siteAddress: `200 Sample Avenue, ${city[province]}`,
    province,
    projectTitle: lang === "fr" ? "Rénovation de cuisine" : "Kitchen renovation",
    priceLines: [
      { label: lang === "fr" ? "Démolition et préparation" : "Demolition and preparation", amount: 6000 },
      { label: lang === "fr" ? "Plomberie et électricité" : "Plumbing and electrical", amount: 12000 },
      { label: lang === "fr" ? "Armoires et comptoirs" : "Cabinets and countertops", amount: 17000 },
      { label: lang === "fr" ? "Finition" : "Finishing", amount: 5000 },
    ],
    discount: null,
    subtotal,
    taxLines,
    taxTotal,
    total: subtotal + taxTotal,
    // The statutory holdback is on where the province has one, so the lawyer reads
    // that wording rather than the "no holdback" variant a contractor can choose.
    paymentSchedule: { ...defaultPaymentSchedule(), holdback: { enabled: ["ON", "BC", "AB"].includes(key), percent: 10 } },
    startDate: "2026-11-02",
    estimatedDurationWeeks: 6,
    warrantyMonths: 12,
    englishRequestedInQuebec,
    directAgreement: true,
  };
}

const TEMPLATES: Array<{ key: TemplateKey; lang: Lang; englishRequested?: boolean; label: string }> = [
  { key: "ON", lang: "en", label: "Ontario (English)" },
  { key: "BC", lang: "en", label: "British Columbia (English)" },
  { key: "AB", lang: "en", label: "Alberta (English)" },
  { key: "QC", lang: "fr", label: "Québec (français)" },
  { key: "QC", lang: "en", englishRequested: true, label: "Québec (English, at the customer's express request)" },
  { key: "CA", lang: "en", label: "Generic — every other province and territory (English; sample: Nova Scotia)" },
];

function contractHtml(t: (typeof TEMPLATES)[number]): string {
  const variables = sample(t.key, t.lang, t.englishRequested);
  const document = buildContractDocument({
    templateKey: t.key,
    language: t.lang,
    variables,
    scopeBody: fallbackScope(variables, t.lang),
    scheduleBody: fallbackSchedule(variables, t.lang),
  });
  return renderContractHtml({ document, variables, signers: [], status: "sent", createdAt: new Date(`${today}T12:00:00Z`) });
}

// ── Legal pages as the site serves them ──────────────────────────────────────

const PAGES = [
  { path: "/terms", label: "Terms of Service (English)" },
  { path: "/fr/conditions", label: "Conditions d'utilisation (français)" },
  { path: "/privacy-policy", label: "Privacy Policy (English)" },
  { path: "/fr/confidentialite", label: "Politique de confidentialité (français)" },
];

const executablePath = process.env.QA_CHROME_PATH;
const browser = await chromium.launch({ channel: executablePath ? undefined : "chrome", executablePath, headless: true });
try {
  const page = await browser.newPage();
  const legal: Array<{ label: string; url: string; updated: string; body: string }> = [];
  let recipients = "";
  for (const p of PAGES) {
    const url = `${SITE}${p.path}`;
    // One retry: a cold serverless start can outlast the first load.
    const res = await page.goto(url, { waitUntil: "networkidle" }).catch(() => page.goto(url, { waitUntil: "networkidle" }));
    if (!res || res.status() >= 400) throw new Error(`${url} answered ${res?.status() ?? "nothing"}`);
    const got = await page.evaluate(() => {
      const prose = document.querySelector("main .prose");
      const updated = document.querySelector("main header p")?.textContent ?? "";
      const clone = prose?.cloneNode(true) as HTMLElement | undefined;
      clone?.querySelectorAll("script, style, button, svg").forEach((n) => n.remove());
      clone?.querySelectorAll("*").forEach((n) => {
        n.removeAttribute("class");
        n.removeAttribute("style");
      });
      return { updated, body: clone?.innerHTML ?? "" };
    });
    if (!got.body) throw new Error(`${url}: no legal text found under main .prose`);
    legal.push({ label: p.label, url, ...got });
    if (p.path === "/privacy-policy") {
      // The recipient list, exactly as the English policy states it (§5).
      recipients = await page.evaluate(() => {
        const h = Array.from(document.querySelectorAll("main .prose h2")).find((x) => /who we share/i.test(x.textContent ?? ""));
        const ul = h?.parentElement?.querySelector("ul");
        const clone = ul?.cloneNode(true) as HTMLElement | undefined;
        clone?.querySelectorAll("*").forEach((n) => n.removeAttribute("class"));
        clone?.removeAttribute("class");
        return clone?.outerHTML ?? "";
      });
    }
  }

  const entity = isLegalEntityConfigured()
    ? `${esc(LEGAL_ENTITY.legalName)}${LEGAL_ENTITY.addressLines.length ? `, ${esc(LEGAL_ENTITY.addressLines.join(", "))}` : ""}`
    : `<strong>Not yet decided.</strong> The pages below name the business only as “QuoteAI”; the registered name, mailing address and tax numbers fill in everywhere at once when chosen (Phase 99 L-4).`;

  const toc = [
    "Questions for review",
    "Who receives personal information",
    "How a contract is signed",
    ...TEMPLATES.map((t) => `Contract template — ${t.label}`),
    ...legal.map((l) => l.label),
  ];

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>QuoteAI — legal review packet</title>
<style>
  @page { size: Letter; margin: 18mm 16mm 20mm; }
  body { font-family: Georgia, "Times New Roman", serif; color: #111827; font-size: 11pt; line-height: 1.45; }
  h1, h2, h3, h4, .sans { font-family: system-ui, "Segoe UI", Arial, sans-serif; color: #0f1f3d; }
  .part { break-before: page; }
  .part > h1.part-title { font-size: 18pt; border-bottom: 2px solid #0f1f3d; padding-bottom: 6px; margin-bottom: 4px; }
  .source { font-family: system-ui, sans-serif; font-size: 8.5pt; color: #6b7280; margin-bottom: 16px; }
  .cover h1 { font-size: 26pt; margin: 60px 0 6px; }
  .cover .sub { font-family: system-ui, sans-serif; color: #374151; font-size: 12pt; margin-bottom: 28px; }
  table.facts { border-collapse: collapse; width: 100%; font-family: system-ui, sans-serif; font-size: 10pt; margin: 12px 0; }
  table.facts td { border-top: 1px solid #e5e7eb; padding: 6px 8px; vertical-align: top; }
  table.facts td:first-child { width: 34%; color: #374151; font-weight: 600; }
  ol.toc { font-family: system-ui, sans-serif; font-size: 10.5pt; }
  .q h2 { font-size: 13pt; margin: 18px 0 4px; }
  .q li { margin: 3px 0; }
  .note { font-family: system-ui, sans-serif; font-size: 9.5pt; background: #f3f4f6; border-left: 3px solid #0f1f3d; padding: 8px 12px; margin: 12px 0; }
  .legal h2 { font-size: 12.5pt; margin: 16px 0 4px; }
  .legal h3 { font-size: 11pt; }
  ${CONTRACT_CSS}
  .contract h1 { font-size: 16pt; }
</style></head><body>

<section class="cover">
  <h1>Legal review packet</h1>
  <div class="sub">QuoteAI — quoting, contracts, invoicing and job management software for Canadian renovation contractors</div>
  <table class="facts">
    <tr><td>Prepared</td><td>${today}${commit ? ` · source revision ${esc(commit)}` : ""}</td></tr>
    <tr><td>Business</td><td>${entity}</td></tr>
    <tr><td>Contract templates</td><td>Version ${TEMPLATE_VERSION}. Each signed contract keeps the version it was signed under; any wording change after this review becomes version ${TEMPLATE_VERSION + 1}.</td></tr>
    <tr><td>Terms and privacy policy</td><td>As served at ${esc(SITE)} on ${today}, in English and French. Neither has been reviewed by a lawyer.</td></tr>
    <tr><td>Who uses what</td><td>The contractor (our customer) is the party to each renovation contract; QuoteAI supplies the template and the signing process. The contractor's own client signs on a web page, never with an account.</td></tr>
  </table>
  <h2 class="sans" style="font-size:12pt;margin-top:24px">Contents</h2>
  <ol class="toc">${toc.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>
</section>

<section class="part q">
  <h1 class="part-title">1. Questions for review</h1>
  <div class="source">What we would like confirmed or corrected. Each point refers to the documents later in this packet.</div>

  <h2>A. Contract templates (part 4)</h2>
  <ul>
    <li><strong>Ontario</strong> — <em>Consumer Protection Act, 2002</em>: the 10-day cancellation notice for direct agreements, its wording and placement; <em>Construction Act</em> holdback (10 %, released 60 days after substantial performance) with lien rights not waived; the WSIB clause.</li>
    <li><strong>British Columbia</strong> — <em>Business Practices and Consumer Protection Act</em> direct-sales cancellation; <em>Builders Lien Act</em> holdback and 55-day period; WorkSafeBC.</li>
    <li><strong>Alberta</strong> — <em>Consumer Protection Act</em> and the prepaid-contracting licence disclosure; <em>Prompt Payment and Construction Lien Act</em> (proper invoice, 28 days, 14-day dispute notice); WCB-Alberta.</li>
    <li><strong>Québec</strong> — Civil Code contract of enterprise (arts. 2098-2129) and legal hypothec (art. 2724 ff.); <em>Consumer Protection Act</em> itinerant-merchant cancellation; the RBQ licence number; French by default, with English only when the customer expressly asks and that request recorded; CNESST.</li>
    <li><strong>Generic template</strong> — used for every other province and territory. Is it safe to offer at all, or should contracts be limited to the four provinces above?</li>
    <li>Whether the product may describe the templates as “compliant” in marketing. Today it says they are informed by the statutes and are not legal advice.</li>
  </ul>

  <h2>B. Electronic signature (part 3)</h2>
  <ul>
    <li>Is the evidence each signature carries sufficient for a residential renovation contract under Ontario's <em>Electronic Commerce Act, 2000</em>, B.C.'s <em>Electronic Transactions Act</em>, Alberta's <em>Electronic Transactions Act</em> and Québec's <em>Act to establish a legal framework for information technology</em>?</li>
    <li>Is the consent sentence adequate, in both languages?</li>
  </ul>

  <h2>C. Invoices</h2>
  <ul>
    <li>Invoices carry sequential numbers that are never reused (a void keeps its number), the contractor's GST/HST number, the buyer's name, and each tax shown separately. Does this meet the CRA's requirements at the $30 and $150 thresholds, and Revenu Québec's for QST?</li>
  </ul>

  <h2>D. Commercial electronic messages (CASL)</h2>
  <ul>
    <li>Automated follow-ups to a contractor's leads and clients record the consent source for each person, carry an unsubscribe link honoured at once, identify the contractor, and stop on reply, acceptance or refusal. Can the contractor rely on implied consent for “asked for a quote” and on the two-year existing-customer window?</li>
    <li>Does QuoteAI, as the platform sending on the contractor's behalf, carry exposure of its own?</li>
    <li>QuoteAI's own emails (account, billing) will carry the registered name and mailing address once decided.</li>
  </ul>

  <h2>E. Terms of Service and Privacy Policy (part 5)</h2>
  <ul>
    <li>PIPEDA and Québec Law 25: the person in charge of personal information, the breach register, and the rights the product now supports — every account can export all of its data as a ZIP and delete itself (7-day grace period, then purged; encrypted backups age out within 30 days). Are the policy's statements about these accurate and sufficient?</li>
    <li>The list of recipients of personal information (part 2) — complete and correctly described?</li>
    <li>Governing law, and the limitation of liability for prices suggested by AI (the contractor always reviews and sends the quote).</li>
    <li>The French versions are translations made with the English. Terms §1 now says both versions have the same effect — is that clause right, and is either version to prevail?</li>
  </ul>

  <h2>F. Help centre</h2>
  <ul>
    <li>The in-app help guides (${esc(SITE)}/help) explain cooling-off periods, holdbacks, lien periods and CASL in plain language. Please skim them for anything that reads as legal advice.</li>
  </ul>
</section>

<section class="part">
  <h1 class="part-title">2. Who receives personal information</h1>
  <div class="source">Verbatim from the English privacy policy, §5, at ${esc(SITE)}/privacy-policy. Most of these receive data only when the contractor turns the matching feature on.</div>
  <div class="legal">${recipients || "<p><em>Could not read the list from the page — see part 5.</em></p>"}</div>
</section>

<section class="part">
  <h1 class="part-title">3. How a contract is signed</h1>
  <div class="source">From the signing flow (the /sign page and its API).</div>
  <ol>
    <li>The contractor sends the contract; the client receives a private link by email. The link is unique to that signer and expires.</li>
    <li>Before signing, the client proves control of the email address with a 6-digit code sent to it (valid 10 minutes, 5 attempts, rate-limited).</li>
    <li>The client reads the contract on the page, ticks a consent box, and signs by typing their full name or drawing a signature.</li>
    <li>Recorded with each signature: the name, the signature image or typed name, the exact consent sentence shown, the date and time, the IP address and the browser identification.</li>
    <li>When every party has signed, a final PDF is produced with an audit certificate listing those events. The SHA-256 fingerprints of the unsigned and the signed PDF are stored; the signed PDF is kept unchanged in private storage and survives archiving of the job.</li>
    <li>Both parties receive the signed PDF by email.</li>
  </ol>
  <p><strong>The consent sentence, as shown and stored:</strong></p>
  <div class="note">English: “I have read the contract, including my cancellation rights, and agree to sign it electronically. My electronic signature has the same effect as a handwritten signature.”<br><br>
  Français : « J'ai lu le contrat, y compris mon droit de résolution, et j'accepte de le signer électroniquement. Ma signature électronique a la même valeur qu'une signature manuscrite. »</div>
  <p>Changes after signing are made by change orders, each a separate signed document that amends the agreement and follows the same process.</p>
</section>

${TEMPLATES.map(
  (t, i) => `<section class="part">
  <h1 class="part-title">4.${i + 1} Contract template — ${esc(t.label)}</h1>
  <div class="source">Template ${t.key}, version ${TEMPLATE_VERSION}, rendered by the product with sample values (a $40,000 kitchen, signed at the customer's home so the cooling-off wording applies${["ON", "BC", "AB"].includes(t.key) ? ", 10 % statutory holdback retained" : ""}). “Scope” and “Schedule” are drafted per job from the accepted quote and are editable by the contractor; every other clause is fixed.</div>
  ${contractHtml(t)}
</section>`,
).join("\n")}

${legal
  .map(
    (l, i) => `<section class="part legal">
  <h1 class="part-title">5.${i + 1} ${esc(l.label)}</h1>
  <div class="source">${esc(l.url)} · ${esc(l.updated)}</div>
  ${l.body}
</section>`,
  )
  .join("\n")}

</body></html>`;

  mkdirSync(dirname(OUT), { recursive: true });
  const htmlOut = OUT.replace(/\.pdf$/, ".html");
  writeFileSync(htmlOut, html);
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({
    path: OUT,
    format: "Letter",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `<div style="font-family:system-ui,sans-serif;font-size:8px;color:#6b7280;width:100%;padding:0 16mm;display:flex;justify-content:space-between"><span>QuoteAI — legal review packet — ${today}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    margin: { top: "18mm", bottom: "20mm", left: "16mm", right: "16mm" },
  });
  console.log(`legal packet: ${relative(ROOT, OUT)} (${TEMPLATES.length} contract templates, ${legal.length} legal pages from ${SITE})`);
} finally {
  await browser.close();
}
