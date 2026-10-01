import { describe, expect, test } from "vitest";
import { buildDetail, buildOverview, lastActivityOf, type ClientFacts, type InvoiceFacts, type JobFacts, type QuoteFacts } from "./overview.js";

const now = new Date("2026-09-29T15:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);

const client = (o: Partial<ClientFacts> = {}): ClientFacts => ({ id: "c1", type: "individual", name: "Tom & Lena Hart", email: "lena@x.ca", phone: "4165550148", address: "48 Galloway Rd", city: "Scarborough", province: "ON", postalCode: null, businessNumber: null, preferredLanguage: "en", notes: "", createdAt: ago(60), ...o });
const quote = (o: Partial<QuoteFacts> = {}): QuoteFacts => ({ id: "q1", clientId: "c1", status: "draft", totalCents: 100_000, title: null, number: null, createdAt: ago(5), sentAt: null, firstViewedAt: null, acceptedAt: null, declinedAt: null, validDays: null, description: "", ...o });
const invoice = (o: Partial<InvoiceFacts> = {}): InvoiceFacts => ({ id: "i1", clientId: "c1", number: "INV-0412", type: "progress", status: "sent", totalCents: 234_000, paidCents: 0, issueDate: ago(30), dueDate: ago(9), sentAt: ago(30), paidAt: null, lastReminderAt: null, customerEmail: "lena@x.ca", projectName: null, ...o });
const job = (o: Partial<JobFacts> = {}): JobFacts => ({ id: "j1", clientId: "c1", name: "Basement finish", status: "active", address: "48 Galloway Rd", progressPercent: 64, contractValueCents: 4_235_500, plannedStart: ago(20), plannedEnd: null, completedAt: null, createdAt: ago(25), ...o });

describe("clients overview", () => {
  test("a client with only a draft is a prospect, with an accepted quote or a job is active", () => {
    const { items } = buildOverview({ clients: [client({ id: "c1" }), client({ id: "c2", name: "Dana" }), client({ id: "c3", name: "Okoye" })], quotes: [quote({ id: "a", clientId: "c1", acceptedAt: ago(2), status: "accepted" }), quote({ id: "b", clientId: "c2" })], invoices: [], jobs: [job({ clientId: "c3" })], now });
    expect(Object.fromEntries(items.map((r) => [r.id, r.status]))).toEqual({ c1: "active", c2: "prospect", c3: "active" });
  });

  test("lifetime is accepted quotes, owed and overdue come from open invoices", () => {
    const { items, stats } = buildOverview({
      clients: [client()],
      quotes: [quote({ id: "a", acceptedAt: ago(40), status: "accepted", totalCents: 395_500 }), quote({ id: "b", totalCents: 99_999 })],
      invoices: [invoice({ id: "late", totalCents: 234_000 }), invoice({ id: "future", number: "INV-2", dueDate: new Date(now.getTime() + 5 * 86_400_000), totalCents: 100_000, paidCents: 40_000 }), invoice({ id: "paid", status: "paid", paidCents: 50_000, totalCents: 50_000 }), invoice({ id: "credit", type: "credit_note", status: "sent", totalCents: 10_000 })],
      jobs: [job()], now,
    });
    const r = items[0]!;
    expect(r.lifetimeCents).toBe(395_500);
    expect(r.owedCents).toBe(234_000 + 60_000);
    expect(r.overdueCount).toBe(1);
    expect(r.overdueCents).toBe(234_000);
    expect(r.activeJobs).toBe(1);
    expect(stats).toMatchObject({ total: 1, active: 1, activeJobs: 1, lifetimeCents: 395_500, owedCents: 294_000, overdueCount: 1 });
  });

  test("a person who cannot see invoices or jobs gets null, not zero", () => {
    const { items, stats } = buildOverview({ clients: [client()], quotes: [], invoices: null, jobs: null, now });
    expect(items[0]!.owedCents).toBeNull();
    expect(items[0]!.overdueCount).toBeNull();
    expect(stats.owedCents).toBeNull();
    expect(items[0]!.status).toBe("prospect");
  });

  test("the year strip splits accepted quotes by year", () => {
    const { stats } = buildOverview({
      clients: [client()],
      quotes: [quote({ id: "a", acceptedAt: new Date("2026-03-01T12:00:00Z"), totalCents: 300_000 }), quote({ id: "b", acceptedAt: new Date("2025-06-01T12:00:00Z"), totalCents: 200_000 })],
      invoices: [], jobs: [], now,
    });
    expect(stats.lifetimeThisYearCents).toBe(300_000);
    expect(stats.lifetimeLastYearCents).toBe(200_000);
  });

  test("most recent activity first, quiet clients last", () => {
    const { items } = buildOverview({
      clients: [client({ id: "old", name: "Old" }), client({ id: "new", name: "New" }), client({ id: "none", name: "A none" })],
      quotes: [quote({ id: "a", clientId: "old", createdAt: ago(50) }), quote({ id: "b", clientId: "new", createdAt: ago(1) })],
      invoices: [], jobs: [], now,
    });
    expect(items.map((r) => r.id)).toEqual(["new", "old", "none"]);
  });

  test("last activity picks the newest event and says which", () => {
    const a = lastActivityOf([quote({ createdAt: ago(10), sentAt: ago(9), firstViewedAt: ago(2), number: "Q-1" })], [invoice({ lastReminderAt: ago(1), number: "INV-9" })], []);
    expect(a?.kind).toBe("invoice_reminded");
    expect(a?.ref).toBe("INV-9");
    expect(lastActivityOf([], [], [])).toBeNull();
  });
});

describe("client detail", () => {
  test("the banner is the most overdue open invoice and says whether a reminder can go", () => {
    const d = buildDetail(client(), [], [invoice({ id: "late9", dueDate: ago(9) }), invoice({ id: "late3", number: "INV-3", dueDate: ago(3) })], [], now, true);
    expect(d.worstOverdue).toMatchObject({ id: "late9", daysLate: 9, canRemind: true });
    const lately = buildDetail(client(), [], [invoice({ lastReminderAt: ago(1) })], [], now, true);
    expect(lately.worstOverdue?.canRemind).toBe(false);
    const viewer = buildDetail(client(), [], [invoice({})], [], now, false);
    expect(viewer.worstOverdue?.canRemind).toBe(false);
    expect(buildDetail(client(), [], [], [], now, true).worstOverdue).toBeNull();
  });

  test("invoiced counts what was sent, not drafts, voids or credit notes", () => {
    const d = buildDetail(client(), [], [invoice({ totalCents: 100 }), invoice({ id: "d", status: "draft", totalCents: 999 }), invoice({ id: "v", status: "void", totalCents: 999 }), invoice({ id: "c", type: "credit_note", totalCents: 50 })], [], now, true);
    expect(d.invoicedCents).toBe(100);
  });

  test("quotes and jobs are newest first, and hidden sections are null", () => {
    const d = buildDetail(client(), [quote({ id: "old", createdAt: ago(9) }), quote({ id: "new", createdAt: ago(1) })], null, null, now, false);
    expect(d.quotes.map((q) => q.id)).toEqual(["new", "old"]);
    expect(d.invoices).toBeNull();
    expect(d.jobs).toBeNull();
    expect(d.invoicedCents).toBeNull();
  });
});
