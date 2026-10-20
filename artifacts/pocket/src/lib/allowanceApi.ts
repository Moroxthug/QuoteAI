// GET /api/me/allowance: the free-quote counter and whether the account is blocked.
import { api } from "./api";
import type { Allowance } from "./allowance";

export const allowanceApi = {
  get: () => api<Allowance>("/api/me/allowance"),
};
