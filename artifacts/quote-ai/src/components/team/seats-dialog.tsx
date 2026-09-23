import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Minus, Plus } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/i18n/LanguageContext";
import { formatCents } from "@/lib/jobs-api";
import { peopleApi, type SeatsDto } from "@/lib/people-api";

// Phase 91: paid seats beyond the plan's. The number is the extra seats on the
// subscription; it cannot go below what is in use (members + open invitations).

export function SeatsDialog({ seats, open, onOpenChange, onError }: { seats: SeatsDto; open: boolean; onOpenChange: (v: boolean) => void; onError: (e: Error & { code?: string }) => void }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const minExtra = Math.max(0, seats.used - seats.included);
  const [extra, setExtra] = useState(seats.extra);
  useEffect(() => { if (open) setExtra(Math.max(seats.extra, seats.seatsWanted ? seats.seatsWanted - seats.included : 0, minExtra)); }, [open, seats, minExtra]);
  const save = useMutation({
    mutationFn: () => peopleApi.setSeats(extra),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seats"] });
      void queryClient.invalidateQueries({ queryKey: ["team-members"] });
      onOpenChange(false);
    },
    onError,
  });
  const per = t(seats.interval === "year" ? "seats.perYear" : "seats.perMonth");
  const delta = extra - seats.extra;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("seats.title")}</DialogTitle><DialogDescription>{t("seats.desc").replace("{included}", String(seats.included))}</DialogDescription></DialogHeader>
        <DialogBody>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="t-strong m-0">{t("seats.extra")}</p>
              <p className="foot-note m-0">{t("seats.price").replace("{price}", formatCents(seats.pricePerSeatCents)).replace("{per}", per)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="ic-btn" aria-label={t("seats.less")} disabled={extra <= minExtra} onClick={() => setExtra((n) => Math.max(minExtra, n - 1))}><Minus /></button>
              <output className="t-strong" style={{ minWidth: 32, textAlign: "center", fontSize: 18 }} aria-live="polite">{extra}</output>
              <button type="button" className="ic-btn" aria-label={t("seats.more")} disabled={extra >= 200} onClick={() => setExtra((n) => Math.min(200, n + 1))}><Plus /></button>
            </div>
          </div>
          <p className="text-sm mt-4 mb-0">{t("seats.total").replace("{total}", String(seats.included + extra)).replace("{used}", String(seats.used))}</p>
          {minExtra > 0 && extra === minExtra && <p className="foot-note mt-2 mb-0">{t("seats.floor")}</p>}
          {delta !== 0 && <p className="foot-note mt-2 mb-0">{t(delta > 0 ? "seats.chargeNow" : "seats.creditNow")}</p>}
        </DialogBody>
        <DialogFooter>
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => onOpenChange(false)}>{t("jobs.cancel")}</button>
          <button type="button" className="btn btn-sm btn-navy" disabled={delta === 0 || save.isPending} onClick={() => save.mutate()}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("seats.save")}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
