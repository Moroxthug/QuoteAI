import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Copy, KeyRound, Loader2, Printer } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/i18n/LanguageContext";
import { peopleApi, type AccessCodeDto } from "@/lib/people-api";
import type { TeamMemberRole } from "@/lib/team-members-api";

// Phase 91: access codes — the owner hands them out (text, print, read aloud),
// each person types one at /join and creates their own login. The codes are
// shown once: the server keeps only a hash and the last four characters.

const ROLES: TeamMemberRole[] = ["office", "foreman", "viewer", "admin"];

function joinUrl(): string {
  return `${window.location.origin}/join`;
}

/** Make codes: count + role, then the list to copy or print. Used on the team page and at the end of onboarding. */
export function AccessCodesForm({ maxCount, onMade, onError }: { maxCount: number; onMade?: (codes: AccessCodeDto[]) => void; onError: (e: Error & { code?: string }) => void }) {
  const { t } = useLanguage();
  const [count, setCount] = useState(Math.min(3, Math.max(1, maxCount)));
  const [role, setRole] = useState<TeamMemberRole>("office");
  const [codes, setCodes] = useState<AccessCodeDto[] | null>(null);
  const make = useMutation({
    mutationFn: () => peopleApi.makeCodes(count, role),
    onSuccess: (r) => { setCodes(r.codes); onMade?.(r.codes); },
    onError,
  });
  if (codes) return <AccessCodeList codes={codes} onMore={() => setCodes(null)} />;
  return (
    <div className="stack" style={{ gap: 12 }}>
      {maxCount < 1 ? (
        <p className="text-sm m-0">{t("codes.noSeats")}</p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="field" style={{ margin: 0, width: 110 }}>
            <label htmlFor="codes-count">{t("codes.count")}</label>
            <input id="codes-count" type="number" min={1} max={Math.min(25, maxCount)} value={count} onChange={(e) => setCount(Math.max(1, Math.min(Math.min(25, maxCount), Number(e.target.value) || 1)))} />
          </div>
          <div className="field" style={{ margin: 0, flex: "1 1 180px" }}>
            <label htmlFor="codes-role">{t("codes.role")}</label>
            <select id="codes-role" value={role} onChange={(e) => setRole(e.target.value as TeamMemberRole)}>
              {ROLES.map((r) => <option key={r} value={r}>{t(`team.members.role.${r}`)}</option>)}
            </select>
          </div>
          <button type="button" className="btn btn-sm btn-navy" disabled={make.isPending} onClick={() => make.mutate()}>
            {make.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} {t("codes.make")}
          </button>
        </div>
      )}
      <p className="foot-note m-0">{t("codes.hint").replace("{url}", joinUrl())}</p>
    </div>
  );
}

function AccessCodeList({ codes, onMore }: { codes: AccessCodeDto[]; onMore?: () => void }) {
  const { t, lang } = useLanguage();
  const [copied, setCopied] = useState(false);
  const expires = new Date(codes[0]?.expiresAt ?? Date.now()).toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", { day: "numeric", month: "long" });
  const text = [t("codes.shareIntro").replace("{url}", joinUrl()), "", ...codes.map((c) => `${c.code}  (${t(`group.role.${c.role}`)})`), "", t("codes.expires").replace("{date}", expires)].join("\n");
  const copy = () => { void navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const print = () => {
    const w = window.open("", "_blank", "width=600,height=700");
    if (!w) return;
    w.document.title = t("codes.printTitle");
    const pre = w.document.createElement("pre");
    pre.style.cssText = "font: 16px/1.8 ui-monospace, monospace; padding: 24px; white-space: pre-wrap";
    pre.textContent = text;
    w.document.body.appendChild(pre);
    w.print();
  };
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="notice ok" role="status"><Check /><span className="grow">{t("codes.madeOnce")}</span></div>
      <ul className="stack" style={{ gap: 6, margin: 0, padding: 0, listStyle: "none" }}>
        {codes.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2" style={{ background: "var(--soft)", borderRadius: 10 }}>
            <code style={{ fontSize: 17, fontWeight: 800, letterSpacing: ".08em", color: "var(--navy)" }}>{c.code}</code>
            <span className="chip chip-purple">{t(`group.role.${c.role}`)}</span>
          </li>
        ))}
      </ul>
      <p className="foot-note m-0">{t("codes.expires").replace("{date}", expires)}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-sm btn-outline-navy" onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? t("team.invite.copied") : t("codes.copyAll")}</button>
        <button type="button" className="btn btn-sm btn-outline-navy" onClick={print}><Printer className="h-4 w-4" /> {t("codes.print")}</button>
        {onMore && <button type="button" className="btn btn-sm btn-txt" onClick={onMore}>{t("codes.more")}</button>}
      </div>
    </div>
  );
}

export function AccessCodesDialog({ open, onOpenChange, available, onMade, onError }: { open: boolean; onOpenChange: (v: boolean) => void; available: number; onMade: () => void; onError: (e: Error & { code?: string }) => void }) {
  const { t } = useLanguage();
  const [key, setKey] = useState(0);
  useEffect(() => { if (open) setKey((k) => k + 1); }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("codes.title")}</DialogTitle><DialogDescription>{t("codes.desc")}</DialogDescription></DialogHeader>
        <DialogBody><AccessCodesForm key={key} maxCount={available} onMade={onMade} onError={onError} /></DialogBody>
        <DialogFooter><button type="button" className="btn btn-sm btn-outline-navy" onClick={() => onOpenChange(false)}>{t("codes.done")}</button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
