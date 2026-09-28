// Phase 115: never a blank screen. While the dashboard layout's chunk, its
// strings or the session are still on their way, the frame is drawn already —
// the navy sidebar on a computer, the top bar and tab bar on a phone — with a
// page-shaped skeleton inside, so the app looks open from the first paint and
// nothing moves when the real frame replaces it (same classes, same sizes).
// No strings and no data: it renders before either has arrived.
import { Skeleton } from "@/components/ui/skeleton";

function Bar({ w, h = 12, className }: { w: number | string; h?: number; className?: string }) {
  return <Skeleton className={className} style={{ width: w, height: h, borderRadius: 999 }} />;
}

/** A page waiting for its chunk: the header line and a card of list rows. */
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden="true" data-testid="page-skeleton">
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        <Bar w={180} h={22} />
        <Bar w={260} h={12} />
      </div>
      <div className="card">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="item-row">
            <Skeleton style={{ width: 36, height: 36, borderRadius: 10, flex: "none" }} />
            <div className="grow" style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <Bar w={`${55 - (i % 3) * 8}%`} h={12} />
              <Bar w={`${35 - (i % 2) * 6}%`} h={10} />
            </div>
            <Bar w={64} h={12} />
          </div>
        ))}
      </div>
    </div>
  );
}

function railCollapsed(): boolean {
  try {
    return localStorage.getItem("sidebar-collapsed") === "true";
  } catch {
    return false;
  }
}

/** The whole app frame, used until the dashboard layout can render itself. */
export function AppShellSkeleton() {
  const rail = railCollapsed();
  return (
    <div className={rail ? "app rail" : "app"} aria-busy="true">
      <aside className="sidebar" aria-hidden="true">
        <div className="sb-top" style={{ height: 64 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "8px 24px" }}>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="bg-white/10" style={{ height: 14, width: rail ? 32 : `${70 - (i % 3) * 12}%`, borderRadius: 999 }} />
          ))}
        </div>
      </aside>
      <div className="main">
        <header className="topbar" aria-hidden="true" />
        <main id="main" className="content">
          <PageSkeleton />
        </main>
      </div>
      <nav className="tabbar" aria-hidden="true" />
    </div>
  );
}
