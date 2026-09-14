import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {twoFactorEnabled ? <ShieldCheck className="h-5 w-5 text-green-600" /> : <ShieldOff className="h-5 w-5 text-gray-400" />}
          {t("dashboard.settings.security.twoFactorTitle")}
        </CardTitle>
        <CardDescription>{t("dashboard.settings.security.twoFactorDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {twoFactorEnabled && step === "idle" ? (
          !showDisable ? (
            <Button variant="outline" onClick={() => setShowDisable(true)}>
              {t("dashboard.settings.security.disable")}
            </Button>
          ) : (
            <form onSubmit={handleDisable} className="space-y-3">
              <Input type="password" required placeholder={t("dashboard.settings.security.passwordPlaceholder")} value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} />
              <div className="flex gap-2">
                <Button type="submit" variant="destructive" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("dashboard.settings.security.confirmDisable")}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowDisable(false)}>
                  {t("dashboard.settings.security.cancel")}
                </Button>
              </div>
            </form>
          )
        ) : !twoFactorEnabled && step === "idle" ? (
          <Button onClick={() => setStep("password")}>{t("dashboard.settings.security.enable")}</Button>
        ) : step === "password" ? (
          <form onSubmit={handleEnableStart} className="space-y-3">
            <Input type="password" required autoFocus placeholder={t("dashboard.settings.security.passwordPlaceholder")} value={password} onChange={(e) => setPassword(e.target.value)} />
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("dashboard.settings.security.continue")}
              </Button>
              <Button type="button" variant="ghost" onClick={reset}>{t("dashboard.settings.security.cancel")}</Button>
            </div>
          </form>
        ) : step === "verify" ? (
          <div className="space-y-4">
            {totpUri && (
              <div className="text-sm text-gray-600 break-all bg-gray-50 border border-gray-100 rounded-xl p-3">
                {t("dashboard.settings.security.scanInstructions")}
                <div className="mt-2 font-mono text-xs">{totpUri}</div>
              </div>
            )}
            <form onSubmit={handleVerify} className="space-y-3">
              <Input required autoFocus inputMode="numeric" placeholder="123456" value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} className="text-center tracking-widest" />
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("dashboard.settings.security.verifyAndEnable")}
                </Button>
                <Button type="button" variant="ghost" onClick={reset}>{t("dashboard.settings.security.cancel")}</Button>
              </div>
            </form>
          </div>
        ) : step === "backup-codes" ? (
          <div className="space-y-3">
            <p className="text-sm text-green-700 font-medium">{t("dashboard.settings.security.twoFactorEnabled")}</p>
            <p className="text-sm text-gray-500">{t("dashboard.settings.security.backupCodesHint")}</p>
            <div className="grid grid-cols-2 gap-2 bg-gray-50 border border-gray-100 rounded-xl p-4 font-mono text-sm">
              {backupCodes.map((code) => <span key={code}>{code}</span>)}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(backupCodes.join("\n"));
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {t("dashboard.settings.security.copyBackupCodes")}
            </Button>
            <Button type="button" onClick={reset} className="ml-2">{t("dashboard.settings.security.done")}</Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
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

  if (isLoading) return <Skeleton className="h-32 w-full rounded-2xl" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          {t("dashboard.settings.security.sessionsTitle")}
        </CardTitle>
        <CardDescription>{t("dashboard.settings.security.sessionsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(sessions ?? []).map((s) => (
          <div key={s.token} className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-3">
            <div className="text-sm">
              <div className="font-medium text-gray-900">{s.userAgent || t("dashboard.settings.security.unknownDevice")}</div>
              <div className="text-gray-400 text-xs">{s.ipAddress || "—"} · {s.token === session?.session.token ? t("dashboard.settings.security.currentSession") : new Date(s.createdAt).toLocaleString()}</div>
            </div>
            {s.token !== session?.session.token && (
              <Button variant="ghost" size="sm" disabled={revokingToken === s.token} onClick={() => void handleRevoke(s.token)}>
                {revokingToken === s.token ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AuditLogCard() {
  const { t, lang } = useLanguage();
  const { data, isLoading } = useQuery({ queryKey: ["security-audit-log"], queryFn: securityApi.auditLog });

  if (isLoading) return <Skeleton className="h-48 w-full rounded-2xl" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.settings.security.auditLogTitle")}</CardTitle>
        <CardDescription>{t("dashboard.settings.security.auditLogDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        {!data?.events.length ? (
          <p className="text-sm text-gray-400">{t("dashboard.settings.security.auditLogEmpty")}</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.events.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-sm border-b border-gray-50 last:border-0 py-2">
                <div>
                  <span className="font-medium text-gray-800">{AUDIT_ACTION_LABELS[e.action] ?? e.action}</span>
                  {e.actorEmail && <span className="text-gray-400"> — {e.actorName ?? e.actorEmail}</span>}
                </div>
                <span className="text-gray-400 text-xs whitespace-nowrap">{new Date(e.createdAt).toLocaleString(lang === "fr" ? "fr-CA" : "en-CA")}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SecurityTab() {
  return (
    <div className="space-y-6">
      <TwoFactorCard />
      <SessionsCard />
      <AuditLogCard />
    </div>
  );
}
