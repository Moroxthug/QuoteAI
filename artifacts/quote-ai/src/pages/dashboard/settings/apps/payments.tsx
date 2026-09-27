import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plug, RefreshCw } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { financeitApi, flinksApi, stripeConnectApi, type FlinksAccountDto } from "@/lib/invoices-api";
import { ActionRow, SettingsGroup, SettingsRow, ToggleRow } from "../ui";
import { AccountFacts, DisconnectRow, fmtDate, fmtDateTime } from "./ui";
import { STATUS_KEYS } from "./status";

// ── Stripe (card payments on invoices, through the company's own Connect account) ──

export function StripePanel() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { data: status, isLoading } = useQuery({ queryKey: STATUS_KEYS.stripe, queryFn: stripeConnectApi.status });
  const onboard = useMutation({
    mutationFn: stripeConnectApi.onboard,
    onSuccess: (r) => { window.location.href = r.url; },
    onError: () => toast({ title: t("dashboard.settings.stripeConnect.error"), variant: "destructive" }),
  });
  if (isLoading) return <Skeleton className="h-32 w-full rounded-[var(--radius)]" />;

  const connected = status?.connected ?? false;
  const charges = status?.chargesEnabled ?? false;
  // Phase 73: the platform fee is disclosed before connecting.
  const fee = (status?.applicationFeeBps ?? 0) > 0
    ? t("dashboard.settings.stripeConnect.fee").replace("{pct}", status?.applicationFeePercent ?? "0")
    : t("dashboard.settings.stripeConnect.feeNone");
  const cta = connected ? (charges ? t("dashboard.settings.stripeConnect.manage") : t("dashboard.settings.stripeConnect.finishOnboarding")) : t("dashboard.settings.stripeConnect.connectCta");

  return (
    <SettingsGroup title={connected ? t("apps.detail.account") : undefined}>
      {connected && (
        <AccountFacts facts={[
          [t("apps.detail.status"), charges ? t("dashboard.settings.stripeConnect.active") : t("dashboard.settings.stripeConnect.onboardingIncomplete")],
          [t("apps.stripe.payouts"), status?.payoutsEnabled ? t("apps.detail.on") : t("apps.detail.notYet")],
          [t("apps.detail.connectedSince"), fmtDate(status?.connectedAt) ?? "—"],
        ]} />
      )}
      <ActionRow label={connected ? (charges ? t("apps.stripe.manageLabel") : t("apps.stripe.finishLabel")) : t("apps.stripe.connectLabel")} help={fee}>
        <button type="button" onClick={() => onboard.mutate()} disabled={onboard.isPending} className={connected && charges ? "btn btn-sm btn-outline-navy" : "btn btn-sm btn-navy"} data-primary-action>
          {onboard.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plug aria-hidden="true" />}
          {cta}
        </button>
      </ActionRow>
      {connected && <p className="sgroup-pad app-muted app-note">{t("apps.stripe.disconnectNote")}</p>}
    </SettingsGroup>
  );
}

// ── Financeit (financing offers on quotes) ───────────────────────────────────

