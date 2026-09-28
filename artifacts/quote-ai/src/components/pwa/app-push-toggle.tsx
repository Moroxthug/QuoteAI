import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BellRing, Loader2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { pushApi } from "@/lib/push-api";
import { appPushOn, appPushPermission, disableAppPush, enableAppPush, type AppPushPermission } from "@/lib/native/push";
import { PushPreferences } from "./push-preferences";

/**
 * Phase 119: "Notifications on this phone" in the app — the native twin of
 * the browser's PushToggle (FCM instead of Web Push). Loaded only by the
 * phone app's bundle.
 */
export default function AppPushToggle() {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const [on, setOn] = useState(appPushOn());
  const [permission, setPermission] = useState<AppPushPermission | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: config } = useQuery({ queryKey: ["push-config", null], queryFn: () => pushApi.config(null), staleTime: 60_000 });

  useEffect(() => { void appPushPermission().then(setPermission); }, []);

  const configured = !!config?.appConfigured && permission !== "unavailable";
  const toggle = async () => {
    setBusy(true);
    try {
      if (on) {
        await disableAppPush();
        setOn(false);
        toast({ title: t("push.disabledToast") });
        return;
      }
      const r = await enableAppPush(lang);
      setPermission(await appPushPermission());
      if (r === "enabled") {
        setOn(true);
        toast({ title: t("push.enabledToast") });
      } else if (r === "denied") toast({ title: t("push.deniedToast"), description: t("native.push.appDenied"), variant: "destructive" });
      else toast({ title: t("push.errorToast"), variant: "destructive" });
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
  if (!configured) hint = t("native.push.appNotSetUp");
  else if (permission === "denied") hint = t("native.push.appDenied");
  else hint = on ? t("native.push.appOn") : t("native.push.appOff");
  const canToggle = configured && permission !== "denied";

  return (
    <section className="card p-5 mb-4" aria-label={t("native.push.appTitle")}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-xl p-2" style={{ background: "var(--soft)", color: "var(--navy)" }}><BellRing className="h-5 w-5" /></div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold" style={{ color: "var(--navy)" }}>{t("native.push.appTitle")}</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-mk)" }}>{hint}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={t("native.push.appTitle")}
          disabled={!canToggle || busy}
          onClick={() => void toggle()}
          className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50"
          style={{ background: on ? "var(--navy)" : "var(--line)" }}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-white" /> : <span className="inline-block h-6 w-6 rounded-full bg-white shadow transition-transform" style={{ transform: on ? "translateX(22px)" : "translateX(2px)" }} />}
        </button>
      </div>
      {configured && <PushPreferences />}
      {on && canToggle && (
        <>
          <button type="button" className="btn btn-outline-navy btn-sm mt-3" disabled={busy} onClick={() => void sendTest()}>
            <Send className="h-3.5 w-3.5" /> {t("push.test")}
          </button>
        </>
      )}
    </section>
  );
}
