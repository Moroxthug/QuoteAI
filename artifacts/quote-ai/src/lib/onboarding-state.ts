const SKIP_KEY = (userId: string) => `quoteai_onboarding_skipped_${userId}`;

export function markOnboardingSkipped(userId: string): void {
  try { localStorage.setItem(SKIP_KEY(userId), "1"); } catch {}
}

export function markOnboardingDone(userId: string): void {
  try { localStorage.removeItem(SKIP_KEY(userId)); } catch {}
}

export function isOnboardingSkipped(userId: string): boolean {
  try { return localStorage.getItem(SKIP_KEY(userId)) === "1"; } catch { return false; }
}
