import { useState } from "react";
import { Link, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { AlertTriangle, ArrowRight, Building2, ChevronLeft, ChevronRight, CircleCheck, HardHat, Info, LayoutDashboard, Link2, Lock, Unlink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { formatCents } from "@/lib/jobs-api";
import { groupApi, type GroupBillingDto, type GroupCompanyDto, type GroupCrewDto, type GroupPageDto } from "@/lib/group-api";

// ── Phase 90: /dashboard/group ──────────────────────────────────────────────
// Companies that belong together: one view across them, one catalog, one
// person on more than one crew, one bill. Nothing is merged — every company
// keeps its own books, tax numbers and filings, and this page says so.

const TABS = ["overview", "companies", "crew"] as const;
type Tab = (typeof TABS)[number];
const TAB_ICONS: Record<Tab, typeof Building2> = { overview: LayoutDashboard, companies: Building2, crew: HardHat };

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const shiftDays = (iso: string, n: number) => isoDay(new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000));

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["group"] });
    queryClient.invalidateQueries({ queryKey: ["group-overview"] });
    queryClient.invalidateQueries({ queryKey: ["group-crew"] });
    queryClient.invalidateQueries({ queryKey: ["team-orgs"] });
  };
}

function useAct<A>(fn: (a: A) => Promise<unknown>) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: fn,
    onSuccess: invalidate,
    onError: (e: Error & { code?: string }) => toast({ title: t("jobs.error"), description: e.code && t(`group.error.${e.code}`) !== `group.error.${e.code}` ? t(`group.error.${e.code}`) : e.message, variant: "destructive" }),
  });
}

export default function GroupPage() {
  const { t } = useLanguage();
  useDocumentTitle(t("group.title"));
  const search = useSearch();
  const initial = new URLSearchParams(search).get("tab");
  const [tab, setTab] = useState<Tab>(TABS.includes(initial as Tab) ? (initial as Tab) : "overview");
  const { data, isLoading, error } = useQuery({ queryKey: ["group"], queryFn: groupApi.get, retry: false });
  const active = data?.group?.self.status === "active" ? data.group : null;

  return (
    <div className="animate-in fade-in duration-500">
      <div className="page-head">
        <div>
          <h1>{active ? active.name : t("group.title")}</h1>
          <p className="sub">{t("group.subtitle")}</p>
        </div>
      </div>

      {isLoading && <div className="space-y-3"><Skeleton className="h-12 w-full rounded-[var(--radius-mk)]" /><Skeleton className="h-64 w-full rounded-[var(--radius-mk)]" /></div>}
      {error && <div className="notice info"><Info /><span className="grow">{(error as Error).message}</span></div>}

      {data?.coveredBy && <div className="notice teal mb-4"><CircleCheck /><span className="grow">{t("group.coveredBy").replace("{company}", data.coveredBy.companyName ?? "—")}</span></div>}

      {data && !data.group && <StartGroup data={data} />}
      {data?.group?.self.status === "pending" && <Invitation data={data} />}

      {data && active && (
        <>
          <div className="pills mb-4">
            {TABS.map((k) => {
              const Icon = TAB_ICONS[k];
              return (
                <button key={k} type="button" onClick={() => setTab(k)} className={cn("pill", tab === k && "on")}>
                  <Icon /> {t(`group.tab.${k}`)}
                </button>
              );
            })}
          </div>
          {tab === "overview" && <OverviewTab available={data.available} />}
          {tab === "companies" && <CompaniesTab data={data} />}
          {tab === "crew" && <CrewTab available={data.available} />}
        </>
      )}
    </div>
  );
}

function Locked() {
  const { t } = useLanguage();
  return (
    <section className="card">
      <div className="card-foot" style={{ borderTop: "none" }}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="qa-ic navy"><Lock className="h-4 w-4" /></span>
          <span className="text-sm text-slate-600">{t("group.locked")}</span>
        </div>
        <Link href="/dashboard/billing" className="cta-link" style={{ fontSize: 13.5 }}>{t("dashboard.calendar.upgrade")} <ArrowRight className="chev" /></Link>
      </div>
    </section>
  );
}

