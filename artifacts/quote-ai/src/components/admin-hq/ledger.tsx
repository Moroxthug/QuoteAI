import { useCallback, useEffect, useState } from "react";
import { Download, Trash2, Plus, Save } from "lucide-react";
import {
  EXPENSE_CATEGORIES, EXPORT_KINDS,
  type HqClient, type HqExpense, type HqExportKind, type HqRange, type HqSpend,
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
  const [expenses, setExpenses] = useState<HqExpense[] | null>(null);
  const [spend, setSpend] = useState<HqSpend[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [eDate, setEDate] = useState(today());
  const [eCat, setECat] = useState<string>("other");
  const [eDesc, setEDesc] = useState("");
  const [eAmt, setEAmt] = useState("");
  const [eRec, setERec] = useState(false);

  const [sDate, setSDate] = useState(today());
  const [sSrc, setSSrc] = useState("");
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
    if (amountCents == null || !eDesc.trim()) { setErr("Enter a description and an amount above $0."); return; }
    void run(async () => {
      await client.addExpense({ date: eDate, category: eCat, description: eDesc.trim(), amountCents, recurring: eRec });
      setEDesc(""); setEAmt(""); setERec(false);
    });
  };
  const addSpend = (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = dollarsToCents(sAmt);
    if (amountCents == null || !sSrc.trim()) { setErr("Enter a source and an amount above $0."); return; }
    void run(async () => {
      await client.addSpend({ date: sDate, source: sSrc.trim(), note: sNote.trim(), amountCents });
      setSSrc(""); setSNote(""); setSAmt("");
    });
  };
  const saveCash = (e: React.FormEvent) => {
    e.preventDefault();
    if (cash.trim() === "") { void run(() => client.setCash(null)); return; }
    const n = Number(cash.replace(/[$,\s]/g, ""));
    if (!Number.isFinite(n) || n < 0) { setErr("Cash must be a number, $0 or more."); return; }
    void run(() => client.setCash(Math.round(n * 100)));
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
            <Field label="Date"><input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} className={inputCls} required /></Field>
            <Field label="Category">
              <select value={eCat} onChange={(e) => setECat(e.target.value)} className={inputCls}>
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2"><Field label="Description"><input value={eDesc} onChange={(e) => setEDesc(e.target.value)} className={inputCls} placeholder="Vercel Pro" /></Field></div>
            <Field label="Amount (CAD)"><input inputMode="decimal" value={eAmt} onChange={(e) => setEAmt(e.target.value)} className={inputCls} placeholder="29.00" /></Field>
            <label className="flex items-center gap-2 text-sm text-slate-700 sm:mt-6 min-h-[2.5rem]">
              <input type="checkbox" checked={eRec} onChange={(e) => setERec(e.target.checked)} className="h-4 w-4" />Repeats monthly
            </label>
            <button type="submit" disabled={busy} className={`${btnPrimaryCls} sm:col-span-2`}><Plus aria-hidden className="h-4 w-4" />Add expense</button>
          </form>
          <LedgerList
            loading={expenses == null}
            empty="No expenses in this range."
            items={(expenses ?? []).map((x) => ({
              id: x.id, title: x.description || x.category, meta: `${shortDate(x.date)} · ${x.category}${x.recurring ? " · monthly" : ""}`,
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
            <Field label="Source / channel"><input value={sSrc} onChange={(e) => setSSrc(e.target.value)} className={inputCls} placeholder="Google Ads" /></Field>
            <div className="sm:col-span-2"><Field label="Note (optional)"><input value={sNote} onChange={(e) => setSNote(e.target.value)} className={inputCls} /></Field></div>
            <Field label="Amount (CAD)"><input inputMode="decimal" value={sAmt} onChange={(e) => setSAmt(e.target.value)} className={inputCls} placeholder="150.00" /></Field>
            <button type="submit" disabled={busy} className={`${btnPrimaryCls} sm:mt-5`}><Plus aria-hidden className="h-4 w-4" />Add spend</button>
          </form>
          <LedgerList
            loading={spend == null}
            empty="No marketing spend in this range."
            items={(spend ?? []).map((x) => ({
              id: x.id, title: x.source, meta: `${shortDate(x.date)}${x.note ? ` · ${x.note}` : ""}`, amount: money(x.amountCents, { exact: true }),
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
