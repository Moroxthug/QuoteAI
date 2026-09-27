// Phase 100 — /dashboard/__preview (dev server only, see App.tsx): every calm
// mobile primitive on fake data, inside the real dashboard shell, so the
// phone sheets (`qa:phone-sheets`) and a person on a phone can judge them
// without seeding an account. English literals on purpose: this page never
// ships.
import { useMemo, useState } from "react";
import { Copy, Download, FileText, MoreHorizontal, Pencil, Play, Trash2, SlidersHorizontal } from "lucide-react";
import { ActionSheet, type SheetAction } from "@/components/mobile/action-sheet";
import { BottomSheet } from "@/components/mobile/bottom-sheet";
import { ListRow, ResponsiveTable, type Column } from "@/components/mobile/list-row";
import { useMobileHeader } from "@/components/mobile/mobile-page-header";
import { ScrollTabs } from "@/components/mobile/scroll-tabs";
import { StatStrip } from "@/components/mobile/stat-strip";
import { StickyActionBar } from "@/components/mobile/sticky-action-bar";

type Q = { id: string; client: string; title: string; date: string; status: "sent" | "accepted" | "draft" | "expired"; amount: number };

const QUOTES: Q[] = [
  { id: "q1", client: "Dana Smith", title: "Kitchen refresh — cabinets, paint, backsplash", date: "Sep 24", status: "sent", amount: 18450 },
  { id: "q2", client: "Marc-André Tremblay", title: "Basement finishing", date: "Sep 22", status: "accepted", amount: 42800 },
  { id: "q3", client: "Priya Natarajan", title: "Two bathrooms, full gut", date: "Sep 20", status: "draft", amount: 31275.5 },
  { id: "q4", client: "Oakridge Property Mgmt", title: "Unit 4B turnover paint", date: "Sep 18", status: "sent", amount: 3920 },
  { id: "q5", client: "Jordan Lee", title: "Deck rebuild, 320 sq ft", date: "Sep 11", status: "expired", amount: 14600 },
  { id: "q6", client: "Chen Wei", title: "Hardwood refinish, main floor", date: "Sep 9", status: "accepted", amount: 6880 },
];
const CHIP: Record<Q["status"], string> = { sent: "chip-teal", accepted: "chip-green", draft: "chip-grey", expired: "chip-yellow" };
const LABEL: Record<Q["status"], string> = { sent: "Sent", accepted: "Accepted", draft: "Draft", expired: "Expired" };
const money = (n: number) => n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });

