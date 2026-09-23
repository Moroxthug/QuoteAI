// Phase 85 — Settings → Integrations: the two halves of the calendar that do
// not need an OAuth app.
//
//   Subscribe: any .ics URL (Calendly, Apple, a municipal inspection feed)
//              becomes read-only context in the dashboard calendar.
//   Publish:   one private .ics URL serving QuoteAI's own schedule, so any
//              calendar app can subscribe without QuoteAI writing to it.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Copy, Link2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";
import { cn } from "@/lib/utils";
import { calendarApi } from "@/lib/calendar-api";

const FEEDS_KEY = ["calendar-feeds"];
const PUBLISH_KEY = ["calendar-publish"];

/** The server answers with a code, not a sentence: turn it into one here. */
function feedErrorKey(message: string): string {
  if (message.includes("HTTPS_REQUIRED")) return "dashboard.settings.calendarFeeds.errorHttps";
  if (message.includes("PRIVATE_HOST")) return "dashboard.settings.calendarFeeds.errorPrivate";
  if (message.includes("NO_CREDENTIALS")) return "dashboard.settings.calendarFeeds.errorCredentials";
  if (message.includes("TOO_MANY_FEEDS")) return "dashboard.settings.calendarFeeds.errorTooMany";
  if (message.includes("INVALID_URL")) return "dashboard.settings.calendarFeeds.errorUrl";
  return "dashboard.settings.calendarFeeds.error";
}

