import { useGetQuoteStats, useListQuotes } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { format, subMonths, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import { TrendingUp, FileText, Euro, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(v);

const STATUS_COLORS: Record<string, string> = {
  Bozza: "#94a3b8",
  Sbloccato: "#7c3aed",
  "In attesa": "#f59e0b",
};

export default function AnalyticsPage() {
  const { data: stats, isLoading: isLoadingStats } = useGetQuoteStats();
  const { data: allQuotes, isLoading: isLoadingQuotes } = useListQuotes();

  const isLoading = isLoadingStats || isLoadingQuotes;

  const monthlyData = (() => {
    if (!allQuotes) return [];
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const start = startOfMonth(subMonths(now, 5 - i));
      const end = startOfMonth(subMonths(now, 5 - i - 1));
      return { label: format(start, "MMM", { locale: it }), start, end, count: 0 };
    });
    // Last bucket end = start of next month (any quote this month)
    months[5].end = startOfMonth(subMonths(now, -1));
    for (const q of allQuotes) {
      const created = new Date(q.createdAt);
      for (const m of months) {
        if (created >= m.start && created < m.end) {
          m.count++;
          break;
        }
      }
    }
    return months;
  })();

  const statusData = stats
    ? [
        { name: "Bozza", value: stats.draft },
        { name: "Sbloccato", value: stats.unlocked },
        { name: "In attesa", value: stats.pendingPayment },
      ].filter(d => d.value > 0)
    : [];

  const statCards = [
    {
      label: "Preventivi totali",
      value: stats?.total ?? 0,
      sub: `${stats?.thisMonth ?? 0} questo mese`,
      icon: <FileText className="h-5 w-5 text-violet-500" />,
      format: (v: number) => String(v),
    },
    {
      label: "Fatturato quotato",
      value: stats?.totalRevenue ?? 0,
      sub: `${formatCurrency(stats?.unlockedRevenue ?? 0)} sbloccato`,
      icon: <Euro className="h-5 w-5 text-emerald-500" />,
      format: formatCurrency,
    },
    {
      label: "Valore medio",
      value: stats?.avgValue ?? 0,
      sub: "per preventivo",
      icon: <TrendingUp className="h-5 w-5 text-blue-500" />,
      format: formatCurrency,
    },
    {
      label: "Sbloccati",
      value: stats?.unlocked ?? 0,
      sub: stats?.total ? `${Math.round((stats.unlocked / stats.total) * 100)}% del totale` : "—",
      icon: <CheckCircle2 className="h-5 w-5 text-amber-500" />,
      format: (v: number) => String(v),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">Statistiche dettagliate sui tuoi preventivi.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, sub, icon, format: fmt }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
                <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center">{icon}</div>
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-foreground">{fmt(value)}</div>
                  <div className="text-xs text-muted-foreground mt-1">{sub}</div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Bar chart: preventivi per mese */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Preventivi per mese</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    formatter={(v: number) => [v, "Preventivi"]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#7c3aed" maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Donut: status breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Distribuzione stato</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : statusData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Nessun dato</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3}>
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number, name: string) => [v, name]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent quotes */}
      {stats && stats.recentQuotes.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Preventivi recenti</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {stats.recentQuotes.map(q => (
                <Link key={q.id} href={`/dashboard/quotes/${q.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{q.clientData?.nome || "Cliente non specificato"}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{format(new Date(q.createdAt), "dd MMM yyyy", { locale: it })}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      q.status === "unlocked" ? "bg-violet-100 text-violet-700" :
                      q.status === "pending_payment" ? "bg-amber-100 text-amber-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {q.status === "unlocked" ? "Sbloccato" : q.status === "pending_payment" ? "In attesa" : "Bozza"}
                    </span>
                    <span className="font-semibold text-sm">{formatCurrency(q.totale)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
