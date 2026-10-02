// SetSecurity.dc.html, the "Delete account" card: what it does in one line, the three things that follow, and (once opened) the form with Keep / Delete.
import type { ReactNode } from "react";
import { View } from "react-native";
import { Button } from "./Button";
import { Text } from "./Text";

/** The card's top: the sentence, the three steps of the grace period and the opening button (hidden once the form is open). */
export function DeleteIntro({ body, steps, openLabel, onOpen }: { body: string; steps: { t: string; s: string }[]; openLabel?: string; onOpen?: () => void }) {
  return (
    <View style={{ padding: 16, gap: 14 }}>
      <Text size={14.5} leading={1.45}>{body}</Text>
      <View style={{ gap: 12 }}>
        {steps.map((g) => (
          <View key={g.t} style={{ gap: 1 }}>
            <Text size={13.5} weight={600}>{g.t}</Text>
            <Text size={12.5} color="muted" leading={1.4}>{g.s}</Text>
          </View>
        ))}
      </View>
      {openLabel && onOpen ? <Button kind="destructive" size="md" block label={openLabel} onPress={onOpen} /> : null}
    </View>
  );
}

/** The fields (children), a hint under them and the two buttons side by side. */
export function DeleteForm({ children, hint, keep, go, onKeep, onGo, canGo }: { children: ReactNode; hint?: string; keep: string; go: string; onKeep: () => void; onGo: () => void; canGo: boolean }) {
  return (
    <View style={{ paddingBottom: 16 }}>
      {children}
      {hint ? <Text size={12.5} color="muted" style={{ paddingHorizontal: 16, paddingTop: 4 }}>{hint}</Text> : null}
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 14 }}>
        <View style={{ flex: 1 }}><Button kind="secondary" size="md" block label={keep} onPress={onKeep} /></View>
        <View style={{ flex: 1 }}><Button kind="destructive" size="md" block label={go} disabled={!canGo} onPress={onGo} /></View>
      </View>
    </View>
  );
}
