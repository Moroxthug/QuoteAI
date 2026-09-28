// Phase 119: this installed app's own id, made once and kept in its storage.
// The API keeps one push token per install (device_tokens.install_id), so a
// token FCM rotates replaces the old one and sign-out forgets exactly this app.

const KEY = "quoteai.installId";
let memo: string | null = null;

export function newInstallId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function installId(): string {
  if (memo) return memo;
  try {
    memo = localStorage.getItem(KEY);
    if (!memo || !/^[a-f0-9]{32}$/.test(memo)) {
      memo = newInstallId();
      localStorage.setItem(KEY, memo);
    }
  } catch {
    memo ??= newInstallId();
  }
  return memo;
}
