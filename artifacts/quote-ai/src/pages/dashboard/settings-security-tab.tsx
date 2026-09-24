import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { ShieldCheck, ShieldOff, Loader2, Monitor, LogOut, Copy, Check, Download, Trash2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { securityApi } from "@/lib/security-api";
import { accountApi, type AccountApiError, type AccountStatusDto } from "@/lib/account-api";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const AUDIT_ACTION_LABELS: Record<string, string> = {
  login: "Signed in",
  "two_factor.enabled": "Two-factor authentication enabled",
  "two_factor.disabled": "Two-factor authentication disabled",
  "session.revoked": "Signed out of a session",
  "session.revoked_all": "Signed out of all other sessions",
  "account.export_requested": "Data export requested",
  "account.deletion_requested": "Account deletion requested",
  "account.deletion_cancelled": "Account deletion cancelled",
};

function TwoFactorCard() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { data: session, refetch: refetchSession } = authClient.useSession();
  const twoFactorEnabled = Boolean((session?.user as { twoFactorEnabled?: boolean } | undefined)?.twoFactorEnabled);

  const [step, setStep] = useState<"idle" | "password" | "verify" | "backup-codes">("idle");
  const [password, setPassword] = useState("");
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [showDisable, setShowDisable] = useState(false);

  async function handleEnableStart(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await authClient.twoFactor.enable({ password, method: "totp", issuer: "QuoteAI" });
      if (result.error) {
        toast({ title: t("dashboard.settings.security.error"), description: result.error.message, variant: "destructive" });
      } else if ("totpURI" in result.data) {
        setTotpUri(result.data.totpURI);
        setBackupCodes(result.data.backupCodes);
        setStep("verify");
      }
    } catch {
      toast({ title: t("dashboard.settings.security.error"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await authClient.twoFactor.verifyTotp({ code: verifyCode.trim() });
      if (result.error) {
        toast({ title: t("dashboard.settings.security.invalidCode"), variant: "destructive" });
      } else {
        setStep("backup-codes");
        await refetchSession();
      }
    } catch {
      toast({ title: t("dashboard.settings.security.error"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await authClient.twoFactor.disable({ password: disablePassword });
      if (result.error) {
        toast({ title: t("dashboard.settings.security.error"), description: result.error.message, variant: "destructive" });
      } else {
        toast({ title: t("dashboard.settings.security.twoFactorDisabled") });
        setShowDisable(false);
        setDisablePassword("");
        await refetchSession();
      }
    } catch {
      toast({ title: t("dashboard.settings.security.error"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep("idle");
    setPassword("");
    setTotpUri(null);
    setBackupCodes([]);
    setVerifyCode("");
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2 className="flex items-center gap-2">
            {twoFactorEnabled ? <ShieldCheck className="h-5 w-5 text-green-600" /> : <ShieldOff className="h-5 w-5 text-muted-foreground" />}
            {t("dashboard.settings.security.twoFactorTitle")}
          </h2>
          <p className="sub">{t("dashboard.settings.security.twoFactorDescription")}</p>
        </div>
      </div>
      <div className="p-5 space-y-4">
        {twoFactorEnabled && step === "idle" ? (
          !showDisable ? (
            <button className="btn btn-outline-navy" onClick={() => setShowDisable(true)}>
              {t("dashboard.settings.security.disable")}
            </button>
          ) : (
            <form onSubmit={handleDisable} className="space-y-3">
              <Input type="password" required placeholder={t("dashboard.settings.security.passwordPlaceholder")} value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} />
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="btn btn-navy" style={{ background: "var(--red)", borderColor: "var(--red)" }}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("dashboard.settings.security.confirmDisable")}
                </button>
                <button type="button" className="btn btn-outline-navy" onClick={() => setShowDisable(false)}>
                  {t("dashboard.settings.security.cancel")}
                </button>
              </div>
            </form>
          )
        ) : !twoFactorEnabled && step === "idle" ? (
          <button className="btn btn-navy" onClick={() => setStep("password")}>{t("dashboard.settings.security.enable")}</button>
        ) : step === "password" ? (
          <form onSubmit={handleEnableStart} className="space-y-3">
            <Input type="password" required autoFocus placeholder={t("dashboard.settings.security.passwordPlaceholder")} value={password} onChange={(e) => setPassword(e.target.value)} />
            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="btn btn-navy">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("dashboard.settings.security.continue")}
              </button>
              <button type="button" className="btn btn-outline-navy" onClick={reset}>{t("dashboard.settings.security.cancel")}</button>
            </div>
          </form>
        ) : step === "verify" ? (
          <div className="space-y-4">
            {totpUri && (
              <div className="text-sm text-muted-foreground break-all bg-muted border border-border rounded-[var(--radius-sm)] p-3">
                {t("dashboard.settings.security.scanInstructions")}
                <div className="mt-2 font-mono text-xs">{totpUri}</div>
              </div>
            )}
            <form onSubmit={handleVerify} className="space-y-3">
              <Input required autoFocus inputMode="numeric" placeholder="123456" value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} className="text-center tracking-widest" />
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="btn btn-navy">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("dashboard.settings.security.verifyAndEnable")}
                </button>
                <button type="button" className="btn btn-outline-navy" onClick={reset}>{t("dashboard.settings.security.cancel")}</button>
              </div>
            </form>
          </div>
        ) : step === "backup-codes" ? (
          <div className="space-y-3">
            <p className="text-sm text-green-700 font-medium">{t("dashboard.settings.security.twoFactorEnabled")}</p>
            <p className="text-sm text-muted-foreground">{t("dashboard.settings.security.backupCodesHint")}</p>
            <div className="grid grid-cols-2 gap-2 bg-muted border border-border rounded-[var(--radius-sm)] p-4 font-mono text-sm">
              {backupCodes.map((code) => <span key={code}>{code}</span>)}
            </div>
            <button
              type="button"
              className="btn btn-outline-navy"
              onClick={() => {
                void navigator.clipboard.writeText(backupCodes.join("\n"));
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {t("dashboard.settings.security.copyBackupCodes")}
            </button>
            <button type="button" className="btn btn-navy ml-2" onClick={reset}>{t("dashboard.settings.security.done")}</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SessionsCard() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { data: session } = authClient.useSession();
  const { data: sessions, refetch, isLoading } = useQuery({
    queryKey: ["auth-sessions"],
    queryFn: async () => {
      const result = await authClient.listSessions();
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
  });
  const [revokingToken, setRevokingToken] = useState<string | null>(null);

  async function handleRevoke(token: string) {
    setRevokingToken(token);
    try {
      const result = await authClient.revokeSession({ token });
      if (result.error) {
        toast({ title: t("dashboard.settings.security.error"), description: result.error.message, variant: "destructive" });
      } else {
        await refetch();
      }
    } finally {
      setRevokingToken(null);
    }
  }

  if (isLoading) return <Skeleton className="h-32 w-full rounded-[var(--radius)]" />;

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2 className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            {t("dashboard.settings.security.sessionsTitle")}
          </h2>
          <p className="sub">{t("dashboard.settings.security.sessionsDescription")}</p>
        </div>
      </div>
      <div>
        {(sessions ?? []).map((s) => (
          <div key={s.token} className="set-row">
            <div className="txt">
              <b>{s.userAgent || t("dashboard.settings.security.unknownDevice")}</b>
              <span>{s.ipAddress || "—"} · {s.token === session?.session.token ? t("dashboard.settings.security.currentSession") : new Date(s.createdAt).toLocaleString()}</span>
            </div>
            {s.token !== session?.session.token && (
              <button className="btn btn-outline-navy btn-sm" disabled={revokingToken === s.token} onClick={() => void handleRevoke(s.token)}>
                {revokingToken === s.token ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditLogCard() {
  const { t, lang } = useLanguage();
  const { data, isLoading } = useQuery({ queryKey: ["security-audit-log"], queryFn: securityApi.auditLog });

  if (isLoading) return <Skeleton className="h-48 w-full rounded-[var(--radius)]" />;

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>{t("dashboard.settings.security.auditLogTitle")}</h2>
          <p className="sub">{t("dashboard.settings.security.auditLogDescription")}</p>
        </div>
      </div>
      <div className="p-5">
        {!data?.events.length ? (
          <p className="text-sm text-muted-foreground">{t("dashboard.settings.security.auditLogEmpty")}</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.events.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-sm border-b border-border last:border-0 py-2">
                <div>
                  <span className="font-medium text-foreground">{AUDIT_ACTION_LABELS[e.action] ?? e.action}</span>
                  {e.actorEmail && <span className="text-muted-foreground"> — {e.actorName ?? e.actorEmail}</span>}
                </div>
                <span className="text-muted-foreground text-xs whitespace-nowrap">{new Date(e.createdAt).toLocaleString(lang === "fr" ? "fr-CA" : "en-CA")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


// ── Phase 72: data export + account deletion (PIPEDA / Law 25) ──────────────

function fmtBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DataExportCard({ status, refetch }: { status: AccountStatusDto; refetch: () => Promise<unknown> }) {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const locale = lang === "fr" ? "fr-CA" : "en-CA";
  const exportMutation = useMutation({
    mutationFn: () => accountApi.requestExport(lang === "fr" ? "fr" : "en"),
    onSuccess: async (r) => {
      toast({ title: t("dashboard.settings.account.exportStarted"), description: t("dashboard.settings.account.exportStartedDesc").replace("{email}", r.email) });
      await refetch();
      void queryClient.invalidateQueries({ queryKey: ["security-audit-log"] });
    },
    onError: (err: unknown) => {
      const e = err as AccountApiError;
      toast({ title: e.code === "EXPORT_RATE_LIMITED" ? t("dashboard.settings.account.exportRateLimited") : t("dashboard.settings.security.error"), description: e.code === "EXPORT_RATE_LIMITED" ? undefined : e.message, variant: "destructive" });
    },
  });
  const latest = status.exports[0];

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2 className="flex items-center gap-2"><Download className="h-5 w-5" />{t("dashboard.settings.account.exportTitle")}</h2>
          <p className="sub">{t("dashboard.settings.account.exportDescription")}</p>
        </div>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-sm text-muted-foreground">{t("dashboard.settings.account.exportExplain")}</p>
        {!status.canExport ? (
          <p className="text-sm text-muted-foreground">{t("dashboard.settings.account.ownerOnly")}</p>
        ) : (
          <button className="btn btn-navy" disabled={exportMutation.isPending || latest?.status === "pending"} onClick={() => exportMutation.mutate()}>
            {exportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("dashboard.settings.account.exportButton")}
          </button>
        )}
        {status.exports.length > 0 && (
          <div>
            {status.exports.map((e) => (
              <div key={e.id} className="set-row" style={{ padding: "12px 0" }}>
                <div className="txt">
                  <b>
                    {e.status === "ready" ? t("dashboard.settings.account.exportReady") : e.status === "failed" ? t("dashboard.settings.account.exportFailed") : t("dashboard.settings.account.exportPending")}
                    {e.status === "ready" && e.sizeBytes ? ` · ${fmtBytes(e.sizeBytes)}` : ""}
                  </b>
                  <span>
                    {new Date(e.createdAt).toLocaleString(locale)}
                    {e.status === "ready" && e.expiresAt ? ` · ${t("dashboard.settings.account.exportExpires").replace("{date}", new Date(e.expiresAt).toLocaleDateString(locale))}` : ""}
                    {e.status === "failed" && e.error ? ` · ${e.error}` : ""}
                  </span>
                </div>
                {e.status === "ready" && e.downloadUrl && (
                  <a className="btn btn-outline-navy btn-sm" href={e.downloadUrl} rel="noopener">
                    <Download className="h-4 w-4" /> {t("dashboard.settings.account.download")}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DeleteAccountCard({ status }: { status: AccountStatusDto }) {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const { data: session } = authClient.useSession();
  const twoFactorEnabled = Boolean((session?.user as { twoFactorEnabled?: boolean } | undefined)?.twoFactorEnabled);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [done, setDone] = useState<{ scheduledFor: string } | null>(null);
  const confirmWord = t("dashboard.settings.account.deleteConfirmWord");
  const locale = lang === "fr" ? "fr-CA" : "en-CA";
  const confirmed = confirmText.trim().toUpperCase() === confirmWord.toUpperCase();

  const deleteMutation = useMutation({
    mutationFn: () => accountApi.requestDeletion({ password, code: twoFactorEnabled ? code : undefined, language: lang === "fr" ? "fr" : "en" }),
    onSuccess: (r) => setDone({ scheduledFor: r.scheduledFor }),
    onError: (err: unknown) => {
      const e = err as AccountApiError;
      const title =
        e.code === "INVALID_PASSWORD" ? t("dashboard.settings.account.wrongPassword")
        : e.code === "INVALID_TWO_FACTOR" || e.code === "TWO_FACTOR_REQUIRED" ? t("dashboard.settings.security.invalidCode")
        : t("dashboard.settings.security.error");
      toast({ title, description: e.code ? undefined : e.message, variant: "destructive" });
    },
  });

  const head = (sub: string) => (
    <div className="card-head">
      <div>
        <h2 className="flex items-center gap-2"><Trash2 className="h-5 w-5" style={{ color: "var(--red)" }} />{t("dashboard.settings.account.deleteTitle")}</h2>
        <p className="sub">{sub}</p>
      </div>
    </div>
  );

  if (status.pendingDeletion) {
    return (
      <div className="card" style={{ borderColor: "var(--red-t)" }}>
        {head(t("dashboard.settings.account.deletePendingSub").replace("{date}", new Date(status.pendingDeletion.scheduledFor).toLocaleDateString(locale)))}
        <div className="p-5"><p className="text-sm text-muted-foreground">{t("dashboard.settings.account.deletePendingBody")}</p></div>
      </div>
    );
  }

  return (
    <div className="card" style={{ borderColor: "var(--red-t)" }}>
      {head(t("dashboard.settings.account.deleteDescription"))}
      <div className="p-5 space-y-4">
        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
          <li>{t("dashboard.settings.account.deletePoint1").replace("{days}", String(status.graceDays))}</li>
          <li>{status.ownsProfile ? t("dashboard.settings.account.deletePoint2Owner") : t("dashboard.settings.account.deletePoint2Member")}</li>
          {status.ownsProfile && <li>{t("dashboard.settings.account.deletePoint3").replace("{years}", String(status.retentionYears))}</li>}
          <li>{t("dashboard.settings.account.deletePoint4")}</li>
        </ul>
        <p className="text-xs text-muted-foreground">
          {t("dashboard.settings.account.deletePolicy")}{" "}
          <a href={lang === "fr" ? "/fr/confidentialite/" : "/privacy-policy/"} target="_blank" rel="noopener" className="underline">{t("dashboard.settings.account.privacyPolicy")}</a>
        </p>
        <button className="btn btn-navy" style={{ background: "var(--red)", borderColor: "var(--red)" }} onClick={() => setOpen(true)}>
          {t("dashboard.settings.account.deleteButton")}
        </button>
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!deleteMutation.isPending && !done) setOpen(v); }}>
        <DialogContent size="md">
          {done ? (
            <>
              <DialogHeader>
                <DialogTitle>{t("dashboard.settings.account.deleteScheduledTitle")}</DialogTitle>
                <DialogDescription>{t("dashboard.settings.account.deleteScheduledBody").replace("{date}", new Date(done.scheduledFor).toLocaleDateString(locale))}</DialogDescription>
              </DialogHeader>
              <DialogBody>
                <button className="btn btn-navy" onClick={() => { window.location.href = "/"; }}>{t("dashboard.settings.security.done")}</button>
              </DialogBody>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{t("dashboard.settings.account.deleteDialogTitle")}</DialogTitle>
                <DialogDescription>{t("dashboard.settings.account.deleteDialogDesc")}</DialogDescription>
              </DialogHeader>
              <DialogBody>
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (confirmed) deleteMutation.mutate();
                  }}
                >
                  <Input type="password" required autoFocus autoComplete="current-password" placeholder={t("dashboard.settings.security.passwordPlaceholder")} value={password} onChange={(e) => setPassword(e.target.value)} />
                  {twoFactorEnabled && (
                    <Input required inputMode="numeric" placeholder={t("dashboard.settings.account.twoFactorPlaceholder")} value={code} onChange={(e) => setCode(e.target.value)} />
                  )}
                  <Input required placeholder={t("dashboard.settings.account.deleteTypeToConfirm").replace("{word}", confirmWord)} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
                  <div className="flex gap-2">
                    <button type="submit" disabled={deleteMutation.isPending || !confirmed} className="btn btn-navy" style={{ background: "var(--red)", borderColor: "var(--red)" }}>
                      {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("dashboard.settings.account.deleteConfirmButton")}
                    </button>
                    <button type="button" className="btn btn-outline-navy" onClick={() => setOpen(false)}>{t("dashboard.settings.security.cancel")}</button>
                  </div>
                </form>
              </DialogBody>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountCards() {
  const { data, isLoading, refetch } = useQuery({ queryKey: ["account-status"], queryFn: accountApi.status });
  if (isLoading || !data) return <Skeleton className="h-48 w-full rounded-[var(--radius)]" />;
  return (
    <>
      {data.ownsProfile && <DataExportCard status={data} refetch={refetch} />}
      <DeleteAccountCard status={data} />
    </>
  );
}

export function SecurityTab() {
  return (
    <div className="stack">
      <TwoFactorCard />
      <SessionsCard />
      <AuditLogCard />
      <AccountCards />
    </div>
  );
}
