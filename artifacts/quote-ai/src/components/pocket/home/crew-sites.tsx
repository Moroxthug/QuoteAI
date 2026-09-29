// Home's "Crew" and "Sites" (docs/pocket-design/Main.dc.html).
// Crew: "3 on site · 1 later today", up to five avatars ringed green (clocked in), amber
// (booked today, not in yet) or grey (done for the day), and the chosen one's line: name ·
// what they're on, where, and since when. Sites: the open jobs with their progress bar, the next
// milestone and who is on them today.
import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/i18n/LanguageContext";
import { haptic } from "@/lib/haptics";
import { crewApi } from "@/lib/team-api";
import { jobsApi } from "@/lib/jobs-api";
import { initialsOf } from "../kit";
import { clock } from "./format";

const RING = {
  on: { ring: "0 0 0 2px #ffffff, 0 0 0 3.5px #1f9d55", color: "#1f7a45", dot: "#1f9d55" },
  way: { ring: "0 0 0 2px #ffffff, 0 0 0 3.5px #d69524", color: "#9a6412", dot: "#d69524" },
  off: { ring: "0 0 0 2px #ffffff, 0 0 0 3.5px #dddcd8", color: "#6e6e76", dot: "#b0afab" },
};

type Person = { key: string; name: string; state: keyof typeof RING; job: string; site: string; status: string };

export function HomeCrew() {
  const { t } = useLanguage();
  const { data } = useQuery({ queryKey: ["crew-today"], queryFn: crewApi.today, staleTime: 30_000, retry: false });
  const [who, setWho] = useState(0);
  if (!data || !data.enabled) return null;
  const now = Date.now();
  const people = new Map<string, Person>();
  for (const c of data.clockedIn) {
    people.set(c.workerId, { key: c.workerId, name: c.workerName ?? "", state: "on", job: c.projectName ?? "", site: data.jobs.find((j) => j.jobId === c.projectId)?.address ?? "", status: t("pocket.crew.onSiteSince").replace("{time}", clock(c.since)) });
  }
  for (const j of data.jobs) {
    for (const c of j.crew) {
      const id = c.workerId ?? c.blockId;
      if (people.has(id)) continue;
      const ended = Date.parse(c.endsAt) <= now;
      people.set(id, { key: id, name: c.workerName ?? c.title, state: ended ? "off" : "way", job: j.jobName ?? c.title, site: j.address ?? "", status: ended ? t("pocket.crew.doneForDay") : c.allDay ? t("pocket.crew.today") : t("pocket.crew.starts").replace("{time}", clock(c.startsAt)) });
    }
  }
  const list = [...people.values()].slice(0, 5);
  if (list.length === 0) return null;
  const on = list.filter((p) => p.state === "on").length, way = list.filter((p) => p.state === "way").length;
  const sel = list[Math.min(who, list.length - 1)]!;
  const s = RING[sel.state];

  return (
    <section className="pk-rise" style={{ padding: "22px 0 0", animationDelay: "340ms" }} aria-labelledby="pk-crew">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px 10px" }}>
        <h2 id="pk-crew" style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em" }}>{t("pocket.home.crew")}</h2>
        <Link href="/dashboard/team" style={{ fontSize: 12.5, color: "#6e6e76", textDecoration: "none" }}>{[on ? t("pocket.crew.nOnSite").replace("{n}", String(on)) : null, way ? t("pocket.crew.nLater").replace("{n}", String(way)) : null].filter(Boolean).join(" · ") || t("pocket.crew.noneYet")}</Link>
      </div>
      <div style={{ margin: "0 16px", background: "#ffffff", borderRadius: 22, boxShadow: "var(--pk-shadow-card)", padding: "14px 6px 12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
          {list.map((p, i) => {
            const onP = p === sel;
            return (
              <button key={p.key} type="button" className="pk-press" onClick={() => { haptic("selection"); setWho(i); }} aria-pressed={onP} aria-label={`${p.name}, ${p.status}`}
                style={{ border: 0, background: "transparent", display: "flex", flexDirection: "column", alignItems: "center", gap: 7, padding: "2px 0", cursor: "pointer", fontFamily: "inherit" }}>
                <span className="pk-av" style={{ width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: "#141416", background: "#f1ede4", boxShadow: RING[p.state].ring, transform: onP ? "scale(1.06)" : undefined }}>{initialsOf(p.name)}</span>
                <span style={{ fontSize: 11.5, fontWeight: 500, color: onP ? "#141416" : "#6e6e76", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
        <div style={{ margin: "12px 10px 0", padding: "10px 12px", borderRadius: 14, background: "#f7f6f3", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{sel.name}{sel.job && <span style={{ color: "#6e6e76", fontWeight: 400 }}> · {sel.job}</span>}</span>
            {sel.site && <span style={{ fontSize: 12, color: "#6e6e76" }}>{sel.site}</span>}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", color: s.color }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot }} />{sel.status}</span>
        </div>
      </div>
    </section>
  );
}

export function HomeSites() {
  const { t } = useLanguage();
  const { data } = useQuery({ queryKey: ["jobs"], queryFn: jobsApi.list, staleTime: 30_000, retry: false });
  const { data: crew } = useQuery({ queryKey: ["crew-today"], queryFn: crewApi.today, staleTime: 30_000, retry: false });
  const open = (data?.items ?? []).filter((j) => !j.archivedAt && (j.status === "active" || j.status === "planning")).sort((a, b) => (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1) || b.updatedAt.localeCompare(a.updatedAt));
  if (open.length === 0) return null;
  const names = (jobId: string) => (crew && crew.enabled ? [...new Set(crew.jobs.filter((j) => j.jobId === jobId).flatMap((j) => j.crew.map((c) => (c.workerName ?? "").split(" ")[0]).filter(Boolean)))] : []);

  return (
    <section className="pk-rise" style={{ padding: "22px 16px 0", animationDelay: "400ms" }} aria-labelledby="pk-sites">
      <div className="pk-sec-head">
        <h2 id="pk-sites">{t("pocket.home.sites")}</h2>
        <Link href="/dashboard/jobs" className="pk-sec-link">{t("pocket.home.allN").replace("{n}", String(open.length))}</Link>
      </div>
      <div className="pk-card" style={{ padding: "4px 0" }}>
        {open.slice(0, 3).map((j, i) => {
          const who = names(j.id);
          return (
            <Link key={j.id} href={`/dashboard/jobs/${j.id}`} className="pk-row" style={{ display: "flex", flexDirection: "column", gap: 9, padding: "12px 16px", borderTop: i ? "1px solid #efeeea" : undefined, color: "inherit", textDecoration: "none" }}>
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{j.name}</span>
                <span className="pk-mono" style={{ fontSize: 12, color: "#3c3c43" }}>{j.progressPercent}%</span>
              </span>
              <span aria-hidden="true" style={{ height: 3, borderRadius: 3, background: "#efeeea", overflow: "hidden", display: "block" }}><span className="pk-grow" style={{ display: "block", height: "100%", borderRadius: 3, background: "#141416", width: `${j.progressPercent}%` }} /></span>
              <span style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, color: "#6e6e76" }}>
                <span>{j.nextMilestone?.title ?? (j.status === "planning" ? t("pocket.sites.planning") : "")}</span>
                <span>{who.length ? who.join(", ") : j.crewCount ? t(j.crewCount === 1 ? "pocket.sites.crew1" : "pocket.sites.crew").replace("{n}", String(j.crewCount)) : t("pocket.sites.notAssigned")}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
