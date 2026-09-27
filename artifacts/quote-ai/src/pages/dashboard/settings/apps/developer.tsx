import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, Loader2, Trash2, Webhook } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";
import { developerApi, type AutomationEventName } from "@/lib/invoices-api";
import { SettingsGroup, SettingsRow, ToggleRow } from "../ui";
import { STATUS_KEYS } from "./status";

/** A secret shown once, with Copy and "I've saved it". */
function Revealed({ value, warning, onDismiss }: { value: string; warning: string; onDismiss: () => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  return (
    <div className="app-secret" role="status">
      <p>{warning}</p>
      <div className="app-secret-row">
        <code>{value}</code>
        <button type="button" className="btn btn-sm btn-outline-navy" aria-label={t("dashboard.settings.developerApi.copied")}
          onClick={() => { void navigator.clipboard.writeText(value); toast({ title: t("dashboard.settings.developerApi.copied") }); }}>
          <Copy aria-hidden="true" />
        </button>
      </div>
      <button type="button" className="btn btn-sm btn-outline-navy" onClick={onDismiss}>{t("dashboard.settings.developerApi.dismiss")}</button>
    </div>
  );
}

/** Public API keys and outgoing webhooks, for Zapier/Make and direct integrations (Phase 19). */
export function ApiPanel() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const keys = useQuery({ queryKey: STATUS_KEYS.apiKeys, queryFn: developerApi.listKeys });
  const hooks = useQuery({ queryKey: STATUS_KEYS.webhooks, queryFn: developerApi.listWebhooks });
  const [keyName, setKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<AutomationEventName[]>([]);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const onError = () => toast({ title: t("dashboard.settings.developerApi.error"), variant: "destructive" });
  const refreshKeys = () => queryClient.invalidateQueries({ queryKey: STATUS_KEYS.apiKeys });
  const refreshHooks = () => queryClient.invalidateQueries({ queryKey: STATUS_KEYS.webhooks });

  const createKey = useMutation({
    mutationFn: () => developerApi.createKey(keyName.trim()),
    onSuccess: (r) => { refreshKeys(); setKeyName(""); setRevealedKey(r.rawKey); },
    onError,
  });
  const revokeKey = useMutation({ mutationFn: (id: string) => developerApi.revokeKey(id), onSuccess: refreshKeys, onError });
  const createHook = useMutation({
    mutationFn: () => developerApi.createWebhook(url.trim(), events),
    onSuccess: (r) => { refreshHooks(); setUrl(""); setEvents([]); setRevealedSecret(r.secret); },
    onError,
  });
  const toggleHook = useMutation({ mutationFn: ({ id, on }: { id: string; on: boolean }) => developerApi.toggleWebhook(id, on), onSuccess: refreshHooks, onError });
  const deleteHook = useMutation({ mutationFn: (id: string) => developerApi.deleteWebhook(id), onSuccess: refreshHooks, onError });

  const activeKeys = (keys.data?.items ?? []).filter((k) => !k.revokedAt);
  const allEvents = keys.data?.events ?? hooks.data?.events ?? [];
  const webhooks = hooks.data?.items ?? [];

  return (
    <>
      <SettingsGroup title={t("dashboard.settings.developerApi.apiKeys")} desc={t("apps.api.keysHelp")}>
        {revealedKey && <div className="sgroup-pad"><Revealed value={revealedKey} warning={t("dashboard.settings.developerApi.keyRevealWarning")} onDismiss={() => setRevealedKey(null)} /></div>}
        {keys.isLoading ? <div className="sgroup-pad"><Skeleton className="h-12 w-full" /></div> : activeKeys.length > 0 && (
          <ul className="app-log">
            {activeKeys.map((k) => (
              <li key={k.id}>
                <KeyRound className="muted" aria-hidden="true" />
                <span className="app-log-txt">
                  <span className="app-log-label">{k.name}</span>
                  <span className="app-log-when">{k.keyPrefix}••••••••• · {k.role}</span>
                </span>
                <button type="button" className="btn btn-sm btn-outline-navy app-danger" aria-label={t("apps.api.revoke").replace("{name}", k.name)} onClick={() => revokeKey.mutate(k.id)} disabled={revokeKey.isPending}>
                  <Trash2 aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <SettingsRow label={t("apps.api.newKey")} htmlFor="api-key-name">
          <div className="app-inline">
            <input id="api-key-name" value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder={t("dashboard.settings.developerApi.keyNamePlaceholder")} autoComplete="off" />
            <button type="button" onClick={() => createKey.mutate()} disabled={!keyName.trim() || createKey.isPending} className="btn btn-sm btn-navy">
              {createKey.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {t("dashboard.settings.developerApi.createKey")}
            </button>
          </div>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title={t("dashboard.settings.developerApi.webhooks")} desc={t("apps.api.hooksHelp")}>
        {revealedSecret && <div className="sgroup-pad"><Revealed value={revealedSecret} warning={t("dashboard.settings.developerApi.secretRevealWarning")} onDismiss={() => setRevealedSecret(null)} /></div>}
        {hooks.isLoading ? <div className="sgroup-pad"><Skeleton className="h-12 w-full" /></div> : webhooks.map((w) => (
          <div key={w.id} className="app-hook">
            <ToggleRow label={w.url} help={w.events.join(", ")} checked={w.isEnabled} disabled={toggleHook.isPending} onChange={(on) => toggleHook.mutate({ id: w.id, on })} />
            <button type="button" className="btn btn-sm btn-outline-navy app-danger" aria-label={t("apps.api.deleteHook")} onClick={() => deleteHook.mutate(w.id)} disabled={deleteHook.isPending}>
              <Trash2 aria-hidden="true" />
            </button>
          </div>
        ))}
        <SettingsRow label={t("apps.api.newHook")} help={t("apps.api.newHookHelp")} htmlFor="webhook-url">
          <div className="app-stack">
            <input id="webhook-url" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("dashboard.settings.developerApi.webhookUrlPlaceholder")} autoComplete="off" />
            <div className="app-events" role="group" aria-label={t("apps.api.events")}>
              {allEvents.map((ev) => (
                <button key={ev} type="button" aria-pressed={events.includes(ev)}
                  onClick={() => setEvents((p) => (p.includes(ev) ? p.filter((e) => e !== ev) : [...p, ev]))}
                  className={cn("app-event", events.includes(ev) && "on")}>
                  {ev}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => createHook.mutate()} disabled={!url.trim() || events.length === 0 || createHook.isPending} className="btn btn-sm btn-navy app-self-start">
              {createHook.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Webhook aria-hidden="true" />}
              {t("dashboard.settings.developerApi.addWebhook")}
            </button>
          </div>
        </SettingsRow>
      </SettingsGroup>
    </>
  );
}
