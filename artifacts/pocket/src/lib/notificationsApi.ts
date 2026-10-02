// Notifications: the server calls (routes/notifications.ts).
import { api } from "./api";
import type { NotificationsResponse } from "./notifications";

export const notificationsApi = {
  list: () => api<NotificationsResponse>("/api/notifications?limit=100"),
  /** The ones given, or every unread one when none are. */
  read: (ids?: string[]) => api<{ success: boolean }>("/api/notifications/read", { method: "POST", body: ids ? { ids } : {} }),
};
