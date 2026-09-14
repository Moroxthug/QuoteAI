import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "",
  basePath: `${BASE}/api/auth`,
  plugins: [twoFactorClient()],
});
