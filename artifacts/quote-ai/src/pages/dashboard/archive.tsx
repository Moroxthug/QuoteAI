import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Archive as ArchiveIcon } from "lucide-react";
import { ListSkeleton } from "@/components/skeletons";
import { patch, useOptimisticMutation } from "@/lib/optimistic";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";
import type { PermissionArea } from "@workspace/permissions";
import { useToast } from "@/hooks/use-toast";
import { jobLimitToast } from "@/lib/plan-errors";
import { ResponsiveTable } from "@/components/mobile/list-row";
import { useMediaQuery } from "@/hooks/use-media-query";

type ArchiveType = "quote" | "client" | "invoice" | "job" | "contract";
type ArchiveItem = { id: string; type: ArchiveType; label: string; archivedAt: string; archivedByName: string | null };

const RESTORE_PATH: Record<ArchiveType, string | null> = {
  quote: "/api/quotes/{id}/restore",
  invoice: "/api/invoices/{id}/restore",
  job: "/api/jobs/{id}/restore",
  contract: "/api/contracts/{id}/restore",
  client: null,
};

// Phase 83: each restore route is `<area>:full` on the server — the button
// now asks the same question the API will.
const RESTORE_AREA: Record<ArchiveType, PermissionArea | null> = {
  quote: "quotes",
  invoice: "invoicing",
  job: "jobs",
  contract: "contracts",
  client: null,
};

const QUERY_KEY = ["archive"];

async function fetchArchive(): Promise<{ items: ArchiveItem[] }> {
  const res = await fetch("/api/archive", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load archive");
  return res.json();
}

export default function ArchivePage() {
  const { t, lang } = useLanguage();
  const can = useCan();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: fetchArchive, staleTime: 15_000 });
  const locale = lang === "fr" ? frCA : enCA;

  // Phase 115: a restored record leaves the archive at once (back if the server says no).
  const restore = useOptimisticMutation({
    patch: (item) => [patch<{ items: ArchiveItem[] }>(QUERY_KEY, (d) => ({ items: d.items.filter((x) => !(x.id === item.id && x.type === item.type)) }))],
    invalidate: (item) => [item.type === "quote" ? ["/api/quotes"] : item.type === "invoice" ? ["invoices"] : item.type === "job" ? ["jobs"] : ["contracts"]],
    mutationFn: async (item: ArchiveItem) => {
      const path = RESTORE_PATH[item.type];
      if (!path) throw new Error("Not restorable");
      const res = await fetch(path.replace("{id}", item.id), { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: "{}" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw Object.assign(new Error("Failed to restore"), { code: body.error });
      }
    },
    onSuccess: () => { toast({ title: t("archive.restoredToast") }); },
    onError: (e) => toast({ ...(jobLimitToast(e, t) ?? { title: t("archive.restoreErrorToast") }), variant: "destructive" }),
  });

  const items = data?.items ?? [];
  const phone = useMediaQuery("(max-width: 639.98px)");
  const canRestore = (type: ArchiveType) => {
    const area = RESTORE_AREA[type];
    return !!area && can(area, "full");
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="page-head">
        <div>
          <h1>{t("archive.title")}</h1>
          <p className="sub">{t("archive.subtitle")}</p>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <ListSkeleton rows={6} amount={false} />
        ) : items.length === 0 ? (
          <div className="text-center py-14 px-5">
            <ArchiveIcon className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-20" />
            <p className="text-sm" style={{ color: "var(--muted-mk)" }}>{t("archive.empty")}</p>
          </div>
        ) : (
          <>
            {/* Phase 110: on a phone the record, what it is and when, with Restore on the right. */}
            <ResponsiveTable
              label={t("archive.title")}
              rows={items}
              getKey={(item) => `${item.type}:${item.id}`}
              columns={[
                { key: "rec", header: t("archive.colRecord"), mobile: "title", cell: (item) => <span className="t-strong">{item.label}</span> },
                { key: "type", header: t("archive.colType"), mobile: "meta", cell: (item) => (phone ? t(`archive.type.${item.type}`) : <span className="chip chip-grey">{t(`archive.type.${item.type}`)}</span>) },
                { key: "when", header: t("archive.colArchived"), mobile: "meta", cell: (item) => format(new Date(item.archivedAt), phone ? "PP" : "yyyy-MM-dd", { locale }) },
                { key: "by", header: t("archive.colBy"), mobile: "meta", cell: (item) => item.archivedByName || (phone ? null : "—") },
                { key: "act", header: "", mobile: "end", cell: (item) => RESTORE_PATH[item.type] && canRestore(item.type) && (
                  <button type="button" className="cta-link" onClick={() => restore.mutate(item)}>
                    {t("archive.restore")}{phone && <span className="sr-only"> {item.label}</span>}
                  </button>
                ) },
              ]}
            />
            <div className="card-foot">
              <span className="foot-note">{t("archive.footShowing").replace("{count}", String(items.length))}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
