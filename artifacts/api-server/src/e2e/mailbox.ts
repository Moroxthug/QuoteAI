// Every email the mocked Resend SDK "sends" during an e2e run lands here (see
// vitest.e2e.setup.ts). Tests read it to assert a message went out and to
// whom, without any real delivery.
export type SentEmail = { to: string[]; subject: string; from: string; html: string };
export const sentEmails: SentEmail[] = [];

export function emailsTo(address: string): SentEmail[] {
  const a = address.toLowerCase();
  return sentEmails.filter((m) => m.to.some((t) => t.toLowerCase() === a));
}

/** Every http(s) link in an email body — the auth flows (verify, reset) are driven by these. */
export function linksIn(mail: SentEmail): string[] {
  return [...mail.html.matchAll(/href="([^"]+)"/g)].map((x) => x[1]!.replace(/&amp;/g, "&"));
}
