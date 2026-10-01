// Components.dc.html · "People": avatars (photo, the signed-in person, initials, company logo)
// and an avatar row with presence rings and its legend.
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Avatar, CompanyLogo, PresenceLegend, type AvatarTint, type Presence } from "../Avatar";
import { Card } from "../Card";
import { Text } from "../Text";
import { BoardGroup, BoardPad, BoardSection } from "../sandbox";

const CREW: [string, string, AvatarTint, Presence][] = [
  ["LB", "Luca", 1, "on"], ["AO", "Amara", 2, "on"], ["SM", "Sofia", 3, "later"], ["JR", "Jonah", 4, "later"], ["DP", "Dev", 5, "off"],
];

export function PeopleSection() {
  const { t } = useTranslation();
  const c = (k: string) => t(`board.people.${k}`);
  return (
    <>
      <BoardSection title={c("title")} />
      <BoardGroup label={c("avatars")} />
      <BoardPad style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <Avatar initials="PN" photo="placeholder" label={c("photo")} />
        <Avatar initials="MR" me label="Marco Rossi" />
        <Avatar initials="LB" tint={1} label="Luca" />
        <Avatar initials="AO" tint={2} label="Amara" />
        <Avatar initials="SM" tint={3} label="Sofia" />
        <Avatar initials="JR" tint={4} label="Jonah" />
        <CompanyLogo label="Rossi Renovations" />
      </BoardPad>
      <BoardGroup label={c("rings")} />
      <BoardPad>
        <Card padded>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {CREW.map(([ini, name, tint, p]) => (
              <View key={ini} accessible accessibilityLabel={`${name}, ${c(`presence.${p}`)}`} style={{ alignItems: "center", gap: 8, minWidth: 0 }}>
                <Avatar initials={ini} tint={tint} size={44} presence={p} />
                <Text size={12.5} color="muted" numberOfLines={1}>{name}</Text>
              </View>
            ))}
          </View>
          <View style={{ marginTop: 16 }}>
            <PresenceLegend items={(["on", "later", "off"] as const).map((p) => ({ presence: p, label: c(`presence.${p}`) }))} />
          </View>
        </Card>
      </BoardPad>
    </>
  );
}
