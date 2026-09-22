import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Loader2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { usePwa } from "@/lib/pwa";
import { pushApi, pushSupported, currentSubscription, enablePush, disablePush } from "@/lib/push-api";

/**
 * Phase 77: "Push notifications on this device" — one switch per browser.
 * Explains itself when the browser cannot do push (iOS needs the app on the
 * home screen), when the server has no VAPID keys yet, or when permission was
 * refused in the browser.
 */
export function PushToggle() {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const pwa = usePwa();
  const supported = pushSupported() && pwa.supported;
  const [endpoint, setEndpoint] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(typeof Notification === "undefined" ? null : Notification.permission);

  useEffect(() => {
    if (!supported) {
      setEndpoint(null);
      return;
    }
    void currentSubscription().then((s) => setEndpoint(s?.endpoint ?? null));
  }, [supported]);

  const { data: config, isLoading } = useQuery({ queryKey: ["push-config", endpoint ?? null], queryFn: () => pushApi.config(endpoint), enabled: endpoint !== undefined, staleTime: 60_000 });
  const enabled = !!config?.subscribed;

  const toggle = async () => {
    if (!config?.publicKey) return;
    setBusy(true);
    try {
      if (enabled) {
        await disablePush();
        setEndpoint(null);
        toast({ title: t("push.disabledToast") });
      } else {
        const r = await enablePush(config.publicKey, lang);
        setPermission(typeof Notification === "undefined" ? null : Notification.permission);
        if (r === "enabled") {
          const s = await currentSubscription();
          setEndpoint(s?.endpoint ?? null);
          toast({ title: t("push.enabledToast") });
        } else if (r === "denied") toast({ title: t("push.deniedToast"), description: t("push.deniedHint"), variant: "destructive" });
        else toast({ title: t("push.unavailableToast"), variant: "destructive" });
      }
      queryClient.invalidateQueries({ queryKey: ["push-config"] });
    } catch (e) {
      toast({ title: t("push.errorToast"), description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      const r = await pushApi.test(lang);
      toast({ title: r.sent > 0 ? t("push.testSent") : t("push.testNone") });
    } catch (e) {
      toast({ title: t("push.errorToast"), description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  let hint: string;
  if (!supported) hint = pwa.ios && !pwa.standalone ? t("push.iosHint") : t("push.unsupportedHint");
  else if (config && !config.configured) hint = t("push.notConfiguredHint");
  else if (permission === "denied") hint = t("push.deniedHint");
  else hint = enabled ? t("push.onHint") : t("push.offHint");

  const canToggle = supported && !!config?.configured && permission !== "denied";

  return (
    <section className="card p-5 mb-4" aria-label={t("push.title")}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-xl p-2" style={{ background: "var(--soft)", color: "var(--navy)" }}><BellRing className="h-5 w-5" /></div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold" style={{ color: "var(--navy)" }}>{t("push.title")}</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-mk)" }}>{hint}</p>
          <p className="text-xs mt-1" style={{ color: "var(--faint)" }}>{t("push.types")}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {enabled && canToggle && (
            <button type="button" className="btn btn-outline-navy btn-sm" disabled={busy} onClick={() => void sendTest()} title={t("push.test")}>
              <Send className="h-3.5 w-3.5" /> {t("push.test")}
            </button>
          )}
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={t("push.title")}
            disabled={!canToggle || busy || isLoading}
            onClick={() => void toggle()}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50"
            style={{ background: enabled ? "var(--navy)" : "var(--line)" }}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-white" /> : <span className="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform" style={{ transform: enabled ? "translateX(22px)" : "translateX(2px)" }} />}
          </button>
        </div>
      </div>
    </section>
  );
}
