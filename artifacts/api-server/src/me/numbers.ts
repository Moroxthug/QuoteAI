// Pocket 128.3 (Profile → My numbers): what one person did in a period, from what carries their name (quotes and invoices they made, jobs they opened):
// quotes made and sent, how many of those sent were won, what they invoiced, and jobs. Pure, so it is tested (numbers.test.ts); the route reads the rows.

export type Period = "month" | "quarter" | "year";
export type QuoteRow = { createdAt: Date; sentAt: Date | null; acceptedAt: Date | null; accepted: boolean };
export type InvoiceRow = { issueDate: Date; totalCents: number; status: string };
export type JobRow = { createdAt: Date; status: string };

export type Window = { from: Date; to: Date };

/** The first day (UTC midnight of the company's calendar day) of the period that holds `day` (YYYY-MM-DD), and of the one after. */
export function periodWindow(period: Period, day: string, back = 0): { start: string; end: string } {
  const [y, m] = day.split("-").map(Number) as [number, number, number];
  const idx = period === "year" ? y - back : period === "quarter" ? Math.floor((m - 1) / 3) - back : m - 1 - back;
  if (period === "year") return { start: `${idx}-01-01`, end: `${idx + 1}-01-01` };
  const span = period === "quarter" ? 3 : 1;
  const first = period === "quarter" ? idx * 3 : idx;
  const at = (months: number) => {
    const total = y * 12 + months;
    const yy = Math.floor(total / 12);
    return `${yy}-${String((total % 12) + 1).padStart(2, "0")}-01`;
  };
  return { start: at(first), end: at(first + span) };
}

export type Numbers = { made: number; sent: number; won: number; wonPercent: number | null; invoicedCents: number; jobs: number; activeJobs: number };

const within = (d: Date | null, w: Window) => !!d && d >= w.from && d < w.to;

export function numbersFor(w: Window, quotes: QuoteRow[], invoices: InvoiceRow[], jobs: JobRow[]): Numbers {
  const made = quotes.filter((q) => within(q.createdAt, w));
  const sent = quotes.filter((q) => within(q.sentAt, w));
  const won = sent.filter((q) => q.accepted);
  const invoiced = invoices.filter((i) => within(i.issueDate, w) && !["draft", "void"].includes(i.status));
  const opened = jobs.filter((j) => within(j.createdAt, w));
  return {
    made: made.length, sent: sent.length, won: won.length, wonPercent: sent.length ? Math.round((won.length / sent.length) * 100) : null,
    invoicedCents: invoiced.reduce((n, i) => n + i.totalCents, 0), jobs: opened.length, activeJobs: jobs.filter((j) => j.status === "active").length,
  };
}
