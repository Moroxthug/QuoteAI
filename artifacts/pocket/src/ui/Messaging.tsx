// SetMessaging.dc.html: the business number card (the number the texts come from, who they are sent as, whether texting is active) with a meter under it for each channel.
import type { ReactNode } from "react";
import { View } from "react-native";
import { Card, Hairline } from "./Card";
import { Num, Text } from "./Text";

export function NumberCard({ label, number, sub, state, children }: { label: string; number: string; sub: string; state: ReactNode; children?: ReactNode[] }) {
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16 }}>
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 3 }}>
          <Text size={12.5} color="muted">{label}</Text>
          <Num size={24} weight={600} tracking={-0.03} leading={1.15}>{number}</Num>
          <Text size={12.5} color="muted" leading={1.35}>{sub}</Text>
        </View>
        {state}
      </View>
      {(children ?? []).map((c, i) => <View key={i}><Hairline inset={0} />{c}</View>)}
    </Card>
  );
}