// ── No group yet ─────────────────────────────────────────────────────────────

function StartGroup({ data }: { data: GroupPageDto }) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const create = useAct((n: string) => groupApi.create(n));
  return (
    <div className="stack" style={{ gap: 16 }}>
      <section className="card">
        <div className="card-head"><div><h2>{t("group.start.title")}</h2><p className="sub">{t("group.start.sub")}</p></div></div>
        <ul className="p-5 stack text-sm" style={{ gap: 8, margin: 0 }}>
          {(["view", "catalog", "crew", "bill"] as const).map((k) => (
            <li key={k} className="flex gap-2"><CircleCheck className="h-4 w-4 shrink-0" style={{ color: "var(--teal)", marginTop: 2 }} /><span>{t(`group.start.${k}`)}</span></li>
          ))}
        </ul>
      </section>
      {!data.available ? (
        <Locked />
      ) : data.canManage ? (
        <section className="card">
          <form className="p-5 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(name.trim()); }}>
            <div className="field" style={{ margin: 0, flex: "1 1 240px" }}>
              <label htmlFor="group-name">{t("group.start.name")}</label>
              <input id="group-name" value={name} maxLength={120} placeholder={t("group.start.namePlaceholder")} onChange={(e) => setName(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-navy" disabled={!name.trim() || create.isPending}>{t("group.start.create")}</button>
          </form>
        </section>
      ) : (
        <div className="notice info"><Info /><span className="grow">{t("group.start.ownerOnly")}</span></div>
      )}
    </div>
  );
}

function Invitation({ data }: { data: GroupPageDto }) {
  const { t } = useLanguage();
  const accept = useAct(() => groupApi.accept());
  const decline = useAct(() => groupApi.decline());
  const g = data.group!;
  const manager = g.companies.find((c) => c.isManager)?.companyName ?? "—";
  return (
    <section className="card">
      <div className="card-head"><div><h2>{t("group.invite.title").replace("{group}", g.name)}</h2><p className="sub">{t("group.invite.sub").replace("{company}", manager)}</p></div></div>
      <div className="p-5 stack" style={{ gap: 12 }}>
        <p className="text-sm m-0">{t("group.invite.what")}</p>
        {data.canDecide ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-navy" disabled={accept.isPending} onClick={() => accept.mutate(undefined)}>{t("group.invite.accept")}</button>
            <button type="button" className="btn btn-outline-navy" disabled={decline.isPending} onClick={() => decline.mutate(undefined)}>{t("group.invite.decline")}</button>
          </div>
        ) : (
          <div className="notice info"><Info /><span className="grow">{t("group.invite.ownerDecides")}</span></div>
        )}
      </div>
    </section>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card stat-card">
      <p className="lbl">{label}</p>
      <p className="val">{value}</p>
      {sub && <p className="sub">{sub}</p>}
    </div>
  );
}

const pct = (n: number | null) => (n == null ? "—" : `${n.toFixed(1)} %`);

