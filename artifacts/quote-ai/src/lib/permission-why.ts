import { isNativeApp } from "./native/env";

// Phase 121: before the phone asks for the camera or the microphone, one line
// says why — at the moment of use, once per phone, only while the answer is
// still open. (Location says why beside Clock in, lib/location.ts; notifications
// after the first quote, components/pwa/push-ask.tsx.) The website asks the
// browser as before.

export type WhyKind = "camera" | "microphone";

export const WHY_EVENT = "quoteai:permission-why";
export type WhyRequest = { kind: WhyKind; answer: (go: boolean) => void; claimed?: boolean };

const seenKey = (kind: WhyKind) => `quoteai.why.${kind}`;

function explained(kind: WhyKind): boolean {
  try {
    return localStorage.getItem(seenKey(kind)) === "1";
  } catch {
    return true;
  }
}

export function markExplained(kind: WhyKind): void {
  try {
    localStorage.setItem(seenKey(kind), "1");
  } catch {
    /* ignore */
  }
}

async function stillOpen(kind: WhyKind): Promise<boolean> {
  try {
    if (kind === "camera") {
      const { Camera } = await import("@capacitor/camera");
      const p = await Camera.checkPermissions();
      return p.camera === "prompt" || p.camera === "prompt-with-rationale";
    }
    const status = await navigator.permissions?.query({ name: "microphone" as PermissionName });
    return !status || status.state === "prompt";
  } catch {
    return true;
  }
}

/** Resolves true to go on (the phone may then ask), false when the person said "Not now". */
export async function explainFirst(kind: WhyKind): Promise<boolean> {
  if (!isNativeApp || explained(kind)) return true;
  if (!(await stillOpen(kind))) {
    markExplained(kind);
    return true;
  }
  return new Promise<boolean>((resolve) => {
    const request: WhyRequest = { kind, answer: resolve };
    window.dispatchEvent(new CustomEvent<WhyRequest>(WHY_EVENT, { detail: request }));
    // Nothing on screen to explain it (a page outside the signed-in layout, e.g. a crew link): go straight on.
    if (!request.claimed) resolve(true);
  });
}
