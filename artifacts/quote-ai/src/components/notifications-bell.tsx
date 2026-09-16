import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
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
 * Sidebar entry showing the unread count; opens a popover with the latest
 * in-app notifications (quote accepted, and from Phase 1 on: contract
 * signed, invoice paid…). Polls every minute — cheap, and enough for a
 * contractor checking the dashboard between site visits.
 */
export function NotificationsBell({ collapsed }: { collapsed: boolean }) {
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

  const trigger = (
    <button
      type="button"
      className={cn(
        "relative flex items-center gap-2.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",
        collapsed ? "h-9 w-9 mx-auto justify-center" : "w-full px-2.5 py-2",
      )}
      aria-label={t("notifications.title")}
    >
      <Bell className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="flex-1 text-sm text-left">{t("notifications.title")}</span>}
      {unread > 0 && (
        <span
          className={cn(
            "min-w-[18px] h-[18px] px-1 rounded-full bg-navy-600 text-white text-[10px] font-bold flex items-center justify-center",
            collapsed && "absolute -top-1 -right-1",
          )}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );

  return (
    <Popover>
      {collapsed ? (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">{t("notifications.title")}</TooltipContent>
        </Tooltip>
      ) : (
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      )}
      <PopoverContent side="right" align="start" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-semibold">{t("notifications.title")}</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => markRead.mutate(undefined)}
              className="text-xs text-navy-600 hover:text-navy-800 flex items-center gap-1"
            >
              <CheckCheck className="h-3.5 w-3.5" /> {t("notifications.markAllRead")}
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">{t("notifications.empty")}</div>
          ) : (
            items.map((n) => {
              const inner = (
                <div className={cn("px-3 py-2.5 border-b last:border-b-0 hover:bg-accent transition-colors", !n.readAt && "bg-navy-50/60 dark:bg-navy-500/15")}>
                  <div className="flex items-start gap-2">
                    {!n.readAt && <span className="h-2 w-2 rounded-full bg-navy-600 mt-1.5 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground leading-snug">{n.title}</div>
                      {n.body && <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{n.body}</div>}
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale })}
                      </div>
                    </div>
                  </div>
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
