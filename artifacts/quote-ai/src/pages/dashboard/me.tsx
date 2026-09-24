import { useRef, useState, useEffect } from "react";
import { Link, useLocation, useParams, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { ArrowRight, Briefcase, Camera, CircleCheck, Clock, FileText, History, Info, Loader2, Mail, Phone, Receipt, Trash2, Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { formatCents } from "@/lib/jobs-api";
import { PersonAvatar } from "@/components/people/avatar";
import { peopleApi, type ActivityDto, type PersonDto, type PersonStatsDto } from "@/lib/people-api";

// ── Phase 91: a page for every person ────────────────────────────────────────
// /dashboard/me — your own: photo, details (editable), and your numbers and
// history in the company you are working in. /dashboard/people/:userId — the
// same page for a teammate, read-only, for anyone who can see the team.
// First login (?welcome=1, or a profile never finished) opens on the setup form.

const MAX_PHOTO_MB = 3;
const PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"];

export default function MePage() {
  const { t } = useLanguage();
  useDocumentTitle(t("me.title"));
  const [months, setMonths] = useState(6);
  const me = useQuery({ queryKey: ["me"], queryFn: peopleApi.me });
  const stats = useQuery({ queryKey: ["me-stats", months], queryFn: () => peopleApi.myStats(months) });
  const activity = useQuery({ queryKey: ["me-activity"], queryFn: peopleApi.myActivity });
  const welcome = new URLSearchParams(useSearch()).get("welcome") === "1";

  if (me.isLoading) return <PageSkeleton />;
  if (!me.data) return <div className="notice info"><Info /><span className="grow">{(me.error as Error)?.message}</span></div>;
  const { person, companies, current } = me.data;
  const company = companies.find((c) => c.orgId === current.orgId);
  const setup = welcome || !person.setupDone;

  return (
    <div className="animate-in fade-in duration-500 stack" style={{ gap: 16 }}>
      <div className="page-head">
        <div>
          <h1>{setup ? t("me.welcomeTitle") : t("me.title")}</h1>
          <p className="sub">{setup ? t("me.welcomeSub").replace("{company}", (company?.companyName || "—").replace(/\.$/, "")) : t("me.subtitle")}</p>
        </div>
      </div>
      <IdentityCard person={person} role={current.role} companyName={company?.companyName ?? null} editable companies={companies.map((c) => ({ name: c.companyName, role: c.role }))} />
      <EditCard person={person} setup={setup} />
      {!setup && <Numbers stats={stats.data} loading={stats.isLoading} months={months} setMonths={setMonths} seesMoney />}
      {!setup && <Activity items={activity.data?.items} loading={activity.isLoading} />}
    </div>
  );
}

export function TeammatePage() {
  const { t } = useLanguage();
  const { userId } = useParams<{ userId: string }>();
  const [months, setMonths] = useState(6);
  const q = useQuery({ queryKey: ["teammate", userId, months], queryFn: () => peopleApi.teammate(userId!, months), enabled: !!userId, retry: false });
  useDocumentTitle(q.data?.person.name ?? t("me.teammate"));
  if (q.isLoading) return <PageSkeleton />;
  if (!q.data) return <div className="notice info"><Info /><span className="grow">{(q.error as Error & { status?: number })?.status === 404 ? t("me.notInCompany") : (q.error as Error)?.message}</span></div>;
  const { person, role, stats, seesMoney, activity } = q.data;
  return (
    <div className="animate-in fade-in duration-500 stack" style={{ gap: 16 }}>
      <div className="page-head">
        <div>
          <Link href="/dashboard/team?tab=members" className="text-link" style={{ fontSize: 13 }}>{t("me.backToTeam")}</Link>
          <h1>{person.name}</h1>
          <p className="sub">{t("me.teammateSub")}</p>
        </div>
      </div>
      <IdentityCard person={person} role={role} companyName={null} />
      <Numbers stats={stats} loading={false} months={months} setMonths={setMonths} seesMoney={seesMoney} />
      <Activity items={activity} loading={false} />
    </div>
  );
}

function PageSkeleton() {
  return <div className="space-y-3"><Skeleton className="h-32 w-full rounded-[var(--radius-mk)]" /><Skeleton className="h-64 w-full rounded-[var(--radius-mk)]" /></div>;
}

// ── Who ──────────────────────────────────────────────────────────────────────

function IdentityCard({ person, role, companyName, editable, companies }: { person: PersonDto; role: string; companyName: string | null; editable?: boolean; companies?: { name: string; role: string }[] }) {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["me"] }); void queryClient.invalidateQueries({ queryKey: ["team-members"] }); };
  const upload = useMutation({
    mutationFn: (file: File) => peopleApi.uploadAvatar(file),
    onSuccess: () => { refresh(); toast({ title: t("me.photoSaved") }); },
    onError: (e: Error) => toast({ title: t("me.photoError"), description: e.message, variant: "destructive" }),
  });
  const remove = useMutation({ mutationFn: () => peopleApi.removeAvatar(), onSuccess: refresh });
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) { toast({ title: t("me.photoType"), variant: "destructive" }); return; }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) { toast({ title: t("me.photoSize").replace("{mb}", String(MAX_PHOTO_MB)), variant: "destructive" }); return; }
    upload.mutate(file);
  };
  return (
    <section className="card">
      <div className="p-5 flex flex-wrap items-center gap-5">
        <div className="relative">
          <PersonAvatar name={person.name} image={person.image} size={88} />
          {editable && (
            <>
              <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={pick} aria-label={t("me.changePhoto")} />
              <button type="button" className="ic-btn" style={{ position: "absolute", right: -6, bottom: -6, background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,.15)" }} aria-label={person.image ? t("me.changePhoto") : t("me.addPhoto")} disabled={upload.isPending} onClick={() => input.current?.click()}>
                {upload.isPending ? <Loader2 className="animate-spin" /> : <Camera />}
              </button>
            </>
          )}
        </div>
        <div className="min-w-0 grow stack" style={{ gap: 4 }}>
          <h2 className="m-0" style={{ fontSize: 20, fontWeight: 800, color: "var(--navy)" }}>{person.name}</h2>
          <p className="m-0 text-sm" style={{ color: "var(--muted-mk)" }}>{[person.jobTitle, person.jobTitle?.trim().toLowerCase() === t(`group.role.${role}`).toLowerCase() ? null : t(`group.role.${role}`), companyName].filter(Boolean).join(" · ")}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mt-1">
            <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" style={{ color: "var(--faint)" }} /> <a href={`mailto:${person.email}`} className="text-link">{person.email}</a></span>
            {person.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" style={{ color: "var(--faint)" }} /> <a href={`tel:${person.phone}`} className="text-link">{person.phone}</a></span>}
            <span className="flex items-center gap-1.5" style={{ color: "var(--muted-mk)" }}><Clock className="h-3.5 w-3.5" style={{ color: "var(--faint)" }} /> {t("me.since").replace("{date}", format(new Date(person.memberSince), "MMMM yyyy", { locale }))}</span>
          </div>
          {person.bio && <p className="m-0 mt-2 text-sm" style={{ whiteSpace: "pre-wrap" }}>{person.bio}</p>}
          {companies && companies.length > 1 && (
            <div className="flex flex-wrap gap-1.5 mt-2">{companies.map((c) => <span key={c.name + c.role} className="chip chip-grey">{c.name} · {t(`group.role.${c.role}`)}</span>)}</div>
          )}
        </div>
        {editable && person.image && <button type="button" className="btn btn-sm btn-txt" disabled={remove.isPending} onClick={() => remove.mutate()}><Trash2 className="h-4 w-4" /> {t("me.removePhoto")}</button>}
      </div>
    </section>
  );
}

function EditCard({ person, setup }: { person: PersonDto; setup: boolean }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({ name: person.name, jobTitle: person.jobTitle ?? "", phone: person.phone ?? "", bio: person.bio ?? "" });
  useEffect(() => setForm({ name: person.name, jobTitle: person.jobTitle ?? "", phone: person.phone ?? "", bio: person.bio ?? "" }), [person]);
  const save = useMutation({
    mutationFn: () => peopleApi.updateMe({ name: form.name.trim(), jobTitle: form.jobTitle.trim() || null, phone: form.phone.trim() || null, bio: form.bio.trim() || null, complete: setup ? true : undefined }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      if (setup) setLocation("/dashboard");
      else toast({ title: t("me.saved") });
    },
    onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }),
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <section className="card">
      <div className="card-head"><div><h2>{setup ? t("me.setupTitle") : t("me.details")}</h2><p className="sub">{setup ? t("me.setupSub") : t("me.detailsSub")}</p></div></div>
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); if (form.name.trim()) save.mutate(); }}>
        <div className="field"><label htmlFor="me-name">{t("me.name")}</label><input id="me-name" value={form.name} maxLength={120} onChange={set("name")} autoComplete="name" required /></div>
        <div className="field"><label htmlFor="me-title">{t("me.jobTitle")}</label><input id="me-title" value={form.jobTitle} maxLength={80} placeholder={t("me.jobTitlePlaceholder")} onChange={set("jobTitle")} autoComplete="organization-title" /></div>
        <div className="field"><label htmlFor="me-phone">{t("me.phone")}</label><input id="me-phone" type="tel" value={form.phone} maxLength={40} onChange={set("phone")} autoComplete="tel" /></div>
        <div className="field full"><label htmlFor="me-bio">{t("me.bio")}</label><textarea id="me-bio" rows={3} value={form.bio} maxLength={600} placeholder={t("me.bioPlaceholder")} onChange={set("bio")} /></div>
        <div className="card-foot full" style={{ justifyContent: "flex-end" }}>
          <button type="submit" className="btn btn-navy btn-sm" disabled={!form.name.trim() || save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : setup ? <ArrowRight className="h-4 w-4" /> : <CircleCheck className="h-4 w-4" />} {setup ? t("me.setupDone") : t("me.save")}
          </button>
        </div>
      </form>
    </section>
  );
}

