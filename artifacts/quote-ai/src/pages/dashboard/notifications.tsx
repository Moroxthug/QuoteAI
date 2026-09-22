import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/i18n/LanguageContext";
import { PushToggle } from "@/components/pwa/push-toggle";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

const QUERY_KEY = ["notifications", "page"];

async function fetchNotifications(): Promise<{ items: NotificationItem[]; unread: number }> {
  const res = await fetch("/api/notifications?limit=100", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load notifications");
  return res.json();
}

function dotColor(type: string): "green" | "teal" | "yellow" | "grey" {
  if (/accepted|signed|paid$/.test(type)) return "green";
  if (/invoice|payment/.test(type)) return "teal";
  if (/due|overdue|reminder/.test(type)) return "yellow";
  return "grey";
}

export default function NotificationsPage() {
  const { t, lang } = useLanguage();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: fetchNotifications, staleTime: 30_000 });
  const markRead = useMutation({
    mutationFn: async (ids?: string[]) => {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(ids ? { ids } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;
  const locale = lang === "fr" ? frCA : enCA;

  return (
    <div className="animate-in fade-in duration-500">
      <div className="page-head">
        <div>
          <h1>{t("notifications.title")}</h1>
          <p className="sub">{t("notifications.page.subtitle")}</p>
        </div>
        {unread > 0 && (
          <div className="head-actions">
            <button type="button" className="btn btn-outline-navy btn-sm gap-1.5" onClick={() => markRead.mutate(undefined)}>
              <CheckCheck className="h-4 w-4" /> {t("notifications.page.markAllRead")}
            </button>
          </div>
        )}
      </div>

      <PushToggle />

      <div className="card">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full rounded-[var(--radius-sm)]" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-14 px-5">
            <Bell className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-20" />
            <p className="text-sm" style={{ color: "var(--muted-mk)" }}>{t("notifications.empty")}</p>
          </div>
        ) : (
          items.map((n) => {
            const row = (
              <div className={`n-row${!n.readAt ? " unread" : ""}`}>
                <span className={`n-dot ${dotColor(n.type)}`} />
                <div>
                  <b>{n.title}</b>
                  {n.body && <p>{n.body}</p>}
                </div>
                <span className="n-time">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale })}</span>
              </div>
            );
            return n.link ? (
              <Link key={n.id} href={n.link} onClick={() => !n.readAt && markRead.mutate([n.id])} className="block">
                {row}
              </Link>
            ) : (
              <div key={n.id} onClick={() => !n.readAt && markRead.mutate([n.id])} className="cursor-pointer">
                {row}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
