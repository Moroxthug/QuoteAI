// Google and Apple: the phone's own sheet hands back an ID token, the server checks it and answers with a session
// (api-server lib/auth.ts). Each native module loads only when its button is tapped, so the web build never touches them.
import * as Crypto from "expo-crypto";
import { auth, type AuthResult, type SocialMethods } from "./auth";
import type { Provider } from "./socialRules";

async function google(clientId: string): Promise<AuthResult | null> {
  const { GoogleSignin, isSuccessResponse } = await import("@react-native-google-signin/google-signin");
  GoogleSignin.configure({ webClientId: clientId });
  await GoogleSignin.hasPlayServices();
  const r = await GoogleSignin.signIn();
  if (!isSuccessResponse(r)) return null;
  if (!r.data.idToken) return { ok: false, problem: "failed" };
  return auth.socialSignIn("google", { token: r.data.idToken });
}

async function apple(): Promise<AuthResult | null> {
  const A = await import("expo-apple-authentication");
  const nonce = Crypto.randomUUID();
  try {
    const r = await A.signInAsync({ requestedScopes: [A.AppleAuthenticationScope.FULL_NAME, A.AppleAuthenticationScope.EMAIL], nonce });
    if (!r.identityToken) return { ok: false, problem: "failed" };
    // Apple gives the name only the first time, and only here: it is not in the token.
    const user = r.fullName?.givenName ? { name: { firstName: r.fullName.givenName, lastName: r.fullName.familyName ?? "" }, email: r.email ?? undefined } : undefined;
    return await auth.socialSignIn("apple", { token: r.identityToken, nonce, user });
  } catch (e) {
    if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") return null;
    throw e;
  }
}

/** null: the person closed the sheet. */
export async function signInWith(provider: Provider, m: SocialMethods): Promise<AuthResult | null> {
  try {
    return await (provider === "google" ? google(m.google ?? "") : apple());
  } catch {
    return { ok: false, problem: "failed" };
  }
}
