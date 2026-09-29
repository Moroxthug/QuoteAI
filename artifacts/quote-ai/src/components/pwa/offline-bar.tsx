import { useEffect, useState } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { WifiOff, RefreshCw, AlertTriangle, CloudUpload, Trash2, RotateCcw, ChevronDown, ChevronUp, DownloadCloud, Check, Wifi } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { usePwa, applyUpdate } from "@/lib/pwa";
import { useOutbox, retryFailed, discard, flush, resolveConflict, sendNow, type OutboxRow } from "@/lib/offline/outbox";
import { useDataSaver, waitsForWifi } from "@/lib/offline/data-saver";
import { formatCents } from "@/lib/money";
import type { Lang } from "@/i18n/translations";
import { useQueryCacheState } from "@/lib/offline/cache-state";

/** "9:42 a.m." today, "Sep 26, 9:42 a.m." before — in the page's language (fr-CA: "9 h 42"). */
function syncedTime(at: number, lang: string, now = Date.now()): string {
  const locale = lang === "fr" ? "fr-CA" : "en-CA";
  const d = new Date(at);
  const sameDay = new Date(now).toDateString() === d.toDateString();
  return new Intl.DateTimeFormat(locale, sameDay ? { hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
}

/** A value in a conflict, as a person reads it: dates, money, lists, or the text itself. */
function readable(field: string, v: unknown, lang: Lang, t: (k: string) => string): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number" && /Cents$/.test(field)) return formatCents(v, lang);
  if (Array.isArray(v)) return t("sync.list").replace("{n}", String(v.length));
  if (typeof v === "object") return "…";
  const s = String(v);
  if (field === "status") {
    const key = `sync.status.${s}`;
    const label = t(key);
    if (label !== key) return label;
  }
  const locale = lang === "fr" ? "fr-CA" : "en-CA";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${s}T00:00:00Z`));
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(s));
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
}

function fieldName(field: string, t: (k: string) => string): string {
  const key = `sync.field.${field}`;
  const label = t(key);
  return label === key ? field.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase()) : label;
}

/**
 * Phase 117: an edit that collided with one made on another device. Each field
 * both sides changed shows what the row says now and what you set; the person
 * keeps one per field, and the edit is sent (or dropped) once every field is
 * decided.
 */
function ConflictItem({ row }: { row: OutboxRow }) {
  const { t, lang } = useLanguage();
  const [choice, setChoice] = useState<Record<string, "mine" | "theirs">>({});
  const fields = row.conflict?.fields ?? [];
  const pick = (field: string, side: "mine" | "theirs") => {
    const next = { ...choice, [field]: side };
    setChoice(next);
    if (fields.every((f) => next[f.field])) void resolveConflict(row.id, next);
  };
  return (
    <li className="pt-1.5 text-xs" data-testid="sync-conflict">
      <div className="font-medium" style={{ color: "var(--ink)" }}>{row.label}</div>
      <div style={{ color: "var(--muted-mk)" }}>{t("sync.conflictItem")}</div>
      {fields.map((f) => (
        <div key={f.field} className="mt-1.5 rounded-lg px-2 py-1.5" style={{ background: "var(--paper, #fff)", border: "1px solid var(--line, #e5e7eb)" }}>
          <div className="font-semibold" style={{ color: "var(--ink)" }}>{fieldName(f.field, t)}</div>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {([["theirs", f.theirs], ["mine", f.mine]] as const).map(([side, value]) => (
              <button
                key={side}
                type="button"
                aria-pressed={choice[f.field] === side}
                className="text-left rounded-md px-2 py-1.5 min-h-11 sm:min-h-0"
                style={{ border: `1px solid ${choice[f.field] === side ? "var(--navy)" : "var(--line, #e5e7eb)"}`, color: "var(--ink)" }}
                onClick={() => pick(f.field, side)}
              >
                <span className="block" style={{ color: "var(--muted-mk)" }}>{t(side === "mine" ? "sync.mine" : "sync.theirs")}</span>
                <span className="block font-medium break-words">{readable(f.field, value, lang, t)}</span>
                <span className="block mt-0.5 font-bold underline underline-offset-2" style={{ color: "var(--navy)" }}>{t(side === "mine" ? "sync.keepMine" : "sync.keepTheirs")}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </li>
  );
}

/** How long "Updated just now" stays up after the first refresh of a restored app. */
const UPDATED_NOTE_MS = 2_500;

/**
 * Phase 116: the app opened from what was saved on the device. While the
 * first refresh runs, a quiet pill says what it is showing; when the answers
 * arrive it says "Updated just now" and goes. Floats over the page (no shift).
 */
function FreshnessNote() {
  const { t, lang } = useLanguage();
  const cache = useQueryCacheState();
  const fetching = useIsFetching() > 0;
  const [openedAt] = useState(() => Date.now());
  const [done, setDone] = useState(false);
  const restored = cache.restoredAt !== null;
  const synced = restored && cache.lastSyncedAt !== null && cache.lastSyncedAt >= openedAt;
  useEffect(() => {
    if (!synced || done) return;
    const id = window.setTimeout(() => setDone(true), UPDATED_NOTE_MS);
    return () => window.clearTimeout(id);
  }, [synced, done]);
  if (!restored || done) return null;
  if (synced) {
    return <div className="fresh-note" role="status" aria-live="polite"><Check aria-hidden="true" />{t("offline.updatedNow")}</div>;
  }
  if (!fetching) return null;
  return <div className="fresh-note" role="status" aria-live="polite"><RefreshCw className="animate-spin" aria-hidden="true" />{t("offline.updating").replace("{time}", syncedTime(cache.restoredAt!, lang))}</div>;
}

/**
 * Phase 77: the one strip that tells the field what the app is doing with
 * their changes — offline (queued), syncing, or a queued change the server
 * refused. Also the "new version ready" prompt. Renders nothing when there is
 * nothing to say. `scope` narrows the queue to the page (worker token / job id).
 */
export function OfflineBar({ scope }: { scope?: string }) {
  const { t, lang } = useLanguage();
  const pwa = usePwa();
  const cache = useQueryCacheState();
  const outbox = useOutbox(scope);
  const [open, setOpen] = useState(false);
  // Phase 122: photos kept for Wi-Fi are waiting on purpose, not stuck.
  const saver = useDataSaver();
  const held = (r: OutboxRow) => r.status === "pending" && waitsForWifi(r.op, { ...saver, sendNow: r.sendNow });
  const onWifiHold = outbox.rows.filter(held);
  const pending = outbox.rows.filter((r) => r.status === "pending" && !held(r));
  const failed = outbox.rows.filter((r) => r.status === "failed");
  const conflicts = outbox.rows.filter((r) => r.status === "conflict");

  // The app-wide bar (no scope) also carries the restored-data note.
  if (pwa.online && pending.length === 0 && failed.length === 0 && conflicts.length === 0 && onWifiHold.length === 0 && !pwa.updateReady) return scope ? null : <FreshnessNote />;

  const tone = failed.length > 0 || conflicts.length > 0 ? "danger" : !pwa.online ? "warn" : "info";
  const palette = tone === "danger" ? { bg: "var(--red-t, #fdece4)", fg: "var(--red)" } : tone === "warn" ? { bg: "var(--yellow-t, #fff4cc)", fg: "var(--yellow-dark)" } : { bg: "var(--teal-t, #e3f4f6)", fg: "var(--teal-dark)" };

  let icon = <CloudUpload className="h-4 w-4 shrink-0" />;
  let text = "";
  if (conflicts.length > 0) {
    icon = <AlertTriangle className="h-4 w-4 shrink-0" />;
    text = t(conflicts.length === 1 ? "offline.conflictOne" : "offline.conflictMany").replace("{n}", String(conflicts.length));
  } else if (failed.length > 0) {
    icon = <AlertTriangle className="h-4 w-4 shrink-0" />;
    text = t(failed.length === 1 ? "offline.failedOne" : "offline.failedMany").replace("{n}", String(failed.length));
  } else if (!pwa.online) {
    icon = <WifiOff className="h-4 w-4 shrink-0" />;
    // Phase 116: say what the screen is showing — the data as of the last sync.
    const at = cache.lastSyncedAt ?? cache.restoredAt;
    if (at && !scope) text = t(pending.length > 0 ? "offline.offlineSinceQueued" : "offline.offlineSince").replace("{time}", syncedTime(at, lang)).replace("{n}", String(pending.length));
    else text = pending.length > 0 ? t("offline.offlineQueued").replace("{n}", String(pending.length)) : t("offline.offline");
  } else if (outbox.syncing) {
    icon = <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />;
    text = t("offline.syncing").replace("{n}", String(pending.length));
  } else if (pending.length > 0) {
    text = t("offline.waiting").replace("{n}", String(pending.length));
  } else if (onWifiHold.length > 0) {
    icon = <Wifi className="h-4 w-4 shrink-0" />;
    text = t(onWifiHold.length === 1 ? "offline.wifiOne" : "offline.wifiMany").replace("{n}", String(onWifiHold.length));
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
          <button type="button" className="text-xs font-bold underline underline-offset-2 hit-44" onClick={applyUpdate}>{t("offline.reload")}</button>
        )}
        {pwa.online && pending.length > 0 && !outbox.syncing && (
          <button type="button" className="text-xs font-bold underline underline-offset-2 hit-44" onClick={() => void flush()}>{t("offline.syncNow")}</button>
        )}
        {(failed.length > 0 || pending.length > 0 || conflicts.length > 0 || onWifiHold.length > 0) && (
          <button type="button" aria-expanded={open} aria-label={t("offline.details")} className="hit-44 rounded-md" onClick={() => setOpen((o) => !o)}>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
      </div>
      {open && (
        <ul className="px-3 pb-2 space-y-1.5" style={{ borderTop: `1px solid ${palette.fg}22` }}>
          {conflicts.map((r) => <ConflictItem key={r.id} row={r} />)}
          {outbox.rows.filter((r) => r.status !== "conflict").map((r) => (
            <li key={r.id} className="flex items-center gap-2 pt-1.5 text-xs">
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium" style={{ color: "var(--ink)" }}>{r.label}</div>
                <div className="truncate" style={{ color: r.status === "failed" ? "var(--red)" : "var(--muted-mk)" }}>{r.status === "failed" ? r.error ?? t("offline.refused") : held(r) ? t("offline.wifiItem") : t("offline.pendingItem")}</div>
              </div>
              {held(r) && pwa.online && (
                <button type="button" className="text-xs font-bold underline underline-offset-2 hit-44" style={{ color: "var(--navy)" }} onClick={() => void sendNow(r.id)}>{t("offline.syncNow")}</button>
              )}
              {r.status === "failed" && (
                <button type="button" className="hit-44" title={t("offline.retry")} aria-label={t("offline.retry")} style={{ color: "var(--navy)" }} onClick={() => void retryFailed(scope)}><RotateCcw className="h-3.5 w-3.5" /></button>
              )}
              <button type="button" className="hit-44" title={t("offline.discard")} aria-label={t("offline.discard")} style={{ color: "var(--muted-mk)" }} onClick={() => void discard(r.id)}><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
