import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useGetSubscription } from "@workspace/api-client-react";
import { ChevronRight, Search } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";
import { SettingsSection, useSinglePane } from "../ui";
import { APPS, APP_GROUPS, APPS_HREF, RETURN_PARAMS, appById, appHref, isUnlocked, type AppDef, type AppId } from "./catalog";
import { useAppStatuses, type AppStatus } from "./status";
import { BrandLogo, LockNote, StatusPill } from "./ui";
import { QuickbooksPanel, WavePanel } from "./accounting";
import { GoogleCalendarPanel, IcsPanel, OutlookCalendarPanel } from "./calendar";
import { GmailPanel } from "./gmail";
import { FinanceitPanel, FlinksPanel, StripePanel } from "./payments";
import { GoogleLsaPanel, MetaLeadsPanel } from "./leads";
import { ApiPanel } from "./developer";

// ── Phase 103: Connected apps as a directory ─────────────────────────────────
// Tiles with each company's own logo, grouped; the apps already connected
// first, the ones the server can't offer yet in a quiet row at the bottom.
// A tile opens the app's detail — a side panel on a wide screen, its own
// page (/dashboard/settings/apps?app=<id>) on a phone. Every plan sees the
// whole directory; what the plan doesn't include carries a lock.

const PANELS: Partial<Record<AppId, ComponentType>> = {
  quickbooks: QuickbooksPanel,
  wave: WavePanel,
  google_calendar: GoogleCalendarPanel,
  outlook_calendar: OutlookCalendarPanel,
  ics: IcsPanel,
  gmail: GmailPanel,
  stripe: StripePanel,
  financeit: FinanceitPanel,
  flinks: FlinksPanel,
  meta_leads: MetaLeadsPanel,
  google_lsa: GoogleLsaPanel,
  api: ApiPanel,
};

/** Search appears once the directory is long enough to need it. */
const SEARCH_FROM = 12;

const isLive = (s: AppStatus) => s.state === "connected" || s.state === "attention" || s.state === "paused";

function AppTile({ app, status, onOpen }: { app: AppDef; status: AppStatus; onOpen: (app: AppDef) => void }) {
  const { t } = useLanguage();
  const account = isLive(status) && status.detail ? status.detail : null;
  const body = (
    <>
      <BrandLogo app={app} />
      <span className="app-tile-name">{t(`apps.${app.id}.name`)}</span>
      {/* Connected: the account (one line — an email must not break mid-word); otherwise what it does. */}
      <span className={cn("app-tile-line", account && "one", status.state === "attention" && "bad")}>{account ?? t(`apps.${app.id}.tagline`)}</span>
      <span className="app-tile-pill"><StatusPill app={app} status={status} /></span>
    </>
  );
  // WhatsApp, SMS and the widget have settings sections of their own; a locked one still opens its detail (the lock).
  if (app.section && status.state !== "locked") {
    return <Link href={`/dashboard/settings/${app.section}`} className="app-tile" data-app={app.id}>{body}</Link>;
  }
  return <button type="button" className="app-tile" data-app={app.id} onClick={() => onOpen(app)}>{body}</button>;
}

function AppGrid({ title, apps, statuses, onOpen }: { title: string; apps: AppDef[]; statuses: Record<AppId, AppStatus>; onOpen: (app: AppDef) => void }) {
  // One level under the section heading, as SettingsGroup does.
  const Heading = useSinglePane() ? "h2" : "h3";
  if (!apps.length) return null;
  return (
    <section className="app-group" aria-label={title}>
      <Heading className="app-group-title">{title}</Heading>
      <ul className="app-grid">
        {apps.map((a) => <li key={a.id}><AppTile app={a} status={statuses[a.id]} onOpen={onOpen} /></li>)}
      </ul>
    </section>
  );
}

/** What it does, what it shares and with whom, then the app's own settings (or its lock). */
function AppDetailBody({ app, status }: { app: AppDef; status: AppStatus }) {
  const { t } = useLanguage();
  const Panel = PANELS[app.id];
  return (
    <div className="app-detail">
      <div className="app-about">
        <p>{t(`apps.${app.id}.about`)}</p>
        <p className="app-shared"><b>{t("apps.detail.shared")}</b> {t(`apps.${app.id}.shared`)}</p>
      </div>
      {status.state === "locked" ? (
        <LockNote app={app} />
      ) : status.state === "soon" ? (
        <p className="app-soon-note">{t("apps.detail.soon")}</p>
      ) : app.section ? (
        <Link href={`/dashboard/settings/${app.section}`} className="btn btn-sm btn-navy app-self-start">{t("apps.detail.openSettings")} <ChevronRight aria-hidden="true" /></Link>
      ) : Panel ? (
        <Panel />
      ) : null}
    </div>
  );
}

function AppDetailHead({ app, status, as: Heading = "h1" }: { app: AppDef; status: AppStatus; as?: "h1" | "h2" }) {
  const { t } = useLanguage();
  return (
    <header className="app-detail-head">
      <BrandLogo app={app} size="lg" />
      <div className="app-detail-txt">
        <Heading id="settings-section-title">{t(`apps.${app.id}.name`)}</Heading>
        <p>{t(`apps.${app.id}.tagline`)}</p>
        <div className="app-detail-pill"><StatusPill app={app} status={status} /></div>
      </div>
    </header>
  );
}

