// Owner HQ: test and QA accounts are not customers. The SQL fragment in service.ts uses these same rules.

export const TEST_USER_PREFIXES = ["e2e_", "pocket127"] as const;
export const TEST_EMAIL_SUFFIX = "@example.invalid";

export function isTestAccount(userId: string | null | undefined, email?: string | null): boolean {
  if (userId && TEST_USER_PREFIXES.some((p) => userId.startsWith(p))) return true;
  return !!email && email.toLowerCase().endsWith(TEST_EMAIL_SUFFIX);
}
