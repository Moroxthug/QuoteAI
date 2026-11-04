// SystemStates.dc.html on one sandbox page (/sandbox/system-states), with the board's sample data, so each state can be checked against the board in light,
// night and French. The live app shows the same parts through `SyncStates` (ui/Sync.tsx).
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { FieldGroup, Op } from "@/lib/sync";
import type { Cleared, PhotoState } from "@/lib/outbox";
import { AskBody, ASK_ICON, LockScreen, SheetFrame, useMethodName } from "../AppLock";
import { Toast } from "../Feedback";
import { Screen } from "../Screen";
import { ConflictCard, NewVersionBanner, OfflineBanner, PhotosCard, RejectedCard, summary, SyncCard, Unreachable } from "../Sync";
import { BoardGroup, BoardHeader, BoardPad, BoardSection, SandboxSwitches } from "../sandbox";

const AT = (h: number, m: number) => new Date(2026, 9, 1, h, m).toISOString();

export function SystemStatesBoard() {
  const { t } = useTranslation();
  const b = (k: string) => t(`sync.board.${k}`) as string;
  const s = (k: string, o?: Record<string, unknown>) => t(`sync.${k}`, o) as string;
  const ref = b("ref");
  const l = (k: string, o?: Record<string, unknown>) => t(`lock.${k}`, o) as string;
  const faceId = useMethodName("faceId");

  const [ph, setPh] = useState<PhotoState>("idle");
  const sendPhotos = () => { setPh("busy"); setTimeout(() => setPh("done"), 2300); };

  const rejectedOp: Op = { id: "r", kind: "quote", method: "PUT", path: "/q", ref, at: AT(9, 52), state: "rejected", body: { capitoli: [], totale: 920 }, before: { totale: 860 }, rejected: { status: 409, code: "QUOTE_SENT" } };
  const [rj, setRj] = useState<Cleared>(null);

  const [picks, setPicks] = useState<Partial<Record<FieldGroup, "mine" | "theirs">>>({ schedule: "mine" });
  const conflictOp: Op = {
    id: "c", kind: "quote", method: "PUT", path: "/q", ref, at: AT(9, 48), state: "conflict",
    body: { paymentSchedule: { terms: [{ type: "deposit", amountType: "percent", value: 30 }] }, totale: 920 },
    before: { paymentSchedule: { terms: [{ type: "deposit", amountType: "percent", value: 20 }] }, totale: 860 },
    conflict: { current: { paymentSchedule: { terms: [{ type: "deposit", amountType: "percent", value: 25 }] }, totale: 890 }, updatedAt: AT(9, 50), groups: ["schedule", "lines"], picks },
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <BoardHeader title={b("title")} intro={b("intro")} />
        <SandboxSwitches />
        <BoardSection title={b("offlineSync")} />
        <BoardGroup label={b("offline")} />
        <BoardPad><OfflineBanner waiting={3} /></BoardPad>
        <BoardGroup label={b("sending")} />
        <BoardPad><SyncCard sending={3} what={summary(s, { quote: 2, jobNote: 1 })} syncedAt={new Date(2026, 9, 1, 9, 41).getTime()} updating /></BoardPad>
        <BoardGroup label={b("photos")} />
        <BoardPad><PhotosCard state={ph} count={6} bytes={38e6} job={ph === "done" ? b("jobShort") : b("job")} doneCount={6} onSend={sendPhotos} /></BoardPad>
        <BoardGroup label={b("rejected")} />
        <BoardPad><RejectedCard ops={rj ? [] : [rejectedOp]} cleared={rj} onRetry={() => setRj({ how: "retried", at: AT(9, 54), ref })} onDiscard={() => setRj({ how: "discarded", at: AT(9, 54), ref })} /></BoardPad>
        <BoardGroup label={b("conflict")} />
        <BoardPad><ConflictCard op={conflictOp} who={b("who")} onPick={(g, side) => setPicks((p) => ({ ...p, [g]: side }))} onSave={() => setPicks({})} /></BoardPad>
        <BoardGroup label={b("version")} />
        <BoardPad><NewVersionBanner onReload={() => {}} /></BoardPad>
        <BoardGroup label={b("unreachable")} />
        <BoardPad><Unreachable onRetry={() => {}} /></BoardPad>
        <BoardGroup label={b("saved")} />
        <BoardPad><View><Toast done message={s("savedOffline")} /></View></BoardPad>
        <BoardSection title={l("board.section")} />
        <BoardGroup label={l("board.lock")} />
        <BoardPad><LockScreen framed company={l("board.company")} email={l("board.email")} method="faceId" onUnlock={() => {}} onSignOut={() => {}} /></BoardPad>
        <BoardGroup label={l("board.offer")} />
        <BoardPad><SheetFrame><AskBody icon="face" tone="violet" title={l("offer.title", { method: faceId })} body={l("offer.body")} later={l("offer.later")} go={l("offer.on")} onLater={() => {}} onGo={() => {}} /></SheetFrame></BoardPad>
        <BoardGroup label={l("board.ask")} />
        <BoardPad style={{ gap: 12 }}>
          {(["camera", "mic", "location", "notifications"] as const).map((k) => (
            <SheetFrame key={k}><AskBody {...ASK_ICON[k]} title={l(`ask.${k}.title`)} body={l(`ask.${k}.body`)} later={l("ask.later")} go={l("ask.go")} onLater={() => {}} onGo={() => {}} /></SheetFrame>
          ))}
        </BoardPad>
      </ScrollView>
    </Screen>
  );
}
