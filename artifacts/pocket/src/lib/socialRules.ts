// Which sign-in buttons a phone shows. Pure, so the rule is tested (socialRules.test.ts).
export type Provider = "google" | "apple";

/** What the server has turned on, on a phone that can do it. Apple's sheet exists only on iOS; the web build has neither. */
export function shownMethods(m: { google: string | null; apple: boolean }, platform: string): Provider[] {
  if (platform === "web") return [];
  return [...(m.apple && platform === "ios" ? (["apple"] as const) : []), ...(m.google ? (["google"] as const) : [])];
}
