// The four free calculators (/tools, /fr/outils). Each renders a worked
// example from its default inputs, so the prerendered HTML already shows real
// numbers, then recalculates as the visitor types. Arithmetic lives in
// lib/calculators.ts (tested); this file is inputs and layout only.
import { useId, useState } from "react";
import { CANADIAN_PROVINCES, PROVINCE_NAMES, TAX_PROFILES, taxComponentLabel, formatRate, type ProvinceCode } from "@/lib/tax-profiles";
import { parseAmount, salesTax, holdback, priceFrom, labourRate } from "@/lib/calculators";
import { TOOL_UI } from "@/data/tool-pages";
import type { ToolId } from "@/data/seo-slugs";

type Lang = "en" | "fr";
const locale = (lang: Lang) => (lang === "fr" ? "fr-CA" : "en-CA");
const money = (n: number, lang: Lang) => new Intl.NumberFormat(locale(lang), { style: "currency", currency: "CAD" }).format(n);
const pct = (n: number, lang: Lang) => `${new Intl.NumberFormat(locale(lang), { maximumFractionDigits: 1 }).format(n)} %`;
const num = (n: number, lang: Lang) => new Intl.NumberFormat(locale(lang), { maximumFractionDigits: 0 }).format(n);

function NumberField({ label, value, onChange, lang, suffix }: { label: string; value: string; onChange: (v: string) => void; lang: Lang; suffix?: string }) {
  const id = useId();
  const errId = `${id}-err`;
  const invalid = value.trim() !== "" && parseAmount(value, lang) === null;
  return (
    <div className="field tool-field">
      <label htmlFor={id}>{label}</label>
      <div className="tool-input">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errId : undefined}
        />
        {suffix && <span className="tool-suffix" aria-hidden="true">{suffix}</span>}
      </div>
      {invalid && <p id={errId} className="field-err">{TOOL_UI.invalid[lang]}</p>}
    </div>
  );
}

function ProvinceField({ value, onChange, lang }: { value: ProvinceCode; onChange: (p: ProvinceCode) => void; lang: Lang }) {
  const id = useId();
  const sorted = [...CANADIAN_PROVINCES].sort((a, b) => PROVINCE_NAMES[a][lang].localeCompare(PROVINCE_NAMES[b][lang], locale(lang)));
  return (
    <div className="field tool-field">
      <label htmlFor={id}>{TOOL_UI.province[lang]}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as ProvinceCode)}>
        {sorted.map((p) => (
          <option key={p} value={p}>{PROVINCE_NAMES[p][lang]}</option>
        ))}
      </select>
    </div>
  );
}

