// ServiceCalls (ServiceCalls.dc.html): types from routes/service-calls.ts and the rules the screen uses. Pure, so they are tested (serviceCalls.test.ts).
export type ServiceCall = {
  id: string; projectId: string; jobName: string | null; clientName: string | null; jobDoneAt: string | null; warrantyEndsAt: string | null; underWarranty: boolean;
  issue: string; note: string; reportedBy: string; channel: "phone" | "email" | "portal" | "text" | "in_person"; status: "open" | "booked" | "done"; billing: "warranty" | "billable"; amountCents: number;
  visitStartsAt: string | null; visitEndsAt: string | null; workerId: string | null; workerName: string | null; reportedAt: string; doneAt: string | null;
};
export type WarrantyRow = { projectId: string; jobName: string; clientName: string | null; completedAt: string; endsAt: string; covered: boolean; elapsedPercent: number };
export type ServiceView = { calls: ServiceCall[]; warranty: WarrantyRow[]; warrantyMonths: number; kpis: { open: number; booked: number; underWarranty: number; firstVisitDays: number | null } };

/** The arrival windows a visit can be booked in (local hours). */
export const WINDOWS: { from: number; to: number }[] = [{ from: 8, to: 10 }, { from: 10, to: 12 }, { from: 13, to: 15 }];

/** The next `count` working days (Monday to Friday) after `from`, starting with `from` itself when it is one and before 13:00 (the last window starts then). */
export function visitDays(from: Date, count = 4): Date[] {
  const out: Date[] = [];
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  if (from.getHours() >= 13) d.setDate(d.getDate() + 1);
  while (out.length < count) {
    if (d.getDay() !== 0 && d.getDay() !== 6) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Whether a window on `day` has not started yet at `now`. */
export function windowOpen(day: Date, window: number, now: Date): boolean {
  const w = WINDOWS[window] ?? WINDOWS[0]!;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), w.from, 0, 0).getTime() > now.getTime();
}

/** The first window still open on `day`, or 0. */
export function firstOpenWindow(day: Date, now: Date): number {
  const i = WINDOWS.findIndex((_, k) => windowOpen(day, k, now));
  return i < 0 ? 0 : i;
}

/** The instants of a visit: the day with the window's local hours. */
export function visitRange(day: Date, window: number): { startsAt: string; endsAt: string } {
  const w = WINDOWS[window] ?? WINDOWS[0]!;
  const at = (h: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, 0, 0).toISOString();
  return { startsAt: at(w.from), endsAt: at(w.to) };
}

export function openCalls(calls: ServiceCall[]): ServiceCall[] { return calls.filter((c) => c.status !== "done"); }
export function doneCalls(calls: ServiceCall[]): ServiceCall[] { return calls.filter((c) => c.status === "done"); }

/** The warranty line of a call's job: how long it runs, or that it has ended / the job isn't finished. */
export type WarrantyState = "covered" | "ended" | "unfinished";
export function warrantyState(c: Pick<ServiceCall, "underWarranty" | "warrantyEndsAt">): WarrantyState {
  if (!c.warrantyEndsAt) return "unfinished";
  return c.underWarranty ? "covered" : "ended";
}

/** The warranty row's tone: ended, ending within about 90 days (the bar passes 75 %), or covered. */
export function warrantyTone(w: Pick<WarrantyRow, "covered" | "elapsedPercent">): "ended" | "soon" | "covered" {
  if (!w.covered) return "ended";
  return w.elapsedPercent >= 75 ? "soon" : "covered";
}
