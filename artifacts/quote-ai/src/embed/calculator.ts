// SEO-RECOVERY-PLAN S6.3: the GST/HST and holdback calculators other sites can
// embed (an iframe of /embed/calculator.html?tool=…&lang=…). Plain DOM, no
// React and no app code beyond the tested arithmetic (lib/calculators.ts) and
// the rate table (lib/tax-profiles.ts), so the numbers match /tools exactly.
// Compiled to /embed/calculator.js by the embed plugin in vite.config.ts.
//
// It is a separate page, not a route of the app, so a framed copy can never
// navigate into the dashboard (only /embed/ may be framed: vercel.json).
import { parseAmount, salesTax, holdback } from "../lib/calculators";
import { CANADIAN_PROVINCES, PROVINCE_NAMES, TAX_PROFILES, taxComponentLabel, formatRate, type ProvinceCode } from "../lib/tax-profiles";
import { TOOL_UI } from "../data/tool-pages";

type Lang = "en" | "fr";
type Tool = "salesTax" | "holdback";

const q = new URLSearchParams(location.search);
const lang: Lang = q.get("lang") === "fr" ? "fr" : "en";
const tool: Tool = q.get("tool") === "holdback" ? "holdback" : "salesTax";
const loc = lang === "fr" ? "fr-CA" : "en-CA";
const money = (n: number) => new Intl.NumberFormat(loc, { style: "currency", currency: "CAD" }).format(n);

const TITLES: Record<Tool, Record<Lang, string>> = {
  salesTax: { en: "GST/HST, PST and QST calculator", fr: "Calculateur de TPS, TVH, TVP et TVQ" },
  holdback: { en: "Holdback calculator", fr: "Calculateur de retenue" },
};
const PATHS: Record<Tool, Record<Lang, string>> = {
  salesTax: { en: "/tools/sales-tax-calculator/", fr: "/fr/outils/calculateur-taxes-de-vente/" },
  holdback: { en: "/tools/holdback-calculator/", fr: "/fr/outils/calculateur-retenue/" },
};
const CREDIT: Record<Lang, [string, string]> = {
  en: ["Free calculator by ", ". 2026 rates; not tax advice."],
  fr: ["Calculateur gratuit de ", ". Taux 2026; pas un avis fiscal."],
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

let uid = 0;
function field(label: string, control: HTMLInputElement | HTMLSelectElement, suffix?: string): HTMLElement {
  const id = `f${++uid}`;
  control.id = id;
  const wrap = el("div", { class: "field" });
  wrap.append(el("label", { for: id }, label));
  const box = el("div", { class: "box" });
  box.append(control);
  if (suffix) box.append(el("span", { class: "suffix", "aria-hidden": "true" }, suffix));
  wrap.append(box);
  return wrap;
}

function numberInput(value: string): HTMLInputElement {
  return el("input", { type: "text", inputmode: "decimal", autocomplete: "off", value });
}

function provinceSelect(): HTMLSelectElement {
  const s = el("select");
  const sorted = [...CANADIAN_PROVINCES].sort((a, b) => PROVINCE_NAMES[a][lang].localeCompare(PROVINCE_NAMES[b][lang], loc));
  for (const p of sorted) s.append(el("option", { value: p }, PROVINCE_NAMES[p][lang]));
  s.value = lang === "fr" ? "QC" : "ON";
  return s;
}

function row(label: string, value: string, cls = "row"): HTMLElement {
  const r = el("div", { class: cls });
  r.append(el("span", {}, label), el("b", {}, value));
  return r;
}

const root = document.getElementById("calc")!;
document.documentElement.lang = lang === "fr" ? "fr-CA" : "en-CA";
document.title = `${TITLES[tool][lang]} | quoteai`;

const card = el("div", { class: "card" });
card.append(el("h1", {}, TITLES[tool][lang]));
const inputs = el("div", { class: "inputs" });
const result = el("div", { class: "result", "aria-live": "polite" });
card.append(inputs, result);

const credit = el("p", { class: "credit" });
const link = el("a", { href: `https://quoteai.ca${PATHS[tool][lang]}`, target: "_blank", rel: "noopener" }, "quoteai");
credit.append(CREDIT[lang][0], link, CREDIT[lang][1]);
root.append(card, credit);

const province = provinceSelect();

if (tool === "salesTax") {
  let mode: "add" | "extract" = "add";
  const amount = numberInput("10000");
  const modes = el("div", { class: "modes", role: "group" });
  const amountField = field(TOOL_UI.amountBefore[lang], amount, "$");
  const buttons = (["add", "extract"] as const).map((m) => {
    const b = el("button", { type: "button", "aria-pressed": String(m === mode) }, m === "add" ? TOOL_UI.modeAdd[lang] : TOOL_UI.modeExtract[lang]);
    b.addEventListener("click", () => {
      mode = m;
      buttons.forEach((x, i) => x.setAttribute("aria-pressed", String((i === 0 ? "add" : "extract") === mode)));
      amountField.querySelector("label")!.textContent = mode === "add" ? TOOL_UI.amountBefore[lang] : TOOL_UI.amountAfter[lang];
      render();
    });
    return b;
  });
  modes.append(...buttons);
  inputs.append(modes, field(TOOL_UI.province[lang], province), amountField);
  const render = () => {
    const r = salesTax(parseAmount(amount.value, lang) ?? 0, province.value as ProvinceCode, mode);
    result.replaceChildren(
      row(TOOL_UI.subtotal[lang], money(r.subtotal)),
      ...r.lines.map((l) => row(`${taxComponentLabel({ code: l.code, label: l.code, rate: l.rate }, lang)} (${formatRate(l.rate, lang)} %)`, money(l.amount))),
      row(TOOL_UI.total[lang], money(r.total), "row grand"),
    );
  };
  amount.addEventListener("input", render);
  province.addEventListener("change", render);
  render();
} else {
  const billed = numberInput("50000");
  const rate = numberInput("10");
  inputs.append(field(TOOL_UI.province[lang], province), field(TOOL_UI.billed[lang], billed, "$"), field(TOOL_UI.holdbackPct[lang], rate, "%"));
  const render = () => {
    const p = province.value as ProvinceCode;
    const taxRate = TAX_PROFILES[p].totalRate;
    const taxLabel = TAX_PROFILES[p].components.map((c) => taxComponentLabel(c, lang)).join(" + ");
    const r = holdback(parseAmount(billed.value, lang) ?? 0, parseAmount(rate.value, lang) ?? 0, taxRate);
    result.replaceChildren(
      row(TOOL_UI.billed[lang], money(r.billed)),
      row(TOOL_UI.holdbackKept[lang], `− ${money(r.holdback)}`),
      row(TOOL_UI.netNow[lang], money(r.net)),
      row(`${TOOL_UI.taxNow[lang]} (${taxLabel} ${formatRate(taxRate, lang)} %)`, money(r.taxNow)),
      row(TOOL_UI.payableNow[lang], money(r.payableNow), "row grand"),
      el("p", { class: "sub" }, TOOL_UI.onRelease[lang]),
      row(TOOL_UI.holdbackKept[lang], money(r.holdback)),
      row(`${taxLabel} (${formatRate(taxRate, lang)} %)`, money(r.taxOnRelease)),
      row(TOOL_UI.releaseTotal[lang], money(r.releaseTotal), "row grand"),
    );
  };
  for (const i of [billed, rate]) i.addEventListener("input", render);
  province.addEventListener("change", render);
  render();
}
