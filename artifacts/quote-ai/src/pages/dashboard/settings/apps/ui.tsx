import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { AlertTriangle, CheckCircle2, Loader2, Lock, PauseCircle, RefreshCw, XCircle } from "lucide-react";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";
import { planLabelOf } from "../plan";
import { ActionRow, SettingsGroup } from "../ui";
import { requiredPlanFor, type AppDef } from "./catalog";
import type { AppStatus } from "./status";
import { isNativeApp } from "@/lib/native/env";

/**
 * The company's own mark from public/brands/, on a white tile, never
 * recoloured or stretched (object-fit: contain). Our own tools, the brands
 * whose owners don't license their logo to us, and a file that is missing get
 * the app's lucide icon instead.
 */
export function BrandLogo({ app, size = "md" }: { app: AppDef; size?: "md" | "lg" }) {
  const [broken, setBroken] = useState(false);
  const Icon = app.icon;
  const showLogo = !!app.logo && !broken;
  return (
    <span className={cn("app-logo", size === "lg" && "lg", showLogo ? app.wide && "wide" : "own")} aria-hidden="true">
      {showLogo ? <img src={`/brands/${app.logo}`} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} /> : <Icon />}
    </span>
  );
}

/** Connected / Connect / Needs attention / Paused / Coming soon / <Plan> plan. */
export function StatusPill({ app, status }: { app: AppDef; status: AppStatus }) {
  const { t } = useLanguage();
  switch (status.state) {
    case "loading":
      return <span className="chip chip-grey app-pill-loading" aria-hidden="true">&nbsp;</span>;
    case "connected":
      return <span className="chip chip-green"><CheckCircle2 aria-hidden="true" />{t("apps.pill.connected")}</span>;
    case "attention":
      return <span className="chip chip-red"><AlertTriangle aria-hidden="true" />{t("apps.pill.attention")}</span>;
    case "paused":
      return <span className="chip chip-grey"><PauseCircle aria-hidden="true" />{t("apps.pill.paused")}</span>;
    case "soon":
      return <span className="chip chip-grey">{t("apps.pill.soon")}</span>;
    case "locked":
      return <span className="chip chip-grey"><Lock aria-hidden="true" />{t("apps.pill.plan").replace("{plan}", planLabelOf(requiredPlanFor(app)) ?? "")}</span>;
    default:
      return <span className="chip app-pill-connect">{app.section ? t("apps.pill.setUp") : t("apps.pill.connect")}</span>;
  }
}

/** A plan's name without "monthly_": "Business". */
function planName(app: AppDef): string {
  return planLabelOf(requiredPlanFor(app)) ?? "";
}

/**
 * What a locked app needs. Names the plan that adds it and links to Plan &
 * billing — which the native apps hide (APP-PLAN Phase 118), so no price or
 * checkout button lives here.
 */
export function LockNote({ app }: { app: AppDef }) {
  const { t } = useLanguage();
  const plan = planName(app);
  return (
    <SettingsGroup>
      <div className="app-lock">
        <span className="app-lock-ic"><Lock aria-hidden="true" /></span>
        <div>
          <p className="app-lock-title">{t("apps.lock.title").replace("{plan}", plan)}</p>
          <p className="app-lock-sub">{plan === "Elite" ? t("apps.lock.eliteOnly") : t("apps.lock.andUp").replace("{plan}", plan)}</p>
        </div>
        {!isNativeApp && <Link href="/dashboard/settings/plan" className="btn btn-sm btn-outline-navy">{t("apps.lock.seePlans")}</Link>}
      </div>
    </SettingsGroup>
  );
}

export type SyncRow = { id: string; ok: boolean; label: string; error?: string | null; when?: string | null; retry?: () => void };

/** A short sync log: newest first, failures first, each failure with Retry. */
export function SyncLog({ title, rows, retrying, empty }: { title: string; rows: SyncRow[]; retrying?: boolean; empty?: string }) {
  const { t } = useLanguage();
  if (!rows.length && !empty) return null;
  const sorted = [...rows].sort((a, b) => Number(a.ok) - Number(b.ok)).slice(0, 8);
  return (
    <SettingsGroup title={title}>
      {sorted.length ? (
        <ul className="app-log">
          {sorted.map((r) => (
            <li key={r.id}>
              {r.ok ? <CheckCircle2 className="ok" aria-hidden="true" /> : <XCircle className="bad" aria-hidden="true" />}
              <span className="app-log-txt">
                <span className="app-log-label">{r.label}<span className="sr-only">: {r.ok ? t("apps.log.ok") : t("apps.log.failed")}</span></span>
                {r.error ? <span className="app-log-err">{r.error}</span> : r.when ? <span className="app-log-when">{r.when}</span> : null}
              </span>
              {!r.ok && r.retry && (
                <button type="button" className="btn btn-sm btn-outline-navy" onClick={r.retry} disabled={retrying}>
                  <RefreshCw aria-hidden="true" /> {t("dashboard.settings.quickbooks.retry")}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="sgroup-pad app-muted">{empty}</p>
      )}
    </SettingsGroup>
  );
}

/** Disconnect sits last, in its own card, and asks first. */
export function DisconnectRow({ name, label, help, onConfirm, pending }: { name: string; label?: string; help?: ReactNode; onConfirm: () => void; pending?: boolean }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <SettingsGroup danger>
      <ActionRow label={label ?? t("apps.disconnect.label").replace("{name}", name)} help={help ?? t("apps.disconnect.help")}>
        <button type="button" className="btn btn-sm btn-outline-navy app-danger" onClick={() => setOpen(true)} disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {t("apps.disconnect.cta")}
        </button>
      </ActionRow>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("apps.disconnect.confirmTitle").replace("{name}", name)}</AlertDialogTitle>
            <AlertDialogDescription>{t("apps.disconnect.confirmDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("apps.disconnect.keep")}</AlertDialogCancel>
            <button type="button" className="btn btn-sm btn-red" onClick={() => { setOpen(false); onConfirm(); }}>
              {t("apps.disconnect.cta")}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsGroup>
  );
}

/** "Connected to Acme Ltd · since 3 Mar 2026 · last sync 2 h ago" as rows. */
export function AccountFacts({ facts }: { facts: Array<[string, ReactNode] | false | null | undefined> }) {
  const shown = facts.filter(Boolean) as Array<[string, ReactNode]>;
  if (!shown.length) return null;
  return (
    <dl className="app-facts">
      {shown.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString() : null);
export const fmtDateTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : null);
