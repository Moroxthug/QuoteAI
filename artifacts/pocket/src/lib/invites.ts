// Invitations (Invites.dc.html): what the screen shows and how the server's answers map to its states.

/** The board's states. `picker` follows accepting two invitations; the rest follow the data. */
export type InviteView = "single" | "multiple" | "picker" | "wrongAccount" | "expired";
/** What the person decided for one invitation before Continue (the board keeps it until then). */
export type Answer = "yes" | "no" | "";

export function viewFor(count: number): "single" | "multiple" | null {
  return count === 0 ? null : count === 1 ? "single" : "multiple";
}

/** The emailed link's preview or accept answered with an error. */
export type TokenProblem = "expired" | "wrongAccount" | "accepted" | "invalid" | "offline" | "failed";

export function tokenProblem(failure: { status: number; code?: string }): TokenProblem {
  if (failure.status === 0) return "offline";
  switch (failure.code) {
    case "EXPIRED": return "expired";
    case "EMAIL_MISMATCH": return "wrongAccount";
    case "ALREADY_ACCEPTED": return "accepted";
    case "NOT_FOUND": return "invalid";
  }
  if (failure.status === 410) return "expired";
  if (failure.status === 404) return "invalid";
  return "failed";
}

export function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** The invitations the person said yes to, in list order. */
export function accepted<T extends { id: string }>(invites: T[], answers: Record<string, Answer>): T[] {
  return invites.filter((i) => answers[i.id] === "yes");
}

/** After accepting: the companies that were not in the list before. */
export function joinedOrgs<T extends { orgId: string }>(before: T[], after: T[]): T[] {
  const had = new Set(before.map((o) => o.orgId));
  return after.filter((o) => !had.has(o.orgId));
}

export function initialsOf(text: string | null | undefined): string {
  const words = (text ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = [...words[0]!][0] ?? "";
  const second = words.length > 1 ? [...words[words.length - 1]!][0] ?? "" : [...words[0]!][1] ?? "";
  return (first + second).toUpperCase();
}

/** A sentence with some words in bold (the board's "<b>Marco</b> invited you to <b>Rossi</b>"): the pieces, in order. */
export function boldSplit(sentence: string, bolds: string[]): { text: string; bold: boolean }[] {
  const words = bolds.filter(Boolean);
  if (words.length === 0) return [{ text: sentence, bold: false }];
  const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(${words.map(escape).join("|")})`);
  return sentence.split(pattern).filter((p) => p !== "").map((text) => ({ text, bold: words.includes(text) }));
}
