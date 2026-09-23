import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CreditCard, HardHat, Loader2, Mail, Minus, Plus, Send, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { apiRequest, apiJson, formatCents } from "@/lib/jobs-api";
import { PLAN_IDS, SEATS_INCLUDED, type PlanId } from "@/lib/plans";
import { peopleApi } from "@/lib/people-api";
import { teamMembersApi, type TeamMemberRole } from "@/lib/team-members-api";
import { AccessCodesForm } from "@/components/team/access-codes";

// Phase 91: the last onboarding step. Either the plan picked on the pricing
// page goes to checkout with the extra seats the company asked for, or — when
// the company already has team accounts — the owner invites people right
// here, by email or with access codes. Crews on site never need a seat.

const SEAT_CENTS = 1500; // display only; matches scripts/src/stripe-addon-prices.ts
const ROLES: TeamMemberRole[] = ["office", "foreman", "viewer", "admin"];
const PLAN_NAMES: Record<PlanId, string> = { free: "Free", monthly_starter: "Starter", monthly_pro: "Pro", monthly_elite: "Elite" };

export function TeamStep({ plan, seatsWanted, fieldCrew, onDone }: { plan: string | null; seatsWanted: number | undefined; fieldCrew: boolean | undefined; onDone: () => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const onError = (e: Error & { code?: string }) => toast({ title: e.code === "SEAT_LIMIT" ? t("team.members.seatLimitTitle") : t("jobs.error"), description: e.message, variant: "destructive" });
  const chosen = plan && (PLAN_IDS as readonly string[]).includes(plan) && plan !== "free" ? (plan as PlanId) : null;
  const profile = useQuery({ queryKey: ["onboarding-profile"], queryFn: () => apiRequest<{ features?: Record<string, boolean> }>("/api/business-profile") });
  const hasTeam = !!profile.data?.features?.team_accounts;
  const seats = useQuery({ queryKey: ["seats"], queryFn: peopleApi.seats, enabled: hasTeam });

  const included = chosen ? SEATS_INCLUDED[chosen] : 0;
  const [extra, setExtra] = useState(() => Math.max(0, (seatsWanted ?? 0) - included));
  const checkout = useMutation({
    mutationFn: () => apiRequest<{ url: string }>("/api/payments/checkout", { method: "POST", body: apiJson({ planType: chosen, extraSeats: extra }) }),
    onSuccess: (r) => { window.location.href = r.url; },
    onError,
  });

  const [rows, setRows] = useState<{ email: string; role: TeamMemberRole }[]>([{ email: "", role: "office" }]);
  const [sent, setSent] = useState<string[]>([]);
  const available = seats.data ? seats.data.limit - seats.data.used : 0;
  const invite = useMutation({
    mutationFn: async () => {
      const done: string[] = [];
      for (const r of rows.filter((x) => x.email.trim())) {
        await teamMembersApi.invite(r.email.trim(), r.role, true);
        done.push(r.email.trim());
      }
      return done;
    },
    onSuccess: (done) => { setSent((s) => [...s, ...done]); setRows([{ email: "", role: "office" }]); void queryClient.invalidateQueries({ queryKey: ["seats"] }); },
    onError: (e: Error & { code?: string }) => { onError(e); void queryClient.invalidateQueries({ queryKey: ["seats"] }); },
  });

  return (
    <div className="stack" style={{ gap: 16 }}>
      {chosen && !hasTeam && (
        <section className="card">
          <div className="card-head"><div><h2 className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> {t("setup.team.planTitle").replace("{plan}", PLAN_NAMES[chosen])}</h2><p className="sub">{t("setup.team.planSub").replace("{included}", String(included))}</p></div></div>
          <div className="p-5 stack" style={{ gap: 12 }}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="t-strong m-0">{t("setup.team.extraSeats")}</p>
                <p className="foot-note m-0">{t("seats.price").replace("{price}", formatCents(SEAT_CENTS)).replace("{per}", t("seats.perMonth"))}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="ic-btn" aria-label={t("seats.less")} disabled={extra <= 0} onClick={() => setExtra((n) => Math.max(0, n - 1))}><Minus /></button>
                <output className="t-strong" style={{ minWidth: 32, textAlign: "center", fontSize: 18 }} aria-live="polite">{extra}</output>
                <button type="button" className="ic-btn" aria-label={t("seats.more")} disabled={extra >= 200} onClick={() => setExtra((n) => n + 1)}><Plus /></button>
              </div>
            </div>
            <p className="text-sm m-0">{t("setup.team.total").replace("{total}", String(included + extra)).replace("{wanted}", String(seatsWanted ?? included))}</p>
            <button type="button" className="btn btn-navy" disabled={checkout.isPending} onClick={() => checkout.mutate()}>
              {checkout.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} {t("setup.team.checkout")}
            </button>
            <p className="foot-note m-0">{t("setup.team.checkoutHint")}</p>
          </div>
        </section>
      )}

      {hasTeam && (
        <section className="card">
          <div className="card-head"><div><h2 className="flex items-center gap-2"><Mail className="h-4 w-4" /> {t("setup.team.inviteTitle")}</h2><p className="sub">{seats.data ? t("setup.team.seatsLeft").replace("{n}", String(Math.max(0, available))).replace("{limit}", String(seats.data.limit)) : "…"}</p></div></div>
          <div className="p-5 stack" style={{ gap: 12 }}>
            {rows.map((r, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <div className="field" style={{ margin: 0, flex: "1 1 220px" }}>
                  <label htmlFor={`inv-email-${i}`}>{t("team.members.email")}</label>
                  <input id={`inv-email-${i}`} type="email" value={r.email} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} placeholder="name@company.ca" />
                </div>
                <div className="field" style={{ margin: 0, width: 150 }}>
                  <label htmlFor={`inv-role-${i}`}>{t("codes.role")}</label>
                  <select id={`inv-role-${i}`} value={r.role} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, role: e.target.value as TeamMemberRole } : x)))}>
                    {ROLES.map((role) => <option key={role} value={role}>{t(`group.role.${role}`)}</option>)}
                  </select>
                </div>
                {rows.length > 1 && <button type="button" className="ic-btn" aria-label={t("setup.team.removeRow")} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}><Trash2 /></button>}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-sm btn-outline-navy" disabled={rows.length >= Math.max(1, available)} onClick={() => setRows((rs) => [...rs, { email: "", role: "office" }])}><Plus className="h-4 w-4" /> {t("setup.team.addRow")}</button>
              <button type="button" className="btn btn-sm btn-navy" disabled={!rows.some((r) => r.email.trim()) || invite.isPending || available < 1} onClick={() => invite.mutate()}>
                {invite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t("setup.team.send")}
              </button>
            </div>
            {sent.length > 0 && <div className="notice ok" role="status"><Mail /><span className="grow">{t("setup.team.sent").replace("{list}", sent.join(", "))}</span></div>}
          </div>
          <div className="card-foot" style={{ display: "block" }}>
            <h3 className="m-0 mb-2" style={{ fontSize: 14, fontWeight: 800, color: "var(--navy)" }}>{t("setup.team.codesTitle")}</h3>
            <AccessCodesForm maxCount={available} onMade={() => void queryClient.invalidateQueries({ queryKey: ["seats"] })} onError={onError} />
          </div>
        </section>
      )}

      {!hasTeam && !chosen && profile.data && (
        <div className="notice info"><Mail /><span className="grow">{t("setup.team.needsPro").replace("{n}", String(SEATS_INCLUDED.monthly_pro))}</span></div>
      )}

      {fieldCrew && <div className="notice teal"><HardHat /><span className="grow">{t("setup.team.crewNote")}</span></div>}

      <button type="button" className="btn btn-outline-navy w-full" onClick={onDone}>{chosen && !hasTeam ? t("setup.team.later") : t("setup.team.done")} <ArrowRight className="h-4 w-4" /></button>
    </div>
  );
}
