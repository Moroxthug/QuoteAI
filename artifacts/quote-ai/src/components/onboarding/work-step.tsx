import { useLanguage } from "@/i18n/LanguageContext";
import { COMPANY_TRADES, type CompanySetup, type CompanyTrade } from "@/lib/people-api";

// Phase 91: what the company does and how big it is — asked once at sign-up to
// size the plan (seats) and to know whether crews work on site. Nothing is gated
// on the answers.

export function WorkStepFields({ value, onChange }: { value: Required<Pick<CompanySetup, "trades">> & CompanySetup; onChange: (v: CompanySetup & { trades: CompanyTrade[] }) => void }) {
  const { t } = useLanguage();
  const toggle = (trade: CompanyTrade) => onChange({ ...value, trades: value.trades.includes(trade) ? value.trades.filter((x) => x !== trade) : [...value.trades, trade] });
  const num = (k: "teamSize" | "seatsWanted") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = Number.parseInt(e.target.value, 10);
    onChange({ ...value, [k]: Number.isFinite(n) && n > 0 ? Math.min(k === "teamSize" ? 10_000 : 500, n) : undefined });
  };
  return (
    <div className="form-grid">
      <fieldset className="field full" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="mb-2" style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)" }}>{t("setup.trades")}</legend>
        <div className="pills" style={{ flexWrap: "wrap", gap: 8 }}>
          {COMPANY_TRADES.map((trade) => (
            <button key={trade} type="button" className={value.trades.includes(trade) ? "pill on" : "pill"} aria-pressed={value.trades.includes(trade)} onClick={() => toggle(trade)}>
              {t(`setup.trade.${trade}`)}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor="setup-team">{t("setup.teamSize")}</label>
        <input id="setup-team" type="number" inputMode="numeric" min={1} value={value.teamSize ?? ""} onChange={num("teamSize")} placeholder="8" />
        <span className="text-[11px] mt-1 block" style={{ color: "var(--faint)" }}>{t("setup.teamSizeHint")}</span>
      </div>
      <div className="field">
        <label htmlFor="setup-seats">{t("setup.seatsWanted")}</label>
        <input id="setup-seats" type="number" inputMode="numeric" min={1} value={value.seatsWanted ?? ""} onChange={num("seatsWanted")} placeholder="3" />
        <span className="text-[11px] mt-1 block" style={{ color: "var(--faint)" }}>{t("setup.seatsHint")}</span>
      </div>
      <fieldset className="field full" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="mb-2" style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)" }}>{t("setup.fieldCrew")}</legend>
        <div className="pills">
          <button type="button" className={value.fieldCrew === true ? "pill on" : "pill"} aria-pressed={value.fieldCrew === true} onClick={() => onChange({ ...value, fieldCrew: true })}>{t("setup.fieldCrewYes")}</button>
          <button type="button" className={value.fieldCrew === false ? "pill on" : "pill"} aria-pressed={value.fieldCrew === false} onClick={() => onChange({ ...value, fieldCrew: false })}>{t("setup.fieldCrewNo")}</button>
        </div>
        <span className="text-[11px] mt-1 block" style={{ color: "var(--faint)" }}>{t("setup.fieldCrewHint")}</span>
      </fieldset>
    </div>
  );
}