// ── Numbers ──────────────────────────────────────────────────────────────────

function Stat({ icon: Icon, label, value, sub }: { icon: typeof FileText; label: string; value: string; sub?: string }) {
  return (
    <div className="card stat-card">
      <p className="lbl flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /> {label}</p>
      <p className="val">{value}</p>
      {sub && <p className="sub">{sub}</p>}
    </div>
  );
}

function Numbers({ stats, loading, months, setMonths, seesMoney }: { stats: PersonStatsDto | undefined; loading: boolean; months: number; setMonths: (n: number) => void; seesMoney: boolean }) {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const money = (c: number) => (seesMoney ? formatCents(c) : "—");
  return (
    <>
      <section className="card">
        <div className="toolbar">
          <h2 className="m-0 grow" style={{ fontSize: 16, fontWeight: 800, color: "var(--navy)" }}>{t("me.numbers")}</h2>
          <select className="inp-sm" style={{ width: "auto" }} aria-label={t("group.overview.period")} value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {[3, 6, 12].map((m) => <option key={m} value={m}>{t("group.overview.months").replace("{n}", String(m))}</option>)}
          </select>
        </div>
      </section>
      {loading || !stats ? <Skeleton className="h-28 w-full rounded-[var(--radius-mk)]" /> : (
        <>
          <section className="stat-grid">
            <Stat icon={FileText} label={t("me.stat.quotes")} value={String(stats.quotes.created)} sub={t("me.stat.sentSub").replace("{n}", String(stats.quotes.sent)).replace("{value}", money(stats.quotes.valueCents))} />
            <Stat icon={Trophy} label={t("me.stat.won")} value={String(stats.quotes.won)} sub={stats.quotes.winRate == null ? t("me.stat.noRate") : t("me.stat.rate").replace("{pct}", stats.quotes.winRate.toFixed(0))} />
            <Stat icon={Receipt} label={t("me.stat.invoiced")} value={money(stats.invoices.invoicedCents)} sub={t("me.stat.invoices").replace("{n}", String(stats.invoices.issued))} />
            {stats.hours.linkedWorker
              ? <Stat icon={Clock} label={t("me.stat.hours")} value={stats.hours.total.toFixed(1)} sub={t("me.stat.jobs").replace("{n}", String(stats.jobs))} />
              : <Stat icon={Briefcase} label={t("me.stat.jobsLabel")} value={String(stats.jobs)} sub={t("me.stat.contracts").replace("{n}", String(stats.contracts))} />}
          </section>
          <section className="card">
            <div className="card-head"><div><h2>{t("me.byMonth")}</h2><p className="sub">{t("me.attribution").replace("{date}", format(new Date(`${stats.attributionSince}T12:00:00`), "d MMMM yyyy", { locale }))}</p></div></div>
            <div className="tbl-wrap" tabIndex={0} role="region" aria-label={t("me.byMonth")}>
              <table className="tbl">
                <thead><tr><th>{t("group.col.month")}</th><th className="t-amt">{t("me.stat.quotes")}</th><th className="t-amt">{t("me.col.value")}</th><th className="t-amt">{t("me.col.sent")}</th><th className="t-amt">{t("me.stat.won")}</th><th className="t-amt">{t("me.stat.invoiced")}</th>{stats.hours.linkedWorker && <th className="t-amt">{t("me.stat.hours")}</th>}</tr></thead>
                <tbody>
                  {[...stats.series].reverse().map((m) => (
                    <tr key={m.month}>
                      <td>{format(new Date(`${m.month}-01T12:00:00`), "MMM yyyy", { locale })}</td>
                      <td className="t-amt">{m.quotes}</td>
                      <td className="t-amt">{money(m.quoteValueCents)}</td>
                      <td className="t-amt">{m.sent}</td>
                      <td className="t-amt">{m.won}</td>
                      <td className="t-amt">{money(m.invoicedCents)}</td>
                      {stats.hours.linkedWorker && <td className="t-amt">{m.hours.toFixed(1)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}

// ── History ──────────────────────────────────────────────────────────────────

function humanize(s: string) {
  const w = s.replace(/[_.]/g, " ").trim();
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function Activity({ items, loading }: { items: ActivityDto[] | undefined; loading: boolean }) {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const label = (i: ActivityDto) => {
    const key = `me.act.${i.entityType}.${i.action}`;
    const known = t(key);
    if (known !== key) return known;
    const known2 = (k: string, raw: string) => { const v = t(k); return v !== k ? v : humanize(raw); };
    return `${known2(`me.entity.${i.entityType}`, i.entityType)} · ${known2(`me.action.${i.action}`, i.action).toLowerCase()}`;
  };
  return (
    <section className="card">
      <div className="card-head"><div><h2 className="flex items-center gap-2"><History className="h-4 w-4" /> {t("me.history")}</h2><p className="sub">{t("me.historySub")}</p></div></div>
      {loading ? <div className="p-5"><Skeleton className="h-24 w-full" /></div> : !items?.length ? (
        <div className="card-empty">{t("me.noHistory")}</div>
      ) : (
        <ul className="divide-y" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
              <span className="grow min-w-0">{i.link ? <Link href={i.link} className="text-link">{label(i)}</Link> : label(i)}</span>
              <time dateTime={i.at} title={format(new Date(i.at), "PPpp", { locale })} style={{ color: "var(--muted-mk)" }}>{formatDistanceToNow(new Date(i.at), { addSuffix: true, locale })}</time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
