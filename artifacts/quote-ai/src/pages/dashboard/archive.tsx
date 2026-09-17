import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Archive as ArchiveIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";

type ArchiveType = "quote" | "client" | "invoice" | "job" | "contract";
type ArchiveItem = { id: string; type: ArchiveType; label: string; archivedAt: string; archivedByName: string | null };

const RESTORE_PATH: Record<ArchiveType, string | null> = {
  quote: "/api/quotes/{id}/restore",
  invoice: "/api/invoices/{id}/restore",
  job: "/api/jobs/{id}/restore",
  contract: "/api/contracts/{id}/restore",
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: fetchArchive, staleTime: 15_000 });
  const locale = lang === "fr" ? frCA : enCA;

  const restore = useMutation({
    mutationFn: async (item: ArchiveItem) => {
      const path = RESTORE_PATH[item.type];
      if (!path) throw new Error("Not restorable");
      const res = await fetch(path.replace("{id}", item.id), { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: "{}" });
      if (!res.ok) throw new Error("Failed to restore");
    },
    onSuccess: () => {
      toast({ title: t("archive.restoredToast") });
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: () => toast({ title: t("archive.restoreErrorToast"), variant: "destructive" }),
  });

  const items = data?.items ?? [];

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
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full rounded-[var(--radius-sm)]" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-14 px-5">
            <ArchiveIcon className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-20" />
            <p className="text-sm" style={{ color: "var(--muted-mk)" }}>{t("archive.empty")}</p>
          </div>
        ) : (
          <>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t("archive.colRecord")}</th>
                    <th>{t("archive.colType")}</th>
                    <th>{t("archive.colArchived")}</th>
                    <th>{t("archive.colBy")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={`${item.type}:${item.id}`}>
                      <td className="t-strong">{item.label}</td>
                      <td><span className="chip chip-grey">{t(`archive.type.${item.type}`)}</span></td>
                      <td>{format(new Date(item.archivedAt), "yyyy-MM-dd", { locale })}</td>
                      <td>{item.archivedByName || "—"}</td>
                      <td>
                        {RESTORE_PATH[item.type] && (
                          <button
                            type="button"
                            className="cta-link"
                            onClick={() => restore.mutate(item)}
                            disabled={restore.isPending}
                          >
                            {t("archive.restore")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card-foot">
              <span className="foot-note">{t("archive.footShowing").replace("{count}", String(items.length))}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
