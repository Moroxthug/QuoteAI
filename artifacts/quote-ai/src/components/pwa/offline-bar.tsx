import { useState } from "react";
import { WifiOff, RefreshCw, AlertTriangle, CloudUpload, Trash2, RotateCcw, ChevronDown, ChevronUp, DownloadCloud } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { usePwa, applyUpdate } from "@/lib/pwa";
import { useOutbox, retryFailed, discard, flush } from "@/lib/offline/outbox";

/**
 * Phase 77: the one strip that tells the field what the app is doing with
 * their changes — offline (queued), syncing, or a queued change the server
 * refused. Also the "new version ready" prompt. Renders nothing when there is
 * nothing to say. `scope` narrows the queue to the page (worker token / job id).
 */
export function OfflineBar({ scope }: { scope?: string }) {
  const { t } = useLanguage();
  const pwa = usePwa();
  const outbox = useOutbox(scope);
  const [open, setOpen] = useState(false);
  const pending = outbox.rows.filter((r) => r.status === "pending");
  const failed = outbox.rows.filter((r) => r.status === "failed");

  if (pwa.online && pending.length === 0 && failed.length === 0 && !pwa.updateReady) return null;

  const tone = failed.length > 0 ? "danger" : !pwa.online ? "warn" : "info";
  const palette = tone === "danger" ? { bg: "var(--red-t, #fdece4)", fg: "var(--red)" } : tone === "warn" ? { bg: "var(--yellow-t, #fff4cc)", fg: "var(--yellow-dark)" } : { bg: "var(--teal-t, #e3f4f6)", fg: "var(--teal-dark)" };

  let icon = <CloudUpload className="h-4 w-4 shrink-0" />;
  let text = "";
  if (failed.length > 0) {
    icon = <AlertTriangle className="h-4 w-4 shrink-0" />;
    text = t(failed.length === 1 ? "offline.failedOne" : "offline.failedMany").replace("{n}", String(failed.length));
  } else if (!pwa.online) {
    icon = <WifiOff className="h-4 w-4 shrink-0" />;
    text = pending.length > 0 ? t("offline.offlineQueued").replace("{n}", String(pending.length)) : t("offline.offline");
  } else if (outbox.syncing) {
    icon = <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />;
    text = t("offline.syncing").replace("{n}", String(pending.length));
  } else if (pending.length > 0) {
    text = t("offline.waiting").replace("{n}", String(pending.length));
  } else if (pwa.updateReady) {
    icon = <DownloadCloud className="h-4 w-4 shrink-0" />;
    text = t("offline.updateReady");
  }

  return (
    <div role="status" aria-live="polite" className="rounded-xl text-sm mb-3" style={{ background: palette.bg, color: palette.fg, border: `1px solid ${palette.fg}22` }}>
      <div className="flex items-center gap-2 px-3 py-2">
        {icon}
        <span className="flex-1 min-w-0 font-medium">{text}</span>
        {pwa.updateReady && failed.length === 0 && (
          <button type="button" className="text-xs font-bold underline underline-offset-2" onClick={applyUpdate}>{t("offline.reload")}</button>
        )}
        {pwa.online && pending.length > 0 && !outbox.syncing && (
          <button type="button" className="text-xs font-bold underline underline-offset-2" onClick={() => void flush()}>{t("offline.syncNow")}</button>
        )}
        {(failed.length > 0 || pending.length > 0) && (
          <button type="button" aria-expanded={open} aria-label={t("offline.details")} className="p-1 rounded-md" onClick={() => setOpen((o) => !o)}>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
      </div>
      {open && (
        <ul className="px-3 pb-2 space-y-1.5" style={{ borderTop: `1px solid ${palette.fg}22` }}>
          {outbox.rows.map((r) => (
            <li key={r.id} className="flex items-center gap-2 pt-1.5 text-xs">
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium" style={{ color: "var(--ink)" }}>{r.label}</div>
                <div className="truncate" style={{ color: r.status === "failed" ? "var(--red)" : "var(--muted-mk)" }}>{r.status === "failed" ? r.error ?? t("offline.refused") : t("offline.pendingItem")}</div>
              </div>
              {r.status === "failed" && (
                <button type="button" className="p-1" title={t("offline.retry")} aria-label={t("offline.retry")} style={{ color: "var(--navy)" }} onClick={() => void retryFailed(scope)}><RotateCcw className="h-3.5 w-3.5" /></button>
              )}
              <button type="button" className="p-1" title={t("offline.discard")} aria-label={t("offline.discard")} style={{ color: "var(--muted-mk)" }} onClick={() => void discard(r.id)}><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
