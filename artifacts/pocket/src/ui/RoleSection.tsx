// RoleHomes.dc.html: one section of a role's home (a card with its glyph, name and line, a link on the right and a body). Where nothing is tracked yet the body says so.
import type { ReactNode } from "react";
import { View } from "react-native";
import { Glyph, Icon, type IconName, type Tone } from "./Icon";
import { Card, Hairline } from "./Card";
import { Press } from "./motion";
import { Text } from "./Text";

export function RoleSection({ icon, tone, title, sub, link, onLink, children }: { icon: IconName; tone: Tone; title: string; sub: string; link: string; onLink: () => void; children?: ReactNode }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
      <Card>
        <Press onPress={onLink} accessibilityRole="link" accessibilityLabel={`${title}, ${link}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 62, paddingHorizontal: 16 }}>
          <Icon name={icon} tone={tone} size={30} />
          <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
            <Text size={15} weight={600} tracking={-0.02} numberOfLines={1}>{title}</Text>
            <Text size={12.5} color="muted" numberOfLines={1}>{sub}</Text>
          </View>
          <Text size={13.5} color="muted">{link}</Text>
          <Glyph name="chevron" size={14} color="faint" />
        </Press>
        {children ? <><Hairline inset={0} /><View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>{children}</View></> : null}
      </Card>
    </View>
  );
}

export function RoleLine({ children }: { children: string }) {
  return <Text size={13.5} color="muted">{children}</Text>;
}
