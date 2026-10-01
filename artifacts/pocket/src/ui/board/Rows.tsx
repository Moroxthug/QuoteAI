// Components.dc.html · "Rows": a section header with a link over list rows, the swipe row (tap
// to open and close, as on the board; it can also be dragged), menu rows and a group label.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { money, percent, shortDate, type Locale } from "@/lib/format";
import { Avatar } from "../Avatar";
import { Card } from "../Card";
import { Icon } from "../Icon";
import { GroupLabel, ListRow, MenuList, MenuRow, RowBody, RowChevron, RowList, SectionHeader } from "../Row";
import { Status } from "../Status";
import { SwipeRow } from "../SwipeRow";
import { Num } from "../Text";
import { BoardGroup, BoardPad, BoardSection } from "../sandbox";

const DUE = new Date(2026, 8, 20);

export function RowsSection() {
  const { t, i18n } = useTranslation();
  const c = (k: string, o?: Record<string, unknown>) => t(`board.rows.${k}`, o);
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const [open, setOpen] = useState(true); // the board starts with the actions showing
  const fig = (n: number) => <Num size={14.5} weight={600}>{money(n, locale)}</Num>;
  return (
    <>
      <BoardSection title={c("title")} />
      <BoardGroup label={c("group1")} />
      <BoardPad>
        <SectionHeader title={c("thisWeek")} link={c("seeAll")} onLink={() => {}} />
        <Card>
          <RowList>
            <ListRow onPress={() => {}} leading={<Avatar initials="DW" tint={1} />} title={c("dana")} meta={c("danaMeta")}
              trailing={<>{fig(4131.05)}<Status tone="mute" shape="draft">{t("board.status.groups.quotes.draft")}</Status></>} />
            <ListRow onPress={() => {}} leading={<Icon name="receipt" tone="clay" />} title={c("inv")} meta={c("due", { date: shortDate(DUE, locale) })}
              trailing={<>{fig(2340)}<Status tone="bad" shape="alert">{c("overdue", { count: 9 })}</Status></>} />
            <ListRow onPress={() => {}} leading={<Icon name="house" tone="teal" />} title={c("basement")} meta={c("basementMeta")} trailingRow
              trailing={<><Num size={13.5} weight={400} color="muted">{percent(0.64, locale)}</Num><RowChevron /></>} />
          </RowList>
        </Card>
      </BoardPad>
      <BoardGroup label={c("group2")} />
      <BoardPad>
        <SwipeRow open={open} onOpenChange={setOpen} onPress={() => setOpen((o) => !o)} accessibilityLabel={`${c("priya")}, ${c("priyaMeta")}`}
          actions={[
            { key: "archive", label: c("archive"), icon: "box", iconTone: "slate", tone: "mute", onPress: () => setOpen(false) },
            { key: "delete", label: c("delete"), icon: "warn", iconTone: "clay", tone: "bad", onPress: () => setOpen(false) },
          ]}>
          <RowBody leading={<Avatar initials="PN" tint={2} />} title={c("priya")} meta={c("priyaMeta")}
            trailing={<>{fig(1865.1)}<Status tone="acc" shape="q2">{t("board.status.groups.quotes.viewed")}</Status></>} />
        </SwipeRow>
      </BoardPad>
      <BoardGroup label={c("group3")} />
      <BoardPad>
        <Card>
          <MenuList>
            <MenuRow onPress={() => {}} icon={<Icon name="building" tone="violet" />} title={c("company")} sub={c("companySub")} />
            <MenuRow onPress={() => {}} icon={<Icon name="percent" tone="azure" />} title={c("taxes")} value={c("hst")} />
          </MenuList>
        </Card>
      </BoardPad>
      <BoardGroup label={c("group4")} />
      <BoardPad><GroupLabel>{c("earlier")}</GroupLabel></BoardPad>
    </>
  );
}
