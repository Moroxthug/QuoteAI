import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLanguage } from "@/i18n/LanguageContext";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

const QUERY_KEY = ["notifications"];

async function fetchNotifications(): Promise<{ items: NotificationItem[]; unread: number }> {
  const res = await fetch("/api/notifications?limit=20", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load notifications");
  return res.json();
}

/**
 * Notifications entry point — a `.bell` icon button in the topbar, or a
 * `.sb-link`-styled trigger in the sidebar's bottom block — both open the
 * same `.pop` popover with the latest in-app notifications.
 */
export function NotificationsBell({ variant = "topbar", side = "bottom", align = "end" }: { variant?: "topbar" | "sidebar"; side?: "right" | "bottom"; align?: "start" | "end" }) {
  const { t, lang } = useLanguage();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: QUERY_KEY, queryFn: fetchNotifications, refetchInterval: 60_000, staleTime: 30_000 });
  const markRead = useMutation({
    mutationFn: async (ids?: string[]) => {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(ids ? { ids } : {}),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];
  const locale = lang === "fr" ? frCA : enCA;

  if (variant === "sidebar") {
    return (
      <Link href="/dashboard/notifications" className="sb-link" aria-label={t("notifications.title")}>
        <Bell className="ic" />
        <span className="sb-txt">{t("notifications.title")}</span>
        {unread > 0 && <span className="count-chip">{unread > 99 ? "99+" : unread}</span>}
      </Link>
    );
  }

  const trigger = (
    <button type="button" className="bell bell-wrap" aria-label={t("notifications.title")}>
      <Bell className="ic" />
      {unread > 0 && <span className="dot" />}
    </button>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent side={side} align={align} sideOffset={10} className="pop p-0 border-0 shadow-none">
        <div className="flex items-center justify-between">
          <h3 className="!border-0 !pb-2 flex-1">{t("notifications.title")}</h3>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => markRead.mutate(undefined)}
              className="text-xs text-[var(--navy)] hover:underline flex items-center gap-1 pr-4 shrink-0"
            >
              <CheckCheck className="h-3.5 w-3.5" /> {t("notifications.markAllRead")}
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t("notifications.empty")}</div>
          ) : (
            items.map((n) => {
              const inner = (
                <div
                  className="pop-row cursor-pointer transition-colors hover:bg-[var(--soft)]"
                  style={!n.readAt ? { background: "var(--soft-2)" } : undefined}
                >
                  <b>{n.title}</b>
                  <span>{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale })}</span>
                  {n.body && <p>{n.body}</p>}
                </div>
              );
              return n.link ? (
                <Link key={n.id} href={n.link} onClick={() => !n.readAt && markRead.mutate([n.id])} className="block">
                  {inner}
                </Link>
              ) : (
                <div key={n.id} onClick={() => !n.readAt && markRead.mutate([n.id])}>{inner}</div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
