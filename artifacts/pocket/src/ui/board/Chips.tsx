// Components.dc.html · "Chips": the filter strip with counts, the chip states, and the inner
// tab strip.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Chip, ChipStrip, ChipWrap } from "../Chip";
import { Tabs } from "../Tabs";
import { BoardGroup, BoardSection } from "../sandbox";

const FILTERS = [["all", 9], ["draft", 1], ["waiting", 3], ["accepted", 3], ["closed", 2]] as const;
const TABS = ["overview", "schedule", "crew", "costs", "photos", "reports", "money", "permits"] as const;

export function ChipsSection() {
  const { t } = useTranslation();
  const c = (k: string) => t(`board.chips.${k}`);
  const [filter, setFilter] = useState<string>("all");
  const [tab, setTab] = useState(0);
  return (
    <>
      <BoardSection title={c("title")} />
      <BoardGroup label={c("withCounts")} />
      <ChipStrip label={c("filter")}>
        {FILTERS.map(([k, n]) => <Chip key={k} label={c(`f.${k}`)} count={n} selected={filter === k} onPress={() => setFilter(k)} />)}
      </ChipStrip>
      <BoardGroup label={c("states")} />
      <ChipWrap>
        <Chip label={c("default")} />
        <Chip label={c("selected")} selected />
        <Chip label={c("painting")} selected glyph="check" />
        <Chip label={c("disabled")} disabled />
        <Chip label={c("addTrade")} glyph="plus" />
      </ChipWrap>
      <BoardGroup label={c("tabStrip")} />
      <Tabs tabs={TABS.map((k) => c(`tabs.${k}`))} active={tab} onChange={setTab} />
    </>
  );
}
