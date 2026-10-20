import { useEffect, useState } from "react";
import { Search, ArrowUpDown, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import type {
  HqBucket, HqClient, HqCohorts, HqCustomer, HqCustomerSort, HqCustomers, HqOverview, HqPoint, HqRange,
} from "@/lib/hq-api";
import {
  Card, Empty, Section, Skeleton, Stat, count, inputCls, money, months, percent, shortDate,
  NOT_CONNECTED, NOT_ENOUGH,
} from "./ui";

const DEFAULT_FOUNDING_LIMIT = 100; // used until the overview exposes customers.foundingLimit
const label = (v: string) => v.replace(/_/g, " ");
const FUNNEL_LABELS: Record<string, string> = {
  visits: "Visited the site", signups: "Signed up", first_quote: "Created a first quote",
  quote_sent: "Sent a quote", quote_accepted: "Had a quote accepted", paying: "Paying",
};

// ---- (1) top strip ----------------------------------------------------------
export function TopStrip({ o }: { o: HqOverview }) {
  const m = o.money;
  const FOUNDING_LIMIT = o.customers.foundingLimit ?? DEFAULT_FOUNDING_LIMIT;
  const found = Math.min(o.customers.foundingCount, FOUNDING_LIMIT);
  const profitTone = m.profitCents == null ? undefined : m.profitCents >= 0 ? "good" : "bad";
  return (
    <Section id="top" title="At a glance" hint={`${o.range.from} to ${o.range.to}. Revenue is ex tax, in CAD.`}>
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="MRR" value={money(m.mrrCents)} missing={m.mrrCents == null} />
        <Stat label="ARR" value={money(m.arrCents)} missing={m.arrCents == null} />
        <Stat label="Revenue in range (ex tax)" value={money(m.revenueCents)} missing={m.revenueCents == null} />
        <Stat label="Costs in range" value={money(totalCosts(o))} missing={totalCosts(o) == null} sub="AI, messaging, email, storage, infra, other" />
        <Stat label="Profit" value={money(m.profitCents)} missing={m.profitCents == null} tone={profitTone} />
        <Stat label="Cash in the bank" value={money(m.cashCents, { fallback: "not set" })} missing={m.cashCents == null} />
        <Stat
          label="Runway"
          value={m.cashCents == null ? "not set" : m.runwayMonths == null ? "no burn (profitable)" : months(m.runwayMonths)}
          missing={m.cashCents == null}
          sub={m.cashCents == null ? "Set cash in the ledger below" : undefined}
        />
        <Stat label="Paying customers" value={count(o.customers.paying)} sub={`${count(o.customers.total)} accounts in total`} />
      </dl>
      <Card className="mt-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <p className="text-sm font-semibold text-slate-900" id="founding-label">
            Founding price: {found} of {FOUNDING_LIMIT} paying customers, then the price rises to $29
          </p>
          <p className="text-xs text-slate-500 tabular-nums">{Math.max(FOUNDING_LIMIT - found, 0)} spots left</p>
        </div>
        <div
          role="progressbar" aria-labelledby="founding-label" aria-valuemin={0} aria-valuemax={FOUNDING_LIMIT} aria-valuenow={found}
          className="mt-2 h-3 w-full rounded-full bg-slate-200 overflow-hidden"
        >
          <div className="h-full rounded-full bg-navy-600" style={{ width: `${(found / FOUNDING_LIMIT) * 100}%` }} />
        </div>
      </Card>
    </Section>
  );
}

export function totalCosts(o: HqOverview): number | null {
  const vals = Object.values(o.money.costsCents).filter((v): v is number => typeof v === "number");
  return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
}

// ---- (2) money --------------------------------------------------------------
export function bucketFor(r: HqRange): HqBucket {
  const days = (Date.parse(r.to) - Date.parse(r.from)) / 86_400_000;
  return days > 180 ? "month" : days > 60 ? "week" : "day";
}

export function MoneySection({ o, client }: { o: HqOverview; client: HqClient }) {
  const r = o.range;
  const [rows, setRows] = useState<{ at: string; revenue: number | null; costs: number | null; profit: number | null }[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let live = true;
    setRows(null); setErr(false);
    const b = bucketFor(r);
    Promise.all([client.series("revenue", b, r), client.series("costs", b, r), client.series("profit", b, r)])
      .then(([rev, cost, prof]) => {
        if (!live) return;
        const map = new Map<string, { at: string; revenue: number | null; costs: number | null; profit: number | null }>();
        const put = (pts: HqPoint[], k: "revenue" | "costs" | "profit") => {
          for (const p of pts) {
            const row = map.get(p.at) ?? { at: p.at, revenue: null, costs: null, profit: null };
            row[k] = p.value == null ? null : p.value / 100;
            map.set(p.at, row);
          }
        };
        put(rev, "revenue"); put(cost, "costs"); put(prof, "profit");
        setRows([...map.values()].sort((a, c) => a.at.localeCompare(c.at)));
      })
      .catch(() => live && setErr(true));
    return () => { live = false; };
  }, [client, r.from, r.to]); // eslint-disable-line react-hooks/exhaustive-deps

  const c = o.money.costsCents;
  const costRows: [string, number | null][] = [
    ["AI", c.ai], ["Messaging (SMS, WhatsApp)", c.messaging], ["Email", c.email],
    ["Storage", c.storage], ["Infrastructure", c.infra], ["Other", c.other],
  ];
  const maxCost = Math.max(1, ...costRows.map(([, v]) => v ?? 0));

  return (
    <Section id="money" title="Money" hint="Revenue is cash received ex tax, less refunds. Costs come from usage capture and your own ledger.">
      <Card>
        <h3 className="text-sm font-semibold text-slate-900 mb-2">Revenue, costs and profit</h3>
        {err ? (
          <Empty>The series is not available yet. The totals below are still correct.</Empty>
        ) : !rows ? (
          <Skeleton className="h-64" />
        ) : rows.length === 0 ? (
          <Empty>{NOT_ENOUGH} for this range.</Empty>
        ) : (
          <>
            <div className="h-64 w-full" role="img" aria-label={`Chart of revenue, costs and profit per ${bucketFor(r)}, from ${r.from} to ${r.to}. The same numbers are in the table below the chart.`}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rows} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="at" tick={{ fontSize: 11, fill: "#475569" }} tickFormatter={(v: string) => v.slice(5)} minTickGap={24} />
                  <YAxis width={52} tick={{ fontSize: 11, fill: "#475569" }} tickFormatter={(v: number) => `$${Math.round(v)}`} />
                  <Tooltip formatter={(v: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#2563eb" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="costs" name="Costs" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                  <Line dataKey="profit" name="Profit" stroke="#047857" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-slate-700 font-medium py-2">Show chart data as a table</summary>
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-xs tabular-nums">
                  <caption className="sr-only">Revenue, costs and profit per period</caption>
                  <thead><tr className="text-left text-slate-600"><th scope="col" className="py-1 pr-2">Period</th><th scope="col" className="pr-2">Revenue</th><th scope="col" className="pr-2">Costs</th><th scope="col">Profit</th></tr></thead>
                  <tbody>
                    {rows.map((x) => (
                      <tr key={x.at} className="border-t border-slate-100">
                        <th scope="row" className="py-1 pr-2 font-normal text-left">{x.at}</th>
                        <td className="pr-2">{money(x.revenue == null ? null : x.revenue * 100, { exact: true })}</td>
                        <td className="pr-2">{money(x.costs == null ? null : x.costs * 100, { exact: true })}</td>
                        <td>{money(x.profit == null ? null : x.profit * 100, { exact: true })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Costs breakdown</h3>
          <ul className="space-y-2.5">
            {costRows.map(([label, v]) => (
              <li key={label}>
                <div className="flex justify-between gap-2 text-sm">
                  <span className="text-slate-700">{label}</span>
                  <span className={`tabular-nums ${v == null ? "italic text-slate-500" : "font-semibold text-slate-900"}`}>{money(v)}</span>
                </div>
                <div aria-hidden className="mt-1 h-2 rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-slate-500" style={{ width: `${v ? (v / maxCost) * 100 : 0}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <dl className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-sm">
            <Row k="Marketing spend" v={money(o.money.marketingSpendCents)} missing={o.money.marketingSpendCents == null} />
            <Row k="Payment processor fees" v={money(o.money.feesCents)} missing={o.money.feesCents == null} />
            <Row k="Refunds" v={money(o.money.refundsCents)} missing={o.money.refundsCents == null} />
            <Row k="MRR: new / expansion" v={`${money(o.money.newMrrCents)} / ${money(o.money.expansionMrrCents)}`} />
            <Row k="MRR: contraction / churned" v={`${money(o.money.contractionMrrCents)} / ${money(o.money.churnedMrrCents)}`} />
          </dl>
        </Card>

        <Card className="border-amber-300 bg-amber-50/60">
          <h3 className="text-sm font-semibold text-slate-900">Tax collected (GST/HST owed)</h3>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{money(o.money.taxCollectedCents)}</p>
          <p className="mt-1 inline-block rounded bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900">Not revenue</p>
          <p className="mt-2 text-xs text-slate-700">
            Tax collected is held for the government. It is excluded from revenue, profit and runway above.
          </p>
        </Card>
      </div>
    </Section>
  );
}

function Row({ k, v, missing }: { k: string; v: string; missing?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-600">{k}</dt>
      <dd className={`tabular-nums ${missing ? "italic text-slate-500" : "font-semibold text-slate-900"}`}>{v}</dd>
    </div>
  );
}

// ---- (3) customers ----------------------------------------------------------
const PAGE = 50;
const SORTS: { key: HqCustomerSort; label: string; defDir: "asc" | "desc" }[] = [
  { key: "company", label: "Company", defDir: "asc" }, { key: "plan", label: "Plan", defDir: "asc" },
  { key: "since", label: "Since", defDir: "desc" }, { key: "revenue", label: "Revenue this month", defDir: "desc" },
  { key: "aiCost", label: "AI cost", defDir: "desc" }, { key: "margin", label: "Margin", defDir: "asc" },
];

export function CustomersSection({ o, client }: { o: HqOverview; client: HqClient }) {
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [sort, setSort] = useState<HqCustomerSort>("since");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<HqCustomers | null>(null);
  const [err, setErr] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => { const t = setTimeout(() => { setDq(q); setOffset(0); }, 250); return () => clearTimeout(t); }, [q]);
  useEffect(() => {
    let live = true;
    setErr(false);
    client.customers({ sort, dir, q: dq, limit: PAGE, offset }).then((r) => live && setData(r)).catch(() => live && setErr(true));
    return () => { live = false; };
  }, [client, sort, dir, dq, offset, tick]);

  const c = o.customers;
  const rows = data?.customers ?? null;
  const toggle = (k: HqCustomerSort) => {
    setOffset(0);
    if (k === sort) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSort(k); setDir(SORTS.find((s) => s.key === k)?.defDir ?? "desc"); }
  };
  const planLabel = (r: HqCustomer) => (r.plan ? label(r.plan.replace(/^monthly_/, "")) : "no plan") + (r.founding ? " (founding)" : "");
  const rev = (r: HqCustomer) => money(r.mtdRevenueCents) + (r.estimated ? " (est.)" : "");
  const nameOf = (r: HqCustomer) => r.companyName ?? r.email ?? "Unnamed";

  return (
    <Section id="customers" title="Customers" hint="Revenue is this month so far, ex tax. Usage costs are metered in US cents. (est.) means the plan list price, because there are no billing events yet.">
      <dl className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Stat label="Total" value={count(c.total)} />
        <Stat label="Paying" value={count(c.paying)} />
        <Stat label="Trialing" value={count(c.trialing)} />
        <Stat label="Free" value={count(c.free)} />
        <Stat label="New in range" value={count(c.newInRange)} />
        <Stat label="Churned in range" value={count(c.churnedInRange)} />
      </dl>
      <Card>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search customers</span>
            <Search aria-hidden className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company or email" className={`${inputCls} pl-9`} />
          </label>
          <div className="flex items-center gap-2 text-sm text-slate-700 md:hidden">
            <label className="flex flex-1 items-center gap-2"><span className="shrink-0">Sort by</span>
              <select value={sort} onChange={(e) => { setSort(e.target.value as HqCustomerSort); setOffset(0); }} className={inputCls}>
                {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select></label>
            <button type="button" className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-semibold" onClick={() => setDir((d) => (d === "asc" ? "desc" : "asc"))}>
              {dir === "asc" ? "Ascending" : "Descending"}
            </button>
          </div>
        </div>

        {err ? (
          <div className="mt-3 flex items-center gap-3"><Empty>The customer list is not available yet.</Empty>
            <button type="button" className="text-sm font-semibold text-navy-700 underline" onClick={() => setTick((n) => n + 1)}>Retry</button></div>
        ) : !rows ? (
          <div className="mt-3 space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
        ) : rows.length === 0 ? (
          <div className="mt-3"><Empty>No customers match.</Empty></div>
        ) : (
          <>
            <div className="hidden md:block mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Customers, one row per company</caption>
                <thead>
                  <tr className="text-left text-xs text-slate-600">
                    {SORTS.map((s) => <SortTh key={s.key} s={s} sort={sort} dir={dir} onClick={toggle} />)}
                    <th scope="col" className="py-2 pr-3 font-semibold">Last active</th>
                    <th scope="col" className="py-2 font-semibold">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.userId} className="border-t border-slate-100">
                      <th scope="row" className="py-2 pr-3 text-left font-medium text-slate-900">{nameOf(r)}</th>
                      <td className="pr-3">{planLabel(r)}</td>
                      <td className="pr-3 whitespace-nowrap">{shortDate(r.since)}</td>
                      <td className="pr-3 tabular-nums">{rev(r)}</td>
                      <td className="pr-3 tabular-nums">{money(r.aiCostCents, { exact: true })}</td>
                      <td className={`pr-3 tabular-nums ${r.marginCents < 0 ? "text-red-700 font-semibold" : ""}`}>{money(r.marginCents)}</td>
                      <td className="pr-3 whitespace-nowrap">{shortDate(r.lastActiveAt)}</td>
                      <td>{r.source ? label(r.source) : "unknown"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="md:hidden mt-3 space-y-2">
              {rows.map((r) => (
                <li key={r.userId} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-semibold text-slate-900 break-words min-w-0">{nameOf(r)}</p>
                    <span className="shrink-0 text-xs rounded bg-slate-100 px-2 py-0.5 text-slate-700">{planLabel(r)}</span>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <Kv k="Since" v={shortDate(r.since)} />
                    <Kv k="Last active" v={shortDate(r.lastActiveAt)} />
                    <Kv k="Revenue this month" v={rev(r)} />
                    <Kv k="AI cost" v={money(r.aiCostCents, { exact: true })} />
                    <Kv k="Margin" v={money(r.marginCents)} />
                    <Kv k="Source" v={r.source ? label(r.source) : "unknown"} />
                  </dl>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-600">
              <span className="tabular-nums">{offset + 1} to {offset + rows.length} of {count(data?.total)}</span>
              <span className="flex gap-2">
                <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))} className="h-10 px-3 rounded-lg border border-slate-300 bg-white font-semibold disabled:opacity-40">Previous</button>
                <button type="button" disabled={offset + rows.length >= (data?.total ?? 0)} onClick={() => setOffset(offset + PAGE)} className="h-10 px-3 rounded-lg border border-slate-300 bg-white font-semibold disabled:opacity-40">Next</button>
              </span>
            </div>
            {data?.notes.length ? <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">{data.notes.map((n, i) => <li key={i}>{n}</li>)}</ul> : null}
          </>
        )}
      </Card>
    </Section>
  );
}

function SortTh({ s, sort, dir, onClick }: { s: { key: HqCustomerSort; label: string }; sort: HqCustomerSort; dir: "asc" | "desc"; onClick: (k: HqCustomerSort) => void }) {
  return (
    <th scope="col" aria-sort={sort === s.key ? (dir === "asc" ? "ascending" : "descending") : "none"} className="py-2 pr-3 font-semibold">
      <button type="button" onClick={() => onClick(s.key)} className="inline-flex items-center gap-1 hover:text-slate-900">
        {s.label}<ArrowUpDown aria-hidden className="h-3 w-3" />
      </button>
    </th>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return <div className="min-w-0"><dt className="text-slate-500">{k}</dt><dd className="font-medium text-slate-900 tabular-nums break-words">{v}</dd></div>;
}

// ---- (4) funnel -------------------------------------------------------------
export function FunnelSection({ o }: { o: HqOverview }) {
  const max = Math.max(1, ...o.funnel.map((f) => f.count));
  return (
    <Section id="funnel" title="Funnel" hint="Count per stage in the range, and the conversion from the stage before it.">
      <Card>
        {o.funnel.length === 0 ? <Empty>{NOT_ENOUGH}</Empty> : (
          <ol className="space-y-3">
            {o.funnel.map((f, i) => (
              <li key={f.stage}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                  <span className="font-medium text-slate-900">{i + 1}. {FUNNEL_LABELS[f.stage] ?? label(f.stage)}</span>
                  <span className="tabular-nums text-slate-700">
                    <strong className="text-slate-900">{count(f.count)}</strong>
                    {i > 0 && <span className="ml-2 text-xs">{f.rateFromPrevious == null ? `conversion: ${NOT_ENOUGH}` : `${percent(f.rateFromPrevious)} of previous stage`}</span>}
                  </span>
                </div>
                <div aria-hidden className="mt-1 h-3 rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-navy-600" style={{ width: `${Math.max((f.count / max) * 100, f.count ? 1.5 : 0)}%` }} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </Section>
  );
}

// ---- (5) acquisition by source ----------------------------------------------
export function SourcesSection({ o }: { o: HqOverview }) {
  return (
    <Section id="sources" title="Acquisition by source" hint="CAC is spend divided by paying customers from that source. Shown only when both are known.">
      <Card>
        {o.sources.length === 0 ? <Empty>{NOT_ENOUGH}</Empty> : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Signups, paying customers, revenue, spend and CAC by source</caption>
                <thead><tr className="text-left text-xs text-slate-600">
                  {["Source", "Signups", "Paying", "Revenue", "Spend", "CAC"].map((h) => <th key={h} scope="col" className="py-2 pr-3 font-semibold">{h}</th>)}
                </tr></thead>
                <tbody>
                  {o.sources.map((s) => (
                    <tr key={s.source} className="border-t border-slate-100">
                      <th scope="row" className="py-2 pr-3 text-left font-medium text-slate-900">{label(s.source)}</th>
                      <td className="pr-3 tabular-nums">{count(s.signups)}</td>
                      <td className="pr-3 tabular-nums">{count(s.paying)}</td>
                      <td className="pr-3 tabular-nums">{money(s.revenueCents)}</td>
                      <td className="pr-3 tabular-nums">{money(s.spendCents)}</td>
                      <td className="tabular-nums">{money(s.cacCents, { fallback: NOT_ENOUGH })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="md:hidden space-y-2">
              {o.sources.map((s) => (
                <li key={s.source} className="rounded-xl border border-slate-200 p-3">
                  <p className="font-semibold text-slate-900">{label(s.source)}</p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <Kv k="Signups" v={count(s.signups)} />
                    <Kv k="Paying" v={count(s.paying)} />
                    <Kv k="Revenue" v={money(s.revenueCents)} />
                    <Kv k="Spend" v={money(s.spendCents)} />
                    <Kv k="CAC" v={money(s.cacCents, { fallback: NOT_ENOUGH })} />
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="ARPU" value={money(o.unit.arpuCents, { fallback: NOT_ENOUGH })} missing={o.unit.arpuCents == null} />
        <Stat label="LTV" value={money(o.unit.ltvCents, { fallback: NOT_ENOUGH })} missing={o.unit.ltvCents == null} />
        <Stat label="CAC payback" value={months(o.unit.paybackMonths)} missing={o.unit.paybackMonths == null} />
        <Stat label="Gross margin" value={percent(o.unit.grossMarginPct == null ? null : o.unit.grossMarginPct / 100)} missing={o.unit.grossMarginPct == null} />
      </dl>
    </Section>
  );
}

// ---- (6) retention ----------------------------------------------------------
export function RetentionSection({ client }: { client: HqClient }) {
  const [data, setData] = useState<HqCohorts | null>(null);
  const [err, setErr] = useState(false);
  const [kind, setKind] = useState<"active" | "paying">("active");
  useEffect(() => {
    let live = true;
    client.cohorts(12).then((r) => live && setData(r)).catch(() => live && setErr(true));
    return () => { live = false; };
  }, [client]);
  const rows = data?.cohorts ?? null;
  const width = rows ? Math.max(0, ...rows.map((r) => r[kind].length)) : 0;

  return (
    <Section id="retention" title="Retention" hint="Share of each signup month, by months since signup. Blank cells have not happened yet or have no billing history.">
      <Card>
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Retention measure">
          {([["active", "Active (created a quote)"], ["paying", "Paying"]] as const).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
              className={`h-10 px-3 rounded-lg text-sm font-semibold border ${kind === k ? "bg-navy-600 text-white border-navy-600" : "bg-white text-slate-800 border-slate-300"}`}>{l}</button>
          ))}
        </div>
        {err ? <Empty>Cohort data is not available yet.</Empty>
          : !rows ? <Skeleton className="h-40" />
          : rows.length === 0 ? <Empty>{NOT_ENOUGH}</Empty>
          : (
            <div className="overflow-x-auto">
              <table className="text-xs tabular-nums border-separate border-spacing-1 min-w-full">
                <caption className="sr-only">Retention by signup month: {kind}</caption>
                <thead><tr className="text-slate-600">
                  <th scope="col" className="text-left font-semibold pr-2">Cohort</th>
                  <th scope="col" className="text-right font-semibold pr-2">Signups</th>
                  {Array.from({ length: width }, (_, i) => <th key={i} scope="col" className="font-semibold w-12 min-w-[3rem]">M{i}</th>)}
                </tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.month}>
                      <th scope="row" className="text-left font-medium text-slate-900 pr-2 whitespace-nowrap">{r.month}</th>
                      <td className="text-right pr-2 text-slate-700">{count(r.signups)}</td>
                      {Array.from({ length: width }, (_, i) => {
                        const v = r[kind][i];
                        if (v == null) return <td key={i} className="rounded bg-slate-50 text-center text-slate-500 h-8" aria-label="no data yet">-</td>;
                        const f = Math.min(Math.max(v / 100, 0), 1);
                        return (
                          <td key={i} className="rounded text-center h-8 font-medium"
                            style={{ background: `rgba(4,120,87,${0.08 + f * 0.8})`, color: f > 0.55 ? "#fff" : "#0f172a" }}>
                            {Math.round(v)}%
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        {data?.notes.length ? <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">{data.notes.map((n, i) => <li key={i}>{n}</li>)}</ul> : null}
      </Card>
    </Section>
  );
}

// ---- (7) product health -----------------------------------------------------
export function ProductSection({ o }: { o: HqOverview }) {
  const p = o.product;
  return (
    <Section id="product" title="Product health">
      <dl className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Quotes created" value={count(p.quotesCreated)} />
        <Stat label="Quotes sent" value={count(p.quotesSent)} sub={p.quotesCreated ? `${percent(p.quotesSent / p.quotesCreated)} of created` : undefined} />
        <Stat label="Quotes accepted" value={count(p.quotesAccepted)} sub={p.quotesSent ? `${percent(p.quotesAccepted / p.quotesSent)} of sent` : undefined} />
        <Stat label="Weekly active" value={count(p.wau)} missing={p.wau == null} />
        <Stat label="Monthly active" value={count(p.mau)} missing={p.mau == null} />
      </dl>
    </Section>
  );
}

// ---- (8) ops ----------------------------------------------------------------
export function OpsSection({ o }: { o: HqOverview }) {
  const x = o.ops;
  const cron = x.cronOk == null ? { t: NOT_CONNECTED, good: null } : x.cronOk ? { t: "Cron is running", good: true } : { t: "Cron is late or failing", good: false };
  return (
    <Section id="ops" title="Ops">
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <dt className="text-xs font-medium text-slate-600">Scheduled jobs</dt>
          <dd className={`mt-1 flex items-center gap-2 font-bold ${cron.good === false ? "text-red-700" : cron.good ? "text-emerald-700" : "text-slate-500 italic text-sm"}`}>
            {cron.good === true && <CheckCircle2 aria-hidden className="h-5 w-5" />}
            {cron.good === false && <AlertTriangle aria-hidden className="h-5 w-5" />}
            {cron.t}
          </dd>
        </Card>
        <Stat label="Dead automation runs" value={count(x.deadRuns, NOT_CONNECTED)} missing={x.deadRuns == null} tone={x.deadRuns ? "bad" : undefined} sub={x.deadRuns ? "Gave up retrying; check the admin automations tab" : undefined} />
        <Stat label="Email bounce rate" value={percent(x.emailBounceRate, NOT_ENOUGH)} missing={x.emailBounceRate == null} tone={x.emailBounceRate != null && x.emailBounceRate > 0.02 ? "bad" : undefined} />
      </dl>
    </Section>
  );
}

// ---- notes ------------------------------------------------------------------
export function Notes({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return (
    <aside aria-label="What is estimated or not connected" className="rounded-2xl border border-sky-300 bg-sky-50 p-4">
      <h2 className="flex items-center gap-2 text-sm font-bold text-sky-950"><Info aria-hidden className="h-4 w-4" />Read this before trusting a number</h2>
      <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-sky-950">
        {notes.map((n, i) => <li key={i}>{n}</li>)}
      </ul>
    </aside>
  );
}