export function FinanceitPanel() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useQuery({ queryKey: STATUS_KEYS.financeit, queryFn: financeitApi.status });
  const [dealerId, setDealerId] = useState("");
  const invalidate = () => queryClient.invalidateQueries({ queryKey: STATUS_KEYS.financeit });
  const onError = () => toast({ title: t("dashboard.settings.financeit.error"), variant: "destructive" });
  const save = useMutation({
    mutationFn: () => financeitApi.saveDealer(dealerId.trim()),
    onSuccess: () => { invalidate(); setDealerId(""); toast({ title: t("dashboard.settings.financeit.connected") }); },
    onError,
  });
  const toggle = useMutation({ mutationFn: (v: boolean) => financeitApi.toggle(v), onSuccess: invalidate, onError });
  const disconnect = useMutation({
    mutationFn: financeitApi.disconnect,
    onSuccess: () => { invalidate(); toast({ title: t("dashboard.settings.financeit.disconnected") }); },
    onError,
  });
  if (isLoading) return <Skeleton className="h-32 w-full rounded-[var(--radius)]" />;

  if (!status?.connected) {
    return (
      <SettingsGroup>
        <SettingsRow label={t("dashboard.settings.financeit.dealerIdLabel")} help={t("dashboard.settings.financeit.dealerIdHelp")} htmlFor="financeit-dealer">
          <input id="financeit-dealer" value={dealerId} onChange={(e) => setDealerId(e.target.value)} placeholder={t("dashboard.settings.financeit.dealerIdPlaceholder")} autoComplete="off" />
        </SettingsRow>
        <div className="app-group-foot">
          <button type="button" onClick={() => save.mutate()} disabled={!dealerId.trim() || save.isPending} className="btn btn-sm btn-navy" data-primary-action>
            {save.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plug aria-hidden="true" />}
            {t("dashboard.settings.financeit.connectCta")}
          </button>
        </div>
      </SettingsGroup>
    );
  }

  return (
    <>
      <SettingsGroup title={t("apps.detail.account")}>
        <AccountFacts facts={[
          [t("dashboard.settings.financeit.dealerIdLabel"), status.dealerId ?? "—"],
          [t("apps.detail.connectedSince"), fmtDate(status.connectedAt) ?? "—"],
          [t("apps.financeit.lastApplied"), fmtDateTime(status.lastAppliedAt) ?? t("apps.detail.never")],
        ]} />
        <ToggleRow label={t("apps.financeit.offerOn")} help={t("apps.financeit.offerOnHelp")} checked={status.isEnabled ?? true} disabled={toggle.isPending} onChange={(v) => toggle.mutate(v)} />
      </SettingsGroup>
      <DisconnectRow name="Financeit" pending={disconnect.isPending} onConfirm={() => disconnect.mutate()} />
    </>
  );
}

// ── Flinks (bank feed) ───────────────────────────────────────────────────────