export default function MobilePreview() {
  const [tab, setTab] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [status, setStatus] = useState<string>("any");

  const actions = useMemo<SheetAction[]>(() => [
    { label: "Edit", icon: Pencil, onSelect: () => {} },
    { label: "Download PDF", icon: Download, hint: "PDF", onSelect: () => {} },
    { label: "Copy link", icon: Copy, onSelect: () => {} },
    { label: "Start job", icon: Play, onSelect: () => {} },
    { label: "Delete", icon: Trash2, danger: true, separated: true, onSelect: () => {} },
  ], []);
  const header = useMemo(() => ({ title: "Primitives — Kitchen refresh", actions }), [actions]);
  useMobileHeader(header);

  const columns: Column<Q>[] = [
    { key: "client", header: "Client", cell: (q) => q.client, mobile: "title" },
    { key: "title", header: "Project", cell: (q) => q.title, mobile: "meta" },
    { key: "date", header: "Date", cell: (q) => q.date, mobile: "meta" },
    { key: "status", header: "Status", cell: (q) => <span className={`chip ${CHIP[q.status]}`}>{LABEL[q.status]}</span>, mobile: "end" },
    { key: "amount", header: "Amount", align: "right", cell: (q) => money(q.amount), mobile: "amount" },
  ];

  const tabs = [
    { id: "all", label: "All", count: 6 },
    { id: "sent", label: "Sent", count: 2 },
    { id: "accepted", label: "Accepted", count: 2 },
    { id: "draft", label: "Drafts", count: 1 },
    { id: "expired", label: "Expired", count: 1 },
    { id: "declined", label: "Declined", count: 0 },
    { id: "archived", label: "Archived", count: 14 },
  ];
  const rows = tab === "all" ? QUOTES : QUOTES.filter((q) => q.status === tab);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Calm mobile primitives</h1>
          <p className="sub">Phase 100 — fake data, dev server only</p>
        </div>
        <div className="head-actions">
          <button type="button" className="pill" onClick={() => setFilterOpen(true)}>
            <SlidersHorizontal />Filter{status !== "any" && ` · ${LABEL[status as Q["status"]]}`}
          </button>
          <ActionSheet actions={actions} />
        </div>
      </div>

      <StatStrip
        label="This month"
        items={[
          { label: "Quotes sent", value: 12, sub: "+3 vs August" },
          { label: "Won", value: 5, tone: "ok", sub: "42% win rate" },
          { label: "Outstanding", value: money(24130), tone: "warn" },
          { label: "Overdue", value: money(3920), tone: "bad", sub: "1 invoice" },
        ]}
      />
      <StatStrip variant="line" label="Crew today" items={[{ label: "on site", value: 3 }, { label: "not clocked in", value: 1 }, { label: "hours to approve", value: 7 }]} />

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ padding: "14px 16px 0" }}>
          <ScrollTabs label="Quote status" tabs={tabs} value={tab} onChange={setTab} />
        </div>
        <ResponsiveTable label="Quotes" rows={rows} columns={columns} getKey={(q) => q.id} rowHref={() => "/dashboard/__preview"} empty={<p className="sub" style={{ padding: 16 }}>Nothing here.</p>} />
      </div>

      <div className="card">
        <ul className="lrows" aria-label="List rows">
          <li><ListRow lead={<span className="qa-ic navy"><FileText /></span>} title="A row with a lead icon" meta={["Quiet line", "Sep 24", null]} amount={money(1250)} href="/dashboard/__preview" /></li>
          <li><ListRow title="A button row" meta="Opens the bottom sheet" onClick={() => setFilterOpen(true)} chevron /></li>
          <li><ListRow title="A static row with a very long title that has to truncate at phone width without wrapping" meta={["No link", "No amount"]} end={<span className="chip chip-grey">Draft</span>} /></li>
        </ul>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <p className="sub">Enough content to scroll past a phone screen, so the sticky bar and the tab bar are seen over the page, and the end of the page is seen above them.</p>
        {Array.from({ length: 6 }, (_, i) => (
          <p key={i} style={{ marginTop: 12, fontSize: 15 }}>Paragraph {i + 1}. Chapters, prices and tax, laid out for a thumb: the document first, the one action at the bottom, everything else behind the ⋯.</p>
        ))}
        <p style={{ marginTop: 12, fontWeight: 800, color: "var(--navy)" }} data-testid="preview-end">End of the page.</p>
      </div>

      <StickyActionBar label="Quote actions">
        <ActionSheet actions={actions} trigger={<button type="button" className="btn btn-outline-navy secondary" aria-label="More actions"><MoreHorizontal className="h-5 w-5" /></button>} />
        <button type="button" className="btn btn-navy" data-primary-action="">Send quote</button>
      </StickyActionBar>

      <BottomSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title="Filter quotes"
        description="Show only the quotes in one state."
        footer={<><button type="button" className="btn btn-outline-navy" onClick={() => setStatus("any")}>Reset</button><button type="button" className="btn btn-navy" onClick={() => setFilterOpen(false)}>Show quotes</button></>}
      >
        <div className="pills">
          {(["any", "sent", "accepted", "draft", "expired"] as const).map((s) => (
            <button key={s} type="button" className={`pill${status === s ? " on" : ""}`} aria-pressed={status === s} onClick={() => setStatus(s)}>
              {s === "any" ? "Any status" : LABEL[s]}
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* The real tab bar (Phase 101, components/layout/phone-nav.tsx) comes with the layout. */}
    </>
  );
}
