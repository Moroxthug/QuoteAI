// The quote-ai Vite dev server, proxied at an in-process API — shared by the
// qa:visual sweep (Phase 67) and the browser walks that need the real SPA
// (Phase 93: sign-up, onboarding, /join, /team-invite).

import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../../../..");
let vite: ChildProcess | null = null;

/** Starts Vite on `port` (strict) with /api proxied to `apiBase`; resolves with its origin. */
export async function startVite(port: number, apiBase: string): Promise<string> {
  const url = `http://localhost:${port}`;
  // A stale server from an aborted run would answer the health check below
  // and then vanish under us — refuse to share the port.
  const busy = await fetch(url, { signal: AbortSignal.timeout(1500) }).then(() => true, () => false);
  if (busy) throw new Error(`port ${port} is already in use (a previous run's vite? pass another port)`);
  vite = spawn("pnpm", ["--filter", "@workspace/quote-ai", "exec", "vite", "--port", String(port), "--strictPort", "--clearScreen", "false"], {
    cwd: ROOT,
    env: { ...process.env, API_PROXY_TARGET: apiBase, PORT: String(port), BROWSER: "none" },
    shell: process.platform === "win32", // pnpm is a .cmd here and node refuses those without a shell
    stdio: ["ignore", "pipe", "pipe"],
  });
  vite.stderr?.on("data", (d) => process.stderr.write(`[vite] ${d}`));
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (r.ok) return url;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`vite did not come up on ${url}`);
}

export async function stopVite(): Promise<void> {
  if (!vite?.pid) return;
  const child = vite;
  vite = null;
  if (process.platform === "win32") {
    // `shell: true` means the pid is cmd.exe → pnpm → node; /T takes the tree.
    await new Promise<void>((done) => spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" }).on("exit", () => done()));
  } else {
    child.kill("SIGTERM");
    await new Promise<void>((done) => child.on("exit", () => done()));
  }
}