function FlinksConnectDialog({ open, onOpenChange, onConnected }: { open: boolean; onOpenChange: (open: boolean) => void; onConnected: (accounts: FlinksAccountDto[]) => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({ queryKey: ["flinks-connect-url"], queryFn: flinksApi.connectUrl, enabled: open, retry: false });
  const connect = useMutation({
    mutationFn: ({ loginId, institutionName }: { loginId: string; institutionName: string }) => flinksApi.connect(loginId, institutionName),
    onSuccess: (r) => { onConnected(r.accounts); onOpenChange(false); },
    onError: () => toast({ title: t("dashboard.settings.flinks.error"), variant: "destructive" }),
  });

  useEffect(() => {
    if (!open) return;
    function handleMessage(event: MessageEvent) {
      const d = event.data as { step?: string; loginId?: string; institution?: string } | undefined;
      if (d?.step === "REDIRECT" && d.loginId) connect.mutate({ loginId: d.loginId, institutionName: d.institution ?? "Bank account" });
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" tall>
        <DialogHeader>
          <DialogTitle>{t("dashboard.settings.flinks.connectTitle")}</DialogTitle>
          <DialogDescription>{t("dashboard.settings.flinks.connectDialogDesc")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flush">
          {isLoading || !data?.url ? (
            <div className="card-empty" style={{ flex: 1, display: "grid", placeItems: "center" }}><Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--faint)" }} /></div>
          ) : (
            <iframe src={data.url} title="Flinks Connect" style={{ width: "100%", height: "100%", border: 0, flex: 1 }} />
          )}
          {connect.isPending && (
            <p className="foot-note" style={{ padding: "10px 22px", borderTop: "1px solid var(--soft)", display: "flex", alignItems: "center", gap: 8 }}><Loader2 className="h-3 w-3 animate-spin" /> {t("dashboard.settings.flinks.connecting")}</p>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export function FlinksPanel() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useQuery({ queryKey: STATUS_KEYS.flinks, queryFn: flinksApi.status });
  const [showConnect, setShowConnect] = useState(false);
  const [pending, setPending] = useState<FlinksAccountDto[] | null>(null);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: STATUS_KEYS.flinks });
  const onError = () => toast({ title: t("dashboard.settings.flinks.error"), variant: "destructive" });
  const hasAccount = !!status?.selectedAccount;
  // Connected but no account picked (the picker was closed): fetch the accounts again.
  const accounts = useQuery({ queryKey: ["flinks-accounts"], queryFn: flinksApi.accounts, enabled: !!status?.connected && !hasAccount && !pending, retry: false });
  const choices = pending ?? accounts.data?.accounts ?? null;
  const select = useMutation({
    mutationFn: (a: FlinksAccountDto) => flinksApi.selectAccount(a),
    onSuccess: () => { invalidate(); setPending(null); toast({ title: t("dashboard.settings.flinks.connected") }); },
    onError,
  });
  const toggle = useMutation({ mutationFn: (v: boolean) => flinksApi.toggle(v), onSuccess: invalidate, onError });
  const disconnect = useMutation({
    mutationFn: flinksApi.disconnect,
    onSuccess: () => { invalidate(); toast({ title: t("dashboard.settings.flinks.disconnected") }); },
    onError,
  });
  const sync = useMutation({
    mutationFn: flinksApi.sync,
    onSuccess: () => { invalidate(); queryClient.invalidateQueries({ queryKey: ["flinks-transactions"] }); },
    onError,
  });
  if (isLoading) return <Skeleton className="h-32 w-full rounded-[var(--radius)]" />;

  if (!status?.connected) {
    return (
      <>
        <SettingsGroup>
          <ActionRow label={t("apps.flinks.connectLabel")} help={t("dashboard.settings.flinks.connectHelp")}>
            <button type="button" onClick={() => setShowConnect(true)} className="btn btn-sm btn-navy" data-primary-action>
              <Plug aria-hidden="true" /> {t("dashboard.settings.flinks.connectCta")}
            </button>
          </ActionRow>
        </SettingsGroup>
        <FlinksConnectDialog open={showConnect} onOpenChange={setShowConnect} onConnected={(a) => { setPending(a); invalidate(); }} />
      </>
    );
  }

  return (
    <>
      {!hasAccount ? (
        <SettingsGroup title={t("apps.flinks.pickTitle")} desc={t("dashboard.settings.flinks.pickAccountHelp")}>
          {choices?.length ? (
            <ul className="app-choices">
              {choices.map((a) => (
                <li key={a.id}>
                  <button type="button" disabled={select.isPending} onClick={() => select.mutate(a)} className="app-choice">
                    <span>{a.name}{a.last4 ? ` ••••${a.last4}` : ""}</span>
                    <span className="app-muted">{a.institution}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sgroup-pad app-muted">{accounts.isLoading ? t("dashboard.settings.flinks.connecting") : t("dashboard.settings.flinks.noAccountSelected")}</p>
          )}
        </SettingsGroup>
      ) : (
        <SettingsGroup title={t("apps.detail.account")}>
          <AccountFacts facts={[
            [t("apps.flinks.bank"), status.institutionName ?? "—"],
            [t("apps.flinks.account"), `${status.selectedAccount?.name ?? ""}${status.selectedAccount?.last4 ? ` ••••${status.selectedAccount.last4}` : ""}`],
            [t("apps.detail.lastSync"), fmtDateTime(status.lastSyncedAt) ?? t("apps.detail.never")],
          ]} />
          <ToggleRow label={t("apps.flinks.feedOn")} help={t("apps.flinks.feedOnHelp")} checked={status.isEnabled ?? true} disabled={toggle.isPending} onChange={(v) => toggle.mutate(v)} />
          <ActionRow label={t("dashboard.settings.flinks.syncNow")} help={t("dashboard.settings.flinks.movedToBooks")}>
            <button type="button" onClick={() => sync.mutate()} disabled={sync.isPending} className="btn btn-sm btn-outline-navy">
              {sync.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
              {t("apps.detail.runNow")}
            </button>
            <Link href="/dashboard/books?tab=bank" className="btn btn-sm btn-outline-navy">{t("dashboard.settings.flinks.openBooks")}</Link>
          </ActionRow>
        </SettingsGroup>
      )}
      <DisconnectRow name="Flinks" pending={disconnect.isPending} onConfirm={() => disconnect.mutate()} />
    </>
  );
}
