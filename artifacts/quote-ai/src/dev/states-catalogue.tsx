// Phase 120 — /dashboard/__states (dev server only, see App.tsx): every state
// a screen can be in (empty, loading, error, offline, no permission,
// plan-locked) and the Phase 120 gestures (a swiped row, a held row, the
// success check, a sheet to drag), inside the real dashboard shell. The states
// themselves are the real components in the page's language, so the phone
// sheets (qa:visual, EN + FR) check them; the section labels are English
// literals on purpose — this page never ships.
import { useState } from "react";
import { Link } from "wouter";
import { Banknote, Pencil, Phone, Send, Trash2 } from "lucide-react";
import { BottomSheet } from "@/components/mobile/bottom-sheet";
import { ListRow, ResponsiveTable, type Column } from "@/components/mobile/list-row";
import { SwipeRow } from "@/components/mobile/swipe-row";
import { ListSkeleton, StatStripSkeleton } from "@/components/skeletons";
import { EmptyState, ErrorState, NoAccess, OfflineState, PlanLocked, type StateArt } from "@/components/states";
import { UpgradeLink } from "@/components/billing/upgrade-link";
import { DoneCheck, useDone } from "@/hooks/use-done";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

const EMPTY: Array<{ art: StateArt; key: string; action: string }> = [
  { art: "quotes", key: "states.quotes.empty", action: "dashboard.nav.newQuote" },
  { art: "jobs", key: "states.jobs.empty", action: "dashboard.nav.quotes" },
  { art: "invoices", key: "states.invoices.empty", action: "invoices.new" },
  { art: "clients", key: "states.clients.empty", action: "clients.empty.cta" },
  { art: "leads", key: "states.leads.empty", action: "leads.newLead" },
  { art: "search", key: "states.search.empty", action: "dashboard.quotesList.clearFilters" },
];

type Row = { id: string; client: string; amount: string };
const ROWS: Row[] = [
  { id: "a", client: "Dana Smith", amount: "18 450 $" },
  { id: "b", client: "Marc-André Tremblay", amount: "42 800 $" },
];
const COLUMNS: Column<Row>[] = [
  { key: "client", header: "Client", cell: (r) => r.client, mobile: "title" },
  { key: "amount", header: "Amount", cell: (r) => r.amount, mobile: "amount", align: "right" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="card-head"><h2>{title}</h2></div>
      {children}
    </section>
  );
}

export default function StatesCatalogue() {
  const { t } = useLanguage();
  const done = useDone();
  const [sheet, setSheet] = useState(false);
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>States</h1>
          <p className="sub">Every state a screen can be in, and the gestures of Phase 120.</p>
        </div>
      </div>

      {EMPTY.map((e) => (
        <Section key={e.art} title={`Empty — ${e.art}`}>
          <EmptyState
            art={e.art}
            title={t(e.key)}
            action={<Link href="/dashboard/__states" className={cn("btn btn-sm", e.art === "search" ? "btn-outline-navy" : "btn-navy")}>{t(e.action)}</Link>}
            watch={e.art === "quotes" ? { href: "https://www.youtube.com/@quoteai" } : undefined}
          />
        </Section>
      ))}

      <Section title="Loading (skeletons, shown past 300 ms)">
        <StatStripSkeleton cells={4} immediate />
        <ListSkeleton rows={3} immediate />
      </Section>
      <Section title="Error"><ErrorState onRetry={() => {}} /></Section>
      <Section title="Offline, never opened"><OfflineState onRetry={() => {}} /></Section>
      <Section title="No permission"><NoAccess /></Section>
      <Section title="Plan-locked">
        <PlanLocked title={t("invoices.gatedTitle")} body={t("invoices.gatedDesc")} action={<UpgradeLink className="btn btn-sm btn-navy">{t("invoices.upgrade")}</UpgradeLink>} />
      </Section>
      <Section title="Compact (inside a card on a busy screen)">
        <EmptyState compact art="notifications" title={t("states.search.empty")} />
      </Section>

      <Section title="Swipe a row (touch): approve, record a payment, call">
        <ul className="lrows">
          <li><SwipeRow label={t("crew.approve")} onSwipe={() => new Promise((_, no) => setTimeout(no, 600))}><ListRow title="Sam Ortiz · 8 h" meta={["Mon", "Kitchen refresh"]} /></SwipeRow></li>
          <li><SwipeRow label={t("invoices.recordPayment")} icon={Banknote} stays onSwipe={() => setSheet(true)}><ListRow title="INV-0042" meta={["Dana Smith"]} amount="4 200 $" /></SwipeRow></li>
          <li><SwipeRow label={t("clients.m.call")} icon={Phone} tone="teal" stays onSwipe={() => {}}><ListRow title="Marc-André Tremblay" meta={["Laval"]} /></SwipeRow></li>
        </ul>
      </Section>
      <Section title="Hold a row (touch) for its ⋯">
        <ResponsiveTable
          rows={ROWS}
          columns={COLUMNS}
          getKey={(r) => r.id}
          label="Held rows"
          rowActions={() => [
            { label: "Edit", icon: Pencil, onSelect: () => {} },
            { label: "Delete", icon: Trash2, danger: true, separated: true, onSelect: () => {} },
          ]}
        />
      </Section>
      <Section title="Success (check in the button, 900 ms)">
        <div style={{ padding: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className={cn("btn btn-sm btn-navy", done.on && "is-done")} disabled={done.on} onClick={() => done.flash()}>
            {done.on ? <DoneCheck /> : <Send className="h-4 w-4" />} {t("invoices.sendNow")}
          </button>
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setSheet(true)}>Open a sheet (drag it down)</button>
        </div>
      </Section>

      <BottomSheet open={sheet} onOpenChange={setSheet} title={t("invoices.recordPayment")} description="Drag the handle, the header, or the body down.">
        <p className="state-body" style={{ textAlign: "left" }}>Past 30 % of its height or on a flick it closes; short of that it springs back.</p>
      </BottomSheet>
    </div>
  );
}