export function CalendarFeedsCard() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const can = useCan();
  const queryClient = useQueryClient();
  const editable = can("integrations", "full");

  const feeds = useQuery({ queryKey: FEEDS_KEY, queryFn: () => calendarApi.feeds(), retry: false });
  const publish = useQuery({ queryKey: PUBLISH_KEY, queryFn: () => calendarApi.publishState(), retry: false });

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const invalidateFeeds = () => queryClient.invalidateQueries({ queryKey: FEEDS_KEY });

  const addFeed = useMutation({
    mutationFn: () => calendarApi.addFeed(name.trim(), url.trim()),
    onSuccess: (res) => {
      setName("");
      setUrl("");
      invalidateFeeds();
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
      toast({
        title: res.feed.lastStatus === "ok"
          ? t("dashboard.settings.calendarFeeds.added").replace("{count}", String(res.events))
          : res.feed.lastError ?? t("dashboard.settings.calendarFeeds.error"),
        variant: res.feed.lastStatus === "ok" ? undefined : "destructive",
      });
    },
    onError: (e: Error) => toast({ title: t(feedErrorKey(e.message)), variant: "destructive" }),
  });

  const toggleFeed = useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) => calendarApi.setFeedEnabled(id, isEnabled),
    onSuccess: invalidateFeeds,
  });

  const removeFeed = useMutation({
    mutationFn: (id: string) => calendarApi.deleteFeed(id),
    onSuccess: () => {
      invalidateFeeds();
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
    },
  });

  const refresh = useMutation({
    mutationFn: () => calendarApi.refresh(),
    onSuccess: (res) => {
      invalidateFeeds();
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
      toast({
        title: res.errors.length
          ? res.errors[0]!
          : t("dashboard.settings.calendarFeeds.refreshed").replace("{count}", String(res.events)),
        variant: res.errors.length ? "destructive" : undefined,
      });
    },
  });

  const createLink = useMutation({
    mutationFn: () => calendarApi.createPublishLink(),
    onSuccess: (res) => {
      setPublishedUrl(res.url);
      queryClient.invalidateQueries({ queryKey: PUBLISH_KEY });
    },
  });

  const revokeLink = useMutation({
    mutationFn: () => calendarApi.revokePublishLink(),
    onSuccess: () => {
      setPublishedUrl(null);
      queryClient.invalidateQueries({ queryKey: PUBLISH_KEY });
    },
  });

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: t("dashboard.settings.calendarFeeds.copyFailed"), variant: "destructive" });
    }
  };

  return (
    <div className="card" style={{ padding: "18px 22px 20px" }}>
      {/* ── Subscribed .ics feeds ─────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-[var(--radius-sm)] bg-sky-100 flex items-center justify-center shrink-0">
          <Link2 className="h-5 w-5 text-sky-600" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{t("dashboard.settings.calendarFeeds.title")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.settings.calendarFeeds.desc")}</p>
        </div>
      </div>
      <div className="space-y-4 mt-4">

      {(feeds.data?.feeds.length ?? 0) > 0 && (
        <ul className="space-y-2 list-none p-0 m-0">
          {feeds.data!.feeds.map((feed) => (
            <li key={feed.id} className="flex items-center gap-3 rounded-[var(--radius-sm)] border p-3" style={{ borderColor: "var(--line)" }}>
              <span className="qa-ic navy shrink-0"><Link2 className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <b className="block text-sm truncate" style={{ color: "var(--navy)" }}>{feed.name}</b>
                <span className="block text-xs truncate" style={{ color: "var(--muted-mk)" }}>{feed.url}</span>
                <span className={cn("block text-xs mt-0.5", feed.lastStatus === "failed" && "text-[var(--red)]")}>
                  {feed.lastStatus === "failed" ? (
                    <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {feed.lastError}</span>
                  ) : (
                    t("dashboard.settings.calendarFeeds.eventCount").replace("{count}", String(feed.eventCount))
                  )}
                </span>
              </div>
              {editable && (
                <>
                  <button
                    type="button"
                    className="btn btn-outline-navy btn-sm"
                    onClick={() => toggleFeed.mutate({ id: feed.id, isEnabled: !feed.isEnabled })}
                    disabled={toggleFeed.isPending}
                  >
                    {feed.isEnabled ? t("dashboard.settings.calendarFeeds.pause") : t("dashboard.settings.calendarFeeds.resume")}
                  </button>
                  <button
                    type="button"
                    className="ic-btn danger"
                    aria-label={t("a11y.delete")}
                    onClick={() => removeFeed.mutate(feed.id)}
                    disabled={removeFeed.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-[140px]">
            <span className="block text-xs mb-1" style={{ color: "var(--muted-mk)" }}>{t("dashboard.settings.calendarFeeds.nameLabel")}</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Calendly" />
          </label>
          <label className="flex-[2] min-w-[220px]">
            <span className="block text-xs mb-1" style={{ color: "var(--muted-mk)" }}>{t("dashboard.settings.calendarFeeds.urlLabel")}</span>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://calendly.com/…/ics" inputMode="url" />
          </label>
          <button
            type="button"
            className="btn btn-navy btn-sm gap-1.5"
            onClick={() => addFeed.mutate()}
            disabled={addFeed.isPending || !name.trim() || !url.trim()}
          >
            <Plus className="h-4 w-4" /> {t("dashboard.settings.calendarFeeds.add")}
          </button>
          <button
            type="button"
            className="btn btn-outline-navy btn-sm gap-1.5"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
          >
            <RefreshCw className={cn("h-4 w-4", refresh.isPending && "animate-spin")} /> {t("dashboard.settings.calendarFeeds.refresh")}
          </button>
        </div>
      )}

      {/* ── The published feed ────────────────────────────────────────────── */}
      <div className="pt-3 border-t" style={{ borderColor: "var(--soft)" }}>
        <h3 className="text-sm font-semibold">{t("dashboard.settings.calendarPublish.title")}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.settings.calendarPublish.desc")}</p>

        {publishedUrl && (
          <div className="flex items-center gap-2 mt-2">
            <Input readOnly value={publishedUrl} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn btn-outline-navy btn-sm gap-1.5" onClick={() => copy(publishedUrl)}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? t("dashboard.settings.calendarPublish.copied") : t("dashboard.settings.calendarPublish.copy")}
            </button>
          </div>
        )}
        {publishedUrl && <p className="text-xs mt-1" style={{ color: "var(--muted-mk)" }}>{t("dashboard.settings.calendarPublish.onceOnly")}</p>}

        {editable && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <button type="button" className="btn btn-navy btn-sm" onClick={() => createLink.mutate()} disabled={createLink.isPending}>
              {publish.data?.enabled ? t("dashboard.settings.calendarPublish.rotate") : t("dashboard.settings.calendarPublish.create")}
            </button>
            {publish.data?.enabled && (
              <button type="button" className="btn btn-outline-navy btn-sm" onClick={() => revokeLink.mutate()} disabled={revokeLink.isPending}>
                {t("dashboard.settings.calendarPublish.revoke")}
              </button>
            )}
            {publish.data?.enabled && !publishedUrl && (
              <span className="text-xs" style={{ color: "var(--muted-mk)" }}>
                {t("dashboard.settings.calendarPublish.live").replace("{hint}", publish.data.hint ?? "")}
              </span>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
