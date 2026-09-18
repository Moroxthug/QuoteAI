import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { ShieldCheck, ShieldOff, Loader2, Monitor, LogOut, Copy, Check } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { securityApi } from "@/lib/security-api";

const AUDIT_ACTION_LABELS: Record<string, string> = {
  login: "Signed in",
  "two_factor.enabled": "Two-factor authentication enabled",
  "two_factor.disabled": "Two-factor authentication disabled",
  "session.revoked": "Signed out of a session",
  "session.revoked_all": "Signed out of all other sessions",
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

export function SecurityTab() {
  return (
    <div className="stack">
      <TwoFactorCard />
      <SessionsCard />
      <AuditLogCard />
    </div>
  );
}
