// Every email the mocked Resend SDK "sends" during an e2e run lands here (see
// vitest.e2e.setup.ts). Tests read it to assert a message went out and to
// whom, without any real delivery.
export type SentEmail = { to: string[]; subject: string; from: string };
export const sentEmails: SentEmail[] = [];

export function emailsTo(address: string): SentEmail[] {
  const a = address.toLowerCase();
  return sentEmails.filter((m) => m.to.some((t) => t.toLowerCase() === a));
}