export function AppsSection() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const search = useSearch();
  const single = useSinglePane();
  const { data: sub } = useGetSubscription();
  const plan = sub?.isActive ? sub.plan : null;
  const statuses = useAppStatuses((id) => { const a = appById(id); return !!a && isUnlocked(a, plan); });
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  const params = useMemo(() => new URLSearchParams(search), [search]);
  const open = appById(params.get("app"));

  // Back from an OAuth screen (…?qb=connected): say how it went and open that app.
  useEffect(() => {
    for (const r of RETURN_PARAMS) {
      const result = params.get(r.param);
      if (!result) continue;
      const id = r.app(params);
      const name = t(`apps.${id}.name`);
      if (result === "connected") toast({ title: t("apps.return.connected").replace("{name}", name) });
      else toast({ title: t("apps.return.error").replace("{name}", name), variant: "destructive" });
      navigate(appHref(id), { replace: true });
      return;
    }
  }, [params, navigate, toast, t]);

  const openApp = (app: AppDef) => navigate(appHref(app.id));
  const close = () => navigate(APPS_HREF, { replace: true });

  const loading = APPS.some((a) => statuses[a.id].state === "loading");
  const q = query.trim().toLowerCase();
  const matches = (a: AppDef) =>
    !q || [t(`apps.${a.id}.name`), t(`apps.${a.id}.tagline`), t(`apps.group.${a.group}`)].some((s) => s.toLowerCase().includes(q));
  const shown = APPS.filter(matches);
  const soon = shown.filter((a) => statuses[a.id].state === "soon");
  const live = shown
    .filter((a) => isLive(statuses[a.id]))
    .sort((a, b) => Number(statuses[b.id].state === "attention") - Number(statuses[a.id].state === "attention"));
  const rest = shown.filter((a) => !isLive(statuses[a.id]) && statuses[a.id].state !== "soon");
  const owners = [...new Set(APPS.map((a) => a.owner).filter(Boolean))];

  // A phone opens the detail as a page of its own (the top bar says which, with ‹ back to the directory).
  if (open && single) {
    return (
      <section className="sset app-page" aria-labelledby="settings-section-title">
        <AppDetailHead app={open} status={statuses[open.id]} />
        <AppDetailBody app={open} status={statuses[open.id]} />
      </section>
    );
  }

  return (
    <SettingsSection title={t("settings.section.apps")} intro={t("settings.intro.apps")}>
      {APPS.length > SEARCH_FROM && (
        <div className="app-search">
          <Search aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("apps.search")} aria-label={t("apps.search")} enterKeyHint="search" />
        </div>
      )}
      {loading ? (
        <ul className="app-grid" aria-busy="true" aria-label={t("apps.loading")}>
          {APPS.slice(0, 6).map((a) => <li key={a.id}><Skeleton className="app-tile-skel" /></li>)}
        </ul>
      ) : !shown.length ? (
        <p className="app-empty">{t("apps.noMatch").replace("{q}", query.trim())}</p>
      ) : q ? (
        <AppGrid title={t("apps.results")} apps={shown.filter((a) => statuses[a.id].state !== "soon")} statuses={statuses} onOpen={openApp} />
      ) : (
        <>
          <AppGrid title={t("apps.group.connected")} apps={live} statuses={statuses} onOpen={openApp} />
          {APP_GROUPS.map((g) => (
            <AppGrid key={g} title={t(`apps.group.${g}`)} apps={rest.filter((a) => a.group === g)} statuses={statuses} onOpen={openApp} />
          ))}
        </>
      )}
      {!loading && soon.length > 0 && (
        <section className="app-soon" aria-label={t("apps.group.soon")}>
          {single ? <h2 className="app-group-title">{t("apps.group.soon")}</h2> : <h3 className="app-group-title">{t("apps.group.soon")}</h3>}
          <ul>
            {soon.map((a) => (
              <li key={a.id}><BrandLogo app={a} /><span>{t(`apps.${a.id}.name`)}</span></li>
            ))}
          </ul>
        </section>
      )}
      <p className="app-tm">{t("apps.trademarks").replace("{owners}", owners.join(", "))}</p>

      {open && !single && (
        <Dialog open onOpenChange={(o) => { if (!o) close(); }}>
          {/* Focus the panel itself on open, not its first switch (a focus ring on a row nobody chose). */}
          <DialogContent ref={panelRef} className="side" size="lg" tabIndex={-1} onOpenAutoFocus={(e) => { e.preventDefault(); panelRef.current?.focus(); }}>
            <div className="modal-head app-detail-head">
              <BrandLogo app={open} size="lg" />
              <div className="txt">
                <DialogTitle>{t(`apps.${open.id}.name`)}</DialogTitle>
                <DialogDescription>{t(`apps.${open.id}.tagline`)}</DialogDescription>
                <div className="app-detail-pill"><StatusPill app={open} status={statuses[open.id]} /></div>
              </div>
            </div>
            <DialogBody>
              <AppDetailBody app={open} status={statuses[open.id]} />
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}
    </SettingsSection>
  );
}
