import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, RefreshCw, ShieldAlert, ServerCrash } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getHqClient, HqUnavailableError, type HqOverview, type HqRange } from "@/lib/hq-api";
import { Skeleton, btnCls, inputCls } from "@/components/admin-hq/ui";
import {
  CustomersSection, FunnelSection, MoneySection, Notes, OpsSection, ProductSection,
  RetentionSection, SourcesSection, TopStrip,
} from "@/components/admin-hq/sections";
import { LedgerSection } from "@/components/admin-hq/ledger";

type Preset = "7d" | "30d" | "90d" | "ytd" | "custom";
const PRESETS: { id: Preset; label: string }[] = [
  { id: "7d", label: "7 days" }, { id: "30d", label: "30 days" }, { id: "90d", label: "90 days" },
  { id: "ytd", label: "This year" }, { id: "custom", label: "Custom" },
];

// Calendar dates in America/Toronto, as YYYY-MM-DD.
const torontoDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(d);
const daysAgo = (n: number) => torontoDate(new Date(Date.now() - n * 86_400_000));

function rangeFor(p: Preset, custom: HqRange): HqRange {
  const to = torontoDate(new Date());
  switch (p) {
    case "7d": return { from: daysAgo(6), to };
    case "30d": return { from: daysAgo(29), to };
    case "90d": return { from: daysAgo(89), to };
    case "ytd": return { from: `${to.slice(0, 4)}-01-01`, to };
    default: return custom;
  }
}

export default function AdminHqPage() {
  const { isLoaded, user } = useAuth();
  const demo = useMemo(() => new URLSearchParams(window.location.search).get("demo") === "1", []);
  const client = useMemo(() => getHqClient(demo), [demo]);

  const [preset, setPreset] = useState<Preset>("30d");
  const [custom, setCustom] = useState<HqRange>({ from: daysAgo(29), to: torontoDate(new Date()) });
  const range = useMemo(() => rangeFor(preset, custom), [preset, custom]);
  const validRange = range.from <= range.to;

  const [data, setData] = useState<HqOverview | null>(null);
  const [error, setError] = useState<HqUnavailableError | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!validRange) return;
    setLoading(true); setError(null);
    client.overview(range)
      .then(setData)
      .catch((e) => setError(e instanceof HqUnavailableError ? e : new HqUnavailableError(0, String(e))))
      .finally(() => setLoading(false));
  }, [client, range, validRange]);
  useEffect(load, [load]);

  useEffect(() => { document.title = "Owner HQ | QuoteAI"; }, []);

  if (!isLoaded) return <div className="min-h-screen bg-slate-50" aria-busy="true" />;
  const forbidden = error?.status === 403;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur px-4 py-3">
        <div className="mx-auto max-w-6xl flex items-center gap-3">
          <Link href="/dashboard/admin" aria-label="Back to admin" className="h-11 w-11 shrink-0 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:text-slate-900">
            <ArrowLeft aria-hidden className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold truncate">Owner HQ</h1>
            <p className="text-xs text-slate-500 truncate">{demo ? "Demo data, not real" : user?.email}</p>
          </div>
          <button type="button" onClick={load} className={btnCls} aria-label="Refresh data">
            <RefreshCw aria-hidden className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /><span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 space-y-8">
        {demo && (
          <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Demo mode: every number on this page is a made-up fixture for reviewing the layout.
          </p>
        )}

        <fieldset className="min-w-0">
          <legend className="text-xs font-semibold text-slate-600 mb-1.5">Date range (America/Toronto)</legend>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" onClick={() => setPreset(p.id)} aria-pressed={preset === p.id}
                className={`h-11 px-4 rounded-lg text-sm font-semibold border focus:outline-none focus:ring-2 focus:ring-navy-500 ${preset === p.id ? "bg-navy-600 text-white border-navy-600" : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50"}`}>
                {p.label}
              </button>
            ))}
          </div>
          {preset === "custom" && (
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:max-w-md">
              <label className="block"><span className="block text-xs font-medium text-slate-700 mb-1">From</span>
                <input type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className={inputCls} /></label>
              <label className="block"><span className="block text-xs font-medium text-slate-700 mb-1">To</span>
                <input type="date" value={custom.to} min={custom.from} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className={inputCls} /></label>
            </div>
          )}
          {!validRange && <p role="alert" className="mt-2 text-sm text-red-700">The start date must be on or before the end date.</p>}
        </fieldset>

        {error && forbidden ? (
          <div role="alert" className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <ShieldAlert aria-hidden className="mx-auto h-8 w-8 text-red-600" />
            <h2 className="mt-2 text-lg font-bold">Owner access only</h2>
            <p className="text-sm text-slate-600 mt-1">This page is for the QuoteAI owner account.</p>
            <Link href="/dashboard" className={`${btnCls} mt-4`}>Back to dashboard</Link>
          </div>
        ) : error ? (
          <div role="alert" className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <ServerCrash aria-hidden className="mx-auto h-8 w-8 text-slate-500" />
            <h2 className="mt-2 text-lg font-bold">HQ data is not available yet</h2>
            <p className="text-sm text-slate-600 mt-1">The HQ endpoints did not answer ({error.status || "network"}). You can retry, or add ?demo=1 to the address to review the layout.</p>
            <button type="button" onClick={load} className={`${btnCls} mt-4`}><RefreshCw aria-hidden className="h-4 w-4" />Retry</button>
          </div>
        ) : loading && !data ? (
          <div aria-busy="true" aria-label="Loading HQ data" className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
            <Skeleton className="h-72" /><Skeleton className="h-48" />
          </div>
        ) : data ? (
          <div className={`space-y-8 transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
            <Notes notes={data.notes} />
            <TopStrip o={data} />
            <MoneySection o={data} client={client} />
            <CustomersSection o={data} client={client} />
            <FunnelSection o={data} />
            <SourcesSection o={data} />
            <RetentionSection client={client} />
            <ProductSection o={data} />
            <OpsSection o={data} />
            <LedgerSection client={client} range={range} cashCents={data.money.cashCents} onChanged={load} demo={demo} />
          </div>
        ) : null}
      </main>
    </div>
  );
}
