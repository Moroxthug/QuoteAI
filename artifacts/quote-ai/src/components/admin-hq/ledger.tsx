import { useCallback, useEffect, useState } from "react";
import { Download, Trash2, Plus, Save } from "lucide-react";
import {
  EXPENSE_CADENCES, EXPENSE_CATEGORIES, EXPORT_KINDS,
  type HqCadence, type HqClient, type HqExpenses, type HqExportKind, type HqRange, type HqSpendList,
} from "@/lib/hq-api";
import { Card, Empty, Section, Skeleton, btnCls, btnPrimaryCls, inputCls, money, shortDate } from "./ui";

const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());

/** "12.50" or "1,200" -> 1250 / 120000 cents; null when not a positive amount. */
export function dollarsToCents(s: string): number | null {
  const n = Number(s.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="block text-xs font-medium text-slate-700 mb-1">{label}</span>
      {children}
    </label>
  );
}

export function LedgerSection({
  client, range, cashCents, onChanged, demo,
}: { client: HqClient; range: HqRange; cashCents: number | null; onChanged: () => void; demo: boolean }) {
  const [expenses, setExpenses] = useState<HqExpenses | null>(null);
  const [spend, setSpend] = useState<HqSpendList | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [eDate, setEDate] = useState(today());
  const [eCat, setECat] = useState<string>("other");
  const [eName, setEName] = useState("");
  const [eAmt, setEAmt] = useState("");
  const [eCad, setECad] = useState<HqCadence>("one_off");
  const [eEnd, setEEnd] = useState("");
  const [eNote, setENote] = useState("");

  const [sDate, setSDate] = useState(today());
  const [sSrc, setSSrc] = useState("");
  const [sCamp, setSCamp] = useState("");
  const [sNote, setSNote] = useState("");
  const [sAmt, setSAmt] = useState("");

  const [cash, setCash] = useState(cashCents == null ? "" : String(cashCents / 100));
  useEffect(() => { setCash(cashCents == null ? "" : String(cashCents / 100)); }, [cashCents]);

  const load = useCallback(() => {
    setErr(null);
    Promise.all([client.expenses(range), client.spend(range)])
      .then(([e, s]) => { setExpenses(e); setSpend(s); })
      .catch(() => setErr("The ledger is not available yet."));
  }, [client, range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(load, [load]);

  async function run(fn: () => Promise<void>) {
    setBusy(true); setErr(null);
    try { await fn(); load(); onChanged(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); }
  }

  const addExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = dollarsToCents(eAmt);
    if (amountCents == null || !eName.trim()) { setErr("Enter a name and an amount above $0."); return; }
    if (eEnd && eEnd < eDate) { setErr("The end date must not be before the start date."); return; }
    void run(async () => {
      await client.addExpense({ name: eName.trim(), category: eCat, amountCents, cadence: eCad, startsOn: eDate, endsOn: eCad === "one_off" || !eEnd ? null : eEnd, note: eNote.trim() || null });
      setEName(""); setEAmt(""); setEEnd(""); setENote("");
    });
  };
  const addSpend = (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = dollarsToCents(sAmt);
    if (amountCents == null || !sSrc.trim()) { setErr("Enter a channel and an amount above $0."); return; }
    void run(async () => {
      await client.addSpend({ channel: sSrc.trim(), campaign: sCamp.trim() || null, spentOn: sDate, amountCents, note: sNote.trim() || null });
      setSSrc(""); setSCamp(""); setSNote(""); setSAmt("");
    });
  };
  const saveCash = (e: React.FormEvent) => {
    e.preventDefault();
    if (cash.trim() === "") { void run(async () => { await client.setCash(null); }); return; }
    const n = Number(cash.replace(/[$,\s]/g, ""));
    if (!Number.isFinite(n) || n < 0) { setErr("Cash must be a number, $0 or more."); return; }
    void run(async () => { await client.setCash(Math.round(n * 100)); });
  };

  return (
    <Section id="ledger" title="Ledger" hint="Your own costs and marketing spend. They feed profit, runway and CAC above. Amounts are in CAD, before tax.">
      {err && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}

      <Card>
        <h3 className="text-sm font-semibold text-slate-900 mb-2">Cash in the bank</h3>
        <form onSubmit={saveCash} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="sm:w-56"><Field label="Balance today (CAD)">
            <input inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} placeholder="Leave empty for not set" className={inputCls} />
          </Field></div>
          <button type="submit" disabled={busy} className={btnPrimaryCls}><Save aria-hidden className="h-4 w-4" />Save cash</button>
        </form>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Expenses</h3>
          <form onSubmit={addExpense} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label={eCad === "one_off" ? "Date" : "Starts on"}><input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} className={inputCls} required /></Field>
            <Field label="Category">
              <select value={eCat} onChange={(e) => setECat(e.target.value)} className={inputCls}>
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2"><Field label="Name"><input value={eName} onChange={(e) => setEName(e.target.value)} className={inputCls} placeholder="Vercel Pro" maxLength={120} /></Field></div>
            <Field label="Amount (CAD)"><input inputMode="decimal" value={eAmt} onChange={(e) => setEAmt(e.target.value)} className={inputCls} placeholder="29.00" /></Field>
            <Field label="How often">
              <select value={eCad} onChange={(e) => setECad(e.target.value as HqCadence)} className={inputCls}>
                {EXPENSE_CADENCES.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
              </select>
            </Field>
            {eCad !== "one_off" && <Field label="Ends on (optional)"><input type="date" value={eEnd} min={eDate} onChange={(e) => setEEnd(e.target.value)} className={inputCls} /></Field>}
            <div className={eCad === "one_off" ? "sm:col-span-2" : ""}><Field label="Note (optional)"><input value={eNote} onChange={(e) => setENote(e.target.value)} className={inputCls} maxLength={500} /></Field></div>
            <button type="submit" disabled={busy} className={`${btnPrimaryCls} sm:col-span-2`}><Plus aria-hidden className="h-4 w-4" />Add expense</button>
          </form>
          <LedgerList
            loading={expenses == null}
            empty="No expenses in this range."
            items={(expenses?.items ?? []).map((x) => ({
              id: x.id, title: x.name,
              meta: `${shortDate(x.startsOn)}${x.endsOn ? ` to ${shortDate(x.endsOn)}` : ""} · ${x.category.replace(/_/g, " ")} · ${x.cadence.replace("_", " ")}${x.category === "tax" ? " · not in costs" : ""}`,
              amount: money(x.amountCents, { exact: true }),
            }))}
            onDelete={(id, t) => { if (window.confirm(`Remove "${t}"?`)) void run(() => client.deleteExpense(id)); }}
            disabled={busy}
          />
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Marketing spend</h3>
          <form onSubmit={addSpend} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label="Date"><input type="date" value={sDate} onChange={(e) => setSDate(e.target.value)} className={inputCls} required /></Field>
            <Field label="Channel (as in sources above)"><input value={sSrc} onChange={(e) => setSSrc(e.target.value)} className={inputCls} placeholder="google_ads" maxLength={60} /></Field>
            <div className="sm:col-span-2"><Field label="Campaign (optional)"><input value={sCamp} onChange={(e) => setSCamp(e.target.value)} className={inputCls} maxLength={80} /></Field></div>
            <div className="sm:col-span-2"><Field label="Note (optional)"><input value={sNote} onChange={(e) => setSNote(e.target.value)} className={inputCls} /></Field></div>
            <Field label="Amount (CAD)"><input inputMode="decimal" value={sAmt} onChange={(e) => setSAmt(e.target.value)} className={inputCls} placeholder="150.00" /></Field>
            <button type="submit" disabled={busy} className={`${btnPrimaryCls} sm:mt-5`}><Plus aria-hidden className="h-4 w-4" />Add spend</button>
          </form>
          <LedgerList
            loading={spend == null}
            empty={spend?.truncated ? "Too many rows to list." : "No marketing spend in this range."}
            items={(spend?.items ?? []).map((x) => ({
              id: x.id, title: x.campaign ? `${x.channel} / ${x.campaign}` : x.channel, meta: `${shortDate(x.spentOn)}${x.note ? ` · ${x.note}` : ""}`, amount: money(x.amountCents, { exact: true }),
            }))}
            onDelete={(id, t) => { if (window.confirm(`Remove "${t}"?`)) void run(() => client.deleteSpend(id)); }}
            disabled={busy}
          />
        </Card>
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-slate-900">Export for the accountant</h3>
        <p className="text-xs text-slate-500 mt-0.5">CSV for {range.from} to {range.to}.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {EXPORT_KINDS.map((k: HqExportKind) => (
            <a key={k} href={client.exportUrl(k, range)} download={`quoteai-${k}-${range.from}-${range.to}.csv`}
              onClick={(e) => { if (demo) e.preventDefault(); }}
              className={btnCls}><Download aria-hidden className="h-4 w-4" />{k[0].toUpperCase() + k.slice(1)} CSV</a>
          ))}
        </div>
      </Card>
    </Section>
  );
}

function LedgerList({
  loading, empty, items, onDelete, disabled,
}: {
  loading: boolean; empty: string; disabled: boolean;
  items: { id: string; title: string; meta: string; amount: string }[];
  onDelete: (id: string, title: string) => void;
}) {
  if (loading) return <div className="mt-3"><Skeleton className="h-16" /></div>;
  if (!items.length) return <div className="mt-3"><Empty>{empty}</Empty></div>;
  return (
    <ul className="mt-3 divide-y divide-slate-100 max-h-72 overflow-y-auto">
      {items.map((it) => (
        <li key={it.id} className="flex items-center gap-2 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900 break-words">{it.title}</p>
            <p className="text-xs text-slate-500 break-words">{it.meta}</p>
          </div>
          <span className="text-sm font-semibold tabular-nums text-slate-900">{it.amount}</span>
          <button type="button" disabled={disabled} onClick={() => onDelete(it.id, it.title)} aria-label={`Remove ${it.title}`}
            className="h-11 w-11 shrink-0 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-navy-500">
            <Trash2 aria-hidden className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