function OverviewTab({ available }: { available: boolean }) {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const [months, setMonths] = useState(6);
  const { data, isLoading, error } = useQuery({ queryKey: ["group-overview", months], queryFn: () => groupApi.overview(months), retry: false, enabled: available });
  if (!available) return <Locked />;
  if (isLoading) return <Skeleton className="h-64 w-full rounded-[var(--radius-mk)]" />;
  if (error || !data) return <div className="card card-empty">{(error as Error)?.message}</div>;
  const c = data.consolidated;
  const name = (orgId: string) => data.companies.find((x) => x.orgId === orgId)?.companyName ?? data.excluded.find((x) => x.orgId === orgId)?.companyName ?? "—";
  const monthLabel = (m: string) => format(new Date(`${m}-01T12:00:00`), "MMM yyyy", { locale });

  return (
    <div className="stack" style={{ gap: 16 }}>
      <section className="card">
        <div className="toolbar">
          <p className="foot-note m-0 grow">{t("group.overview.intro")}</p>
          <select className="inp-sm" style={{ width: "auto" }} aria-label={t("group.overview.period")} value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {[3, 6, 12].map((m) => <option key={m} value={m}>{t("group.overview.months").replace("{n}", String(m))}</option>)}
          </select>
        </div>
      </section>

      {data.excluded.length > 0 && (
        <div className="notice info"><Info /><span className="grow">{t("group.overview.excluded").replace("{names}", data.excluded.map((e) => e.companyName).join(", "))}</span></div>
      )}

      {data.companies.length === 0 ? (
        <div className="card dashed card-empty">{t("group.overview.none")}</div>
      ) : (
        <>
          <section className="stat-grid">
            <Stat label={t("group.stat.invoiced")} value={formatCents(c.invoicedCents)} sub={t("group.stat.collected").replace("{amount}", formatCents(c.collectedCents))} />
            <Stat label={t("group.stat.costs")} value={formatCents(c.costCents)} />
            <Stat label={t("group.stat.margin")} value={formatCents(c.marginCents)} sub={pct(c.marginPercent)} />
            <Stat label={t("group.stat.outstanding")} value={formatCents(c.outstandingCents)} sub={t("group.stat.overdue").replace("{amount}", formatCents(c.overdueCents))} />
          </section>

          {(data.intercompany.invoicedCents !== 0 || data.intercompany.costCents !== 0) && (
            <div className="notice teal">
              <Info />
              <span className="grow">
                {t("group.overview.intercompany").replace("{invoiced}", formatCents(data.intercompany.invoicedCents)).replace("{costs}", formatCents(data.intercompany.costCents))}
                <span className="block text-xs mt-1">
                  {data.intercompany.lines.map((l) => t(l.kind === "invoice" ? "group.overview.icInvoice" : "group.overview.icCost").replace("{from}", name(l.fromOrgId)).replace("{to}", name(l.toOrgId)).replace("{n}", String(l.count)).replace("{amount}", formatCents(l.cents))).join(" · ")}
                </span>
              </span>
            </div>
          )}

          <section className="card">
            <div className="card-head"><div><h2>{t("group.overview.byCompany")}</h2></div></div>
            <div className="tbl-wrap" tabIndex={0} role="region" aria-label={t("group.overview.byCompany")}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t("group.col.company")}</th>
                    <th className="t-amt">{t("group.stat.invoiced")}</th>
                    <th className="t-amt">{t("group.stat.costs")}</th>
                    <th className="t-amt">{t("group.col.marginPct")}</th>
                    <th className="t-amt">{t("group.stat.outstanding")}</th>
                    <th className="t-amt">{t("group.col.overdue")}</th>
                    <th className="t-amt">{t("group.col.activeJobs")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.companies.map((co) => (
                    <tr key={co.orgId}>
                      <td><span className="t-strong">{co.companyName}</span>{co.province && <span className="t-sub">{co.province}</span>}</td>
                      <td className="t-amt">{formatCents(co.totals.invoicedCents)}</td>
                      <td className="t-amt">{formatCents(co.totals.costCents)}</td>
                      <td className="t-amt">{pct(co.totals.marginPercent)}</td>
                      <td className="t-amt">{formatCents(co.totals.outstandingCents)}</td>
                      <td className="t-amt">{formatCents(co.totals.overdueCents)}</td>
                      <td className="t-amt">{co.activeJobs}</td>
                    </tr>
                  ))}
                  <tr>
                    <td><span className="t-strong">{t("group.col.group")}</span><span className="t-sub">{t("group.col.groupSub")}</span></td>
                    <td className="t-amt t-strong">{formatCents(c.invoicedCents)}</td>
                    <td className="t-amt t-strong">{formatCents(c.costCents)}</td>
                    <td className="t-amt t-strong">{pct(c.marginPercent)}</td>
                    <td className="t-amt t-strong">{formatCents(c.outstandingCents)}</td>
                    <td className="t-amt t-strong">{formatCents(c.overdueCents)}</td>
                    <td className="t-amt t-strong">{c.activeJobs}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="card-head"><div><h2>{t("group.overview.byMonth")}</h2><p className="sub">{t("group.overview.byMonthSub")}</p></div></div>
            <div className="tbl-wrap" tabIndex={0} role="region" aria-label={t("group.overview.byMonth")}>
              <table className="tbl">
                <thead><tr><th>{t("group.col.month")}</th><th className="t-amt">{t("group.stat.invoiced")}</th><th className="t-amt">{t("group.col.collected")}</th><th className="t-amt">{t("group.stat.costs")}</th></tr></thead>
                <tbody>
                  {[...data.series].reverse().map((m) => (
                    <tr key={m.month}><td>{monthLabel(m.month)}</td><td className="t-amt">{formatCents(m.invoicedCents)}</td><td className="t-amt">{formatCents(m.collectedCents)}</td><td className="t-amt">{formatCents(m.costCents)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      <p className="foot-note">{t("group.disclaimer")}</p>
    </div>
  );
}

// ── Companies ────────────────────────────────────────────────────────────────

function billingReason(t: (k: string) => string, b: GroupBillingDto | null) {
  if (!b || b.available) return null;
  return t(`group.billing.reason.${b.reason ?? "NO_SUBSCRIPTION"}`);
}

function CompaniesTab({ data }: { data: GroupPageDto }) {
  const { t } = useLanguage();
  const g = data.group!;
  const self = g.companies.find((c) => c.isCurrent)!;
  const isManager = self.isManager;
  const [candidate, setCandidate] = useState("");
  const [name, setName] = useState(g.name);
  const invite = useAct((orgId: string) => groupApi.invite(orgId));
  const remove = useAct((orgId: string) => groupApi.remove(orgId));
  const rename = useAct((n: string) => groupApi.update({ name: n }));
  const setCatalog = useAct((orgId: string | null) => groupApi.update({ catalogOrgId: orgId }));
  const setMine = useAct((use: boolean) => groupApi.setMine(use));
  const setPays = useAct((pays: boolean) => groupApi.setPays(pays));
  const setCovered = useAct((v: { orgId: string; covered: boolean }) => groupApi.setCovered(v.orgId, v.covered));
  const activeCompanies = g.companies.filter((c) => c.status === "active");
  const billingCompany = g.companies.find((c) => c.isBilling);
  const reason = billingReason(t, data.billing);
  const confirmThen = (msg: string, fn: () => void) => { if (window.confirm(msg)) fn(); };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <section className="card">
        <div className="card-head"><div><h2>{t("group.companies.title")}</h2><p className="sub">{t("group.companies.sub")}</p></div></div>
        <ul className="divide-y" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {g.companies.map((c) => (
            <CompanyRow key={c.orgId} c={c} canRemove={data.canManage && isManager && !c.isCurrent} onRemove={() => confirmThen(t("group.companies.removeConfirm").replace("{company}", c.companyName), () => remove.mutate(c.orgId))} />
          ))}
        </ul>
        {data.canManage && isManager && data.candidates.length > 0 && (
          <form className="card-foot flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); if (candidate) invite.mutate(candidate, { onSuccess: () => setCandidate("") }); }}>
            <div className="field" style={{ margin: 0, flex: "1 1 240px" }}>
              <label htmlFor="group-candidate">{t("group.companies.invite")}</label>
              <select id="group-candidate" value={candidate} onChange={(e) => setCandidate(e.target.value)}>
                <option value="">{t("group.companies.pick")}</option>
                {data.candidates.map((c) => <option key={c.orgId} value={c.orgId}>{c.companyName}</option>)}
              </select>
            </div>
            <button type="submit" className="btn btn-sm btn-navy" disabled={!candidate || invite.isPending}>{t("group.companies.inviteBtn")}</button>
          </form>
        )}
        {data.canManage && isManager && data.candidates.length === 0 && <div className="card-foot"><span className="foot-note">{t("group.companies.noCandidates")}</span></div>}
      </section>

      <section className="card">
        <div className="card-head"><div><h2>{t("group.catalog.title")}</h2><p className="sub">{t("group.catalog.sub")}</p></div></div>
        <div className="p-5 stack" style={{ gap: 12 }}>
          {data.canManage && isManager ? (
            <div className="field" style={{ margin: 0, maxWidth: 420 }}>
              <label htmlFor="group-catalog">{t("group.catalog.source")}</label>
              <select id="group-catalog" value={g.catalogOrgId ?? ""} onChange={(e) => setCatalog.mutate(e.target.value || null)}>
                <option value="">{t("group.catalog.none")}</option>
                {activeCompanies.map((c) => <option key={c.orgId} value={c.orgId}>{c.companyName}</option>)}
              </select>
            </div>
          ) : (
            <p className="text-sm m-0">{g.catalogOrgId ? t("group.catalog.from").replace("{company}", g.companies.find((c) => c.isCatalog)?.companyName ?? "—") : t("group.catalog.noneYet")}</p>
          )}
          {g.catalogOrgId && !self.isCatalog && (
            <label className="chk-row">
              <input type="checkbox" checked={g.self.useGroupCatalog} disabled={!data.canDecide || setMine.isPending} onChange={(e) => setMine.mutate(e.target.checked)} />
              <span>{t("group.catalog.use")}<span className="block text-xs" style={{ color: "var(--muted-mk)" }}>{t("group.catalog.useHint")}</span></span>
            </label>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-head"><div><h2>{t("group.billing.title")}</h2><p className="sub">{t("group.billing.sub")}</p></div></div>
        <div className="p-5 stack" style={{ gap: 12 }}>
          {!billingCompany && (
            <>
              <p className="text-sm m-0">{t("group.billing.nobody")}</p>
              {data.canDecide && <div><button type="button" className="btn btn-sm btn-outline-navy" disabled={setPays.isPending} onClick={() => setPays.mutate(true)}>{t("group.billing.iPay")}</button></div>}
            </>
          )}
          {billingCompany && !billingCompany.isCurrent && <p className="text-sm m-0">{t("group.billing.paidBy").replace("{company}", billingCompany.companyName)}</p>}
          {billingCompany?.isCurrent && (
            <>
              {reason && <div className="notice warn"><AlertTriangle /><span className="grow">{reason}</span></div>}
              <div className="tbl-wrap" tabIndex={0} role="region" aria-label={t("group.billing.title")}>
                <table className="tbl">
                  <thead><tr><th>{t("group.col.company")}</th><th>{t("group.billing.col.plan")}</th><th></th></tr></thead>
                  <tbody>
                    {activeCompanies.filter((c) => !c.isCurrent).map((c) => (
                      <tr key={c.orgId}>
                        <td className="t-strong">{c.companyName}</td>
                        <td>{c.covered ? <span className="chip chip-teal">{t("group.billing.covered")}</span> : <span className="chip chip-grey">{t("group.billing.ownPlan")}</span>}</td>
                        <td style={{ textAlign: "right" }}>
                          {data.canDecide && (c.covered ? (
                            <button type="button" className="btn btn-sm btn-outline-navy" disabled={setCovered.isPending} onClick={() => confirmThen(t("group.billing.stopConfirm").replace("{company}", c.companyName), () => setCovered.mutate({ orgId: c.orgId, covered: false }))}>{t("group.billing.stop")}</button>
                          ) : (
                            <button type="button" className="btn btn-sm btn-navy" disabled={setCovered.isPending || !!reason} onClick={() => confirmThen(t("group.billing.coverConfirm").replace("{company}", c.companyName), () => setCovered.mutate({ orgId: c.orgId, covered: true }))}>{t("group.billing.cover")}</button>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.canDecide && <div><button type="button" className="btn btn-sm btn-txt" disabled={setPays.isPending} onClick={() => confirmThen(t("group.billing.stopPayingConfirm"), () => setPays.mutate(false))}>{t("group.billing.stopPaying")}</button></div>}
            </>
          )}
        </div>
      </section>

      {data.canManage && isManager && (
        <section className="card">
          <form className="p-5 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); if (name.trim()) rename.mutate(name.trim()); }}>
            <div className="field" style={{ margin: 0, flex: "1 1 240px" }}>
              <label htmlFor="group-rename">{t("group.start.name")}</label>
              <input id="group-rename" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-sm btn-outline-navy" disabled={!name.trim() || name.trim() === g.name || rename.isPending}>{t("group.rename")}</button>
          </form>
        </section>
      )}

      {data.canDecide && (
        <div>
          <button type="button" className="btn btn-sm btn-txt" style={{ color: "var(--red)" }} disabled={remove.isPending} onClick={() => confirmThen(t("group.leaveConfirm"), () => remove.mutate(self.orgId))}>{t("group.leave")}</button>
        </div>
      )}
      <p className="foot-note">{t("group.disclaimer")}</p>
    </div>
  );
}

function CompanyRow({ c, canRemove, onRemove }: { c: GroupCompanyDto; canRemove: boolean; onRemove: () => void }) {
  const { t } = useLanguage();
  return (
    <li className="flex flex-wrap items-center gap-2 px-5 py-3">
      <div className="min-w-0 grow">
        <div className="t-strong truncate">{c.companyName}{c.province ? ` · ${c.province}` : ""}</div>
        <div className="text-xs" style={{ color: "var(--muted-mk)" }}>{c.yourRole ? t("group.companies.yourRole").replace("{role}", t(`group.role.${c.yourRole}`)) : t("group.companies.noRole")}</div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {c.isCurrent && <span className="chip chip-grey">{t("group.chip.current")}</span>}
        {c.status === "pending" && <span className="chip chip-yellow">{t("group.chip.pending")}</span>}
        {c.isManager && <span className="chip chip-purple">{t("group.chip.manager")}</span>}
        {c.isBilling && <span className="chip chip-green">{t("group.chip.pays")}</span>}
        {c.covered && <span className="chip chip-teal">{t("group.billing.covered")}</span>}
        {c.isCatalog && <span className="chip chip-teal">{t("group.chip.catalog")}</span>}
      </div>
      {canRemove && <button type="button" className="btn btn-sm btn-txt" onClick={onRemove}>{c.status === "pending" ? t("group.companies.cancelInvite") : t("group.companies.remove")}</button>}
    </li>
  );
}

// ── Crew ─────────────────────────────────────────────────────────────────────

function CrewTab({ available }: { available: boolean }) {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const [day, setDay] = useState(() => isoDay(new Date()));
  const [picked, setPicked] = useState<string[]>([]);
  const { data, isLoading, error } = useQuery({ queryKey: ["group-crew", day], queryFn: () => groupApi.crew(day), retry: false, enabled: available });
  const link = useAct((ids: string[]) => groupApi.link(ids));
  const unlink = useAct((id: string) => groupApi.unlink(id));
  if (!available) return <Locked />;
  if (isLoading) return <Skeleton className="h-64 w-full rounded-[var(--radius-mk)]" />;
  if (error || !data) return <div className="card card-empty">{(error as Error)?.message}</div>;

  const pickedWorkers = data.workers.filter((w) => picked.includes(w.id));
  const distinctCompanies = new Set(pickedWorkers.map((w) => w.orgId)).size === pickedWorkers.length;
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const weekLabel = format(new Date(`${day}T12:00:00`), "d MMM yyyy", { locale });

  return (
    <div className="stack" style={{ gap: 16 }}>
      {data.excluded.length > 0 && <div className="notice info"><Info /><span className="grow">{t("group.crew.excluded").replace("{names}", data.excluded.map((e) => e.companyName).join(", "))}</span></div>}

      <section className="card">
        <div className="card-head">
          <div><h2>{t("group.crew.people")}</h2><p className="sub">{t("group.crew.peopleSub")}</p></div>
          <div className="flex items-center gap-2">
            <button type="button" className="ic-btn" aria-label={t("group.crew.prevWeek")} onClick={() => setDay(shiftDays(day, -7))}><ChevronLeft /></button>
            <span className="t-strong" style={{ whiteSpace: "nowrap" }}>{t("group.crew.weekOf").replace("{date}", weekLabel)}</span>
            <button type="button" className="ic-btn" aria-label={t("group.crew.nextWeek")} onClick={() => setDay(shiftDays(day, 7))}><ChevronRight /></button>
          </div>
        </div>
        {data.people.length === 0 ? (
          <div className="card-empty">{t("group.crew.noPeople")}</div>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }} className="divide-y">
            {data.people.map((p) => <PersonRow key={p.personId} p={p} onUnlink={(id) => unlink.mutate(id)} busy={unlink.isPending} />)}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="card-head"><div><h2>{t("group.crew.all")}</h2><p className="sub">{t("group.crew.allSub")}</p></div></div>
        {data.workers.length === 0 ? (
          <div className="card-empty">{t("group.crew.noWorkers")}</div>
        ) : (
          <div className="tbl-wrap" tabIndex={0} role="region" aria-label={t("group.crew.all")}>
            <table className="tbl">
              <thead><tr><th><span className="sr-only">{t("group.crew.pick")}</span></th><th>{t("group.col.name")}</th><th>{t("group.col.company")}</th><th>{t("group.col.role")}</th><th></th></tr></thead>
              <tbody>
                {data.workers.map((w) => (
                  <tr key={w.id}>
                    <td style={{ width: 36 }}><input type="checkbox" aria-label={t("group.crew.pickName").replace("{name}", w.name).replace("{company}", w.companyName)} checked={picked.includes(w.id)} onChange={() => toggle(w.id)} /></td>
                    <td className="t-strong">{w.name}</td>
                    <td>{w.companyName}</td>
                    <td>{w.role}</td>
                    <td>{w.personId && <span className="chip chip-teal"><Link2 className="h-3 w-3" /> {t("group.crew.linked")}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="card-foot flex flex-wrap items-center gap-3">
          <span className="foot-note grow">{picked.length >= 2 && !distinctCompanies ? t("group.crew.sameCompany") : t("group.crew.linkHint")}</span>
          <button type="button" className="btn btn-sm btn-navy" disabled={picked.length < 2 || !distinctCompanies || link.isPending} onClick={() => link.mutate(picked, { onSuccess: () => setPicked([]) })}><Link2 className="h-4 w-4" /> {t("group.crew.link")}</button>
        </div>
      </section>
      <p className="foot-note">{t("group.crew.disclaimer")}</p>
    </div>
  );
}

function PersonRow({ p, onUnlink, busy }: { p: GroupCrewDto["people"][number]; onUnlink: (workerId: string) => void; busy: boolean }) {
  const { t } = useLanguage();
  return (
    <li className="px-5 py-3 stack" style={{ gap: 6 }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="t-strong grow">{p.name}</span>
        <span className="text-sm">{t("group.crew.combined").replace("{h}", p.combinedHours.toFixed(2))}</span>
        {p.overCombined && <span className="chip chip-yellow"><AlertTriangle className="h-3 w-3" /> {t("group.crew.overCombined")}</span>}
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }} className="stack text-sm">
        {p.companies.map((c) => (
          <li key={c.workerId} className="flex flex-wrap items-center gap-2">
            <span className="grow">{c.companyName}</span>
            <span className="t-amt">{t("group.crew.hours").replace("{h}", c.hours.toFixed(2)).replace("{limit}", c.weeklyThreshold == null ? "—" : String(c.weeklyThreshold))}</span>
            <button type="button" className="btn btn-sm btn-txt" disabled={busy} onClick={() => onUnlink(c.workerId)}><Unlink className="h-3.5 w-3.5" /> {t("group.crew.unlink")}</button>
          </li>
        ))}
      </ul>
      {p.overCombined && <p className="text-xs m-0" style={{ color: "var(--muted-mk)" }}>{t("group.crew.overCombinedHint")}</p>}
    </li>
  );
}
