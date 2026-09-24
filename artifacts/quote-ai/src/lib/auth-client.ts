import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "",
  basePath: `${BASE}/api/auth`,
  plugins: [twoFactorClient()],
  // Phase 93: the verification, reset and welcome emails follow the language
  // the site is shown in (LanguageContext keeps <html lang> current).
  fetchOptions: {
    onRequest: (ctx) => {
      const lang = typeof document !== "undefined" ? document.documentElement.lang : "";
      if (lang === "fr" || lang === "en") ctx.headers.set("x-quoteai-lang", lang);
      return ctx;
    },
  },
});