function ModeSwitch<M extends string>({ value, onChange, options }: { value: M; onChange: (m: M) => void; options: ReadonlyArray<{ id: M; label: string }> }) {
  return (
    <div className="pills tool-modes" role="group">
      {options.map((o) => (
        <button key={o.id} type="button" className={`pill${o.id === value ? " on" : ""}`} aria-pressed={o.id === value} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="dm-row"><span>{label}</span><span className="v">{value}</span></div>
  );
}

function Shell({ title, inputs, children }: { title: string; inputs: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="doc-mock tool-card">
      <div className="dm-bar"><b>{title}</b></div>
      <div className="dm-body">
        <div className="tool-inputs">{inputs}</div>
        <div className="tool-result" aria-live="polite">{children}</div>
      </div>
    </div>
  );
}

const defaultProvince = (lang: Lang): ProvinceCode => (lang === "fr" ? "QC" : "ON");

export function SalesTaxCalculator({ lang, title }: { lang: Lang; title: string }) {
  const [province, setProvince] = useState<ProvinceCode>(defaultProvince(lang));
  const [mode, setMode] = useState<"add" | "extract">("add");
  const [amount, setAmount] = useState("10000");
  const value = parseAmount(amount, lang) ?? 0;
  const r = salesTax(value, province, mode);
  return (
    <Shell
      title={title}
      inputs={
        <>
          <ModeSwitch<"add" | "extract"> value={mode} onChange={setMode} options={[{ id: "add", label: TOOL_UI.modeAdd[lang] }, { id: "extract", label: TOOL_UI.modeExtract[lang] }]} />
          <ProvinceField value={province} onChange={setProvince} lang={lang} />
          <NumberField label={mode === "add" ? TOOL_UI.amountBefore[lang] : TOOL_UI.amountAfter[lang]} value={amount} onChange={setAmount} lang={lang} suffix="$" />
        </>
      }
    >
      <Row label={TOOL_UI.subtotal[lang]} value={money(r.subtotal, lang)} />
      <div className="dm-tot">
        {r.lines.map((l) => (
          <Row key={l.code} label={`${taxComponentLabel({ code: l.code, label: l.code, rate: l.rate }, lang)} (${formatRate(l.rate, lang)} %)`} value={money(l.amount, lang)} />
        ))}
        <div className="dm-grand"><span>{TOOL_UI.total[lang]}</span><b>{money(r.total, lang)}</b></div>
      </div>
    </Shell>
  );
}

export function HoldbackCalculator({ lang, title }: { lang: Lang; title: string }) {
  const [province, setProvince] = useState<ProvinceCode>(defaultProvince(lang));
  const [billed, setBilled] = useState("50000");
  const [rate, setRate] = useState("10");
  const taxRate = TAX_PROFILES[province].totalRate;
  const r = holdback(parseAmount(billed, lang) ?? 0, parseAmount(rate, lang) ?? 0, taxRate);
  const taxLabel = TAX_PROFILES[province].components.map((c) => taxComponentLabel(c, lang)).join(" + ");
  return (
    <Shell
      title={title}
      inputs={
        <>
          <ProvinceField value={province} onChange={setProvince} lang={lang} />
          <NumberField label={TOOL_UI.billed[lang]} value={billed} onChange={setBilled} lang={lang} suffix="$" />
          <NumberField label={TOOL_UI.holdbackPct[lang]} value={rate} onChange={setRate} lang={lang} suffix="%" />
        </>
      }
    >
      <Row label={TOOL_UI.billed[lang]} value={money(r.billed, lang)} />
      <Row label={TOOL_UI.holdbackKept[lang]} value={`− ${money(r.holdback, lang)}`} />
      <Row label={TOOL_UI.netNow[lang]} value={money(r.net, lang)} />
      <Row label={`${TOOL_UI.taxNow[lang]} (${taxLabel} ${formatRate(taxRate, lang)} %)`} value={money(r.taxNow, lang)} />
      <div className="dm-tot">
        <div className="dm-grand"><span>{TOOL_UI.payableNow[lang]}</span><b>{money(r.payableNow, lang)}</b></div>
      </div>
      <p className="tool-sub">{TOOL_UI.onRelease[lang]}</p>
      <Row label={TOOL_UI.holdbackKept[lang]} value={money(r.holdback, lang)} />
      <Row label={`${taxLabel} (${formatRate(taxRate, lang)} %)`} value={money(r.taxOnRelease, lang)} />
      <Row label={TOOL_UI.releaseTotal[lang]} value={money(r.releaseTotal, lang)} />
    </Shell>
  );
}

export function MarkupCalculator({ lang, title }: { lang: Lang; title: string }) {
  const [mode, setMode] = useState<"markup" | "margin">("markup");
  const [cost, setCost] = useState("1000");
  const [value, setValue] = useState("25");
  const r = priceFrom(parseAmount(cost, lang) ?? 0, parseAmount(value, lang) ?? 0, mode);
  return (
    <Shell
      title={title}
      inputs={
        <>
          <ModeSwitch<"markup" | "margin"> value={mode} onChange={setMode} options={[{ id: "markup", label: TOOL_UI.modeMarkup[lang] }, { id: "margin", label: TOOL_UI.modeMargin[lang] }]} />
          <NumberField label={TOOL_UI.cost[lang]} value={cost} onChange={setCost} lang={lang} suffix="$" />
          <NumberField label={mode === "markup" ? TOOL_UI.markup[lang] : TOOL_UI.margin[lang]} value={value} onChange={setValue} lang={lang} suffix="%" />
        </>
      }
    >
      {r ? (
        <>
          <Row label={TOOL_UI.cost[lang]} value={money(r.cost, lang)} />
          <Row label={TOOL_UI.profit[lang]} value={money(r.profit, lang)} />
          <Row label={TOOL_UI.markup[lang]} value={pct(r.markupPct, lang)} />
          <Row label={TOOL_UI.margin[lang]} value={pct(r.marginPct, lang)} />
          <div className="dm-tot">
            <div className="dm-grand"><span>{TOOL_UI.price[lang]}</span><b>{money(r.price, lang)}</b></div>
          </div>
        </>
      ) : (
        <p className="field-err">{TOOL_UI.marginTooHigh[lang]}</p>
      )}
    </Shell>
  );
}

export function LabourRateCalculator({ lang, title }: { lang: Lang; title: string }) {
  const [salary, setSalary] = useState("70000");
  const [overhead, setOverhead] = useState("25000");
  const [hours, setHours] = useState("30");
  const [weeks, setWeeks] = useState("46");
  const [margin, setMargin] = useState("15");
  const p = (s: string) => parseAmount(s, lang) ?? 0;
  const r = labourRate({ salary: p(salary), overhead: p(overhead), hoursPerWeek: p(hours), weeks: p(weeks), marginPct: p(margin) });
  return (
    <Shell
      title={title}
      inputs={
        <>
          <NumberField label={TOOL_UI.salary[lang]} value={salary} onChange={setSalary} lang={lang} suffix="$" />
          <NumberField label={TOOL_UI.overhead[lang]} value={overhead} onChange={setOverhead} lang={lang} suffix="$" />
          <div className="tool-pair">
            <NumberField label={TOOL_UI.hoursPerWeek[lang]} value={hours} onChange={setHours} lang={lang} />
            <NumberField label={TOOL_UI.weeks[lang]} value={weeks} onChange={setWeeks} lang={lang} />
          </div>
          <NumberField label={TOOL_UI.profitMargin[lang]} value={margin} onChange={setMargin} lang={lang} suffix="%" />
        </>
      }
    >
      {r ? (
        <>
          <Row label={TOOL_UI.billableHours[lang]} value={num(r.billableHours, lang)} />
          <Row label={TOOL_UI.breakEven[lang]} value={`${money(r.breakEven, lang)} ${TOOL_UI.perHour[lang]}`} />
          <Row label={TOOL_UI.yearlyRevenue[lang]} value={money(r.yearlyRevenue, lang)} />
          <div className="dm-tot">
            <div className="dm-grand"><span>{TOOL_UI.hourlyRate[lang]}</span><b>{money(r.rate, lang)} {TOOL_UI.perHour[lang]}</b></div>
          </div>
        </>
      ) : (
        <p className="field-err">{TOOL_UI.invalid[lang]}</p>
      )}
    </Shell>
  );
}

export const CALCULATORS: Record<ToolId, (props: { lang: Lang; title: string }) => React.JSX.Element> = {
  salesTax: SalesTaxCalculator,
  holdback: HoldbackCalculator,
  markup: MarkupCalculator,
  labourRate: LabourRateCalculator,
};
