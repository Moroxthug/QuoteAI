import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { BottomSheet } from "@/components/mobile/bottom-sheet";
import { isNativeApp } from "@/lib/native/env";
import { pushApi, pushSupported, currentSubscription, enablePush } from "@/lib/push-api";
import { markPushAsked } from "./push-ask";

// Phase 119: "Know the moment they accept?" — the phone app asks for app
// notifications (FCM), a browser that can do Web Push asks for those. Shown
// only when the answer is still open (never asked, not refused, not on).

async function canAsk(): Promise<boolean> {
  const config = await pushApi.config(null).catch(() => null);
  if (!config) return false;
  if (isNativeApp) {
    const { appPushOn, appPushPermission } = await import("@/lib/native/push");
    return !!config.appConfigured && !appPushOn() && (await appPushPermission()) === "prompt";
  }
  if (!config.configured || !config.publicKey || !pushSupported()) return false;
  if (typeof Notification === "undefined" || Notification.permission !== "default") return false;
  return !(await currentSubscription());
}

export default function PushAskSheet({ onDone }: { onDone: () => void }) {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void canAsk().then((ok) => {
      if (ok) setOpen(true);
      else {
        markPushAsked();
        onDone();
      }
    });
  }, [onDone]);

  const close = () => {
    markPushAsked();
    setOpen(false);
    onDone();
  };

  const yes = async () => {
    setBusy(true);
    try {
      let ok = false;
      if (isNativeApp) {
        const { enableAppPush } = await import("@/lib/native/push");
        ok = (await enableAppPush(lang)) === "enabled";
      } else {
        const config = await pushApi.config(null);
        ok = !!config.publicKey && (await enablePush(config.publicKey, lang)) === "enabled";
      }
      toast({ title: ok ? t("push.enabledToast") : t("push.unavailableToast"), variant: ok ? undefined : "destructive" });
    } catch {
      toast({ title: t("push.errorToast"), variant: "destructive" });
    } finally {
      setBusy(false);
      close();
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={(v) => { if (!v) close(); }}
      title={t("native.push.askTitle")}
      footer={
        <div className="grid grid-cols-2 gap-2 w-full">
          <button type="button" className="btn btn-outline-navy" onClick={close} disabled={busy}>{t("native.push.askNo")}</button>
          <button type="button" className="btn btn-navy" onClick={() => void yes()} disabled={busy} data-primary-action>{t("native.push.askYes")}</button>
        </div>
      }
    >
      <div className="flex items-start gap-3">
        <span className="shrink-0 rounded-xl p-2" style={{ background: "var(--soft)", color: "var(--navy)" }}><BellRing className="h-5 w-5" /></span>
        <p className="text-sm" style={{ color: "var(--muted-mk)" }}>{t("native.push.askBody")}</p>
      </div>
    </BottomSheet>
  );
}
