// Phase 118: the phone app's sign-in. The bundled app is not on quoteai.ca, so
// the session cookie would be a third-party cookie; instead better-auth's
// bearer plugin hands the session token back in `set-auth-token` and the app
// sends it as `Authorization: Bearer …`. It lives in the phone's keystore /
// keychain (secure storage), with the acting company beside it (the website
// keeps that in a cookie, the app in the X-Active-Org header).

const TOKEN_KEY = "session-token";
const ORG_KEY = "active-org";

let token: string | null = null;
let activeOrg: string | null = null;

type Store = { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void>; remove(key: string): Promise<void> };
let store: Promise<Store | null> | null = null;

function secureStore(): Promise<Store | null> {
  store ??= import("@aparajita/capacitor-secure-storage")
    .then(async ({ SecureStorage }) => {
      await SecureStorage.setKeyPrefix("quoteai_");
      return {
        get: (k: string) => SecureStorage.getItem(k),
        set: (k: string, v: string) => SecureStorage.setItem(k, v),
        remove: (k: string) => SecureStorage.removeItem(k),
      };
    })
    .catch(() => null);
  return store;
}

let loaded: Promise<void> | null = null;

/** Resolves once the saved token (if any) is loaded; every API call waits for it. */
export function sessionReady(): Promise<void> {
  loaded ??= (async () => {
    const s = await secureStore();
    if (!s) return;
    try {
      const [savedToken, savedOrg] = await Promise.all([s.get(TOKEN_KEY), s.get(ORG_KEY)]);
      // A sign-in that answered while this was loading wins.
      token ??= savedToken;
      activeOrg ??= savedOrg;
    } catch {
      /* nothing saved, or the keystore is unavailable: signed out */
    }
  })();
  return loaded;
}

export function sessionToken(): string | null {
  return token;
}

export function activeOrgId(): string | null {
  return activeOrg;
}

async function save(key: string, value: string | null): Promise<void> {
  const s = await secureStore();
  if (!s) return;
  try {
    if (value) await s.set(key, value);
    else await s.remove(key);
  } catch {
    /* the in-memory value still serves this run */
  }
}

export function setSessionToken(next: string | null): void {
  if (next === token) return;
  token = next;
  void save(TOKEN_KEY, next);
}

export function setActiveOrgId(next: string | null): void {
  if (next === activeOrg) return;
  activeOrg = next;
  void save(ORG_KEY, next);
}

/** Signed out (or the account is gone): forget the token and the company. */
export function clearSession(): void {
  setSessionToken(null);
  setActiveOrgId(null);
}
