// Contract.dc.html: the four steps, a section of the agreement that opens in place, a signer with the signature drawn, a term row and an
// activity line on the timeline. Sizes are the board's own. (The list on Contracts.dc.html is the app's ListRow.)
import { Fragment, type ReactNode } from "react";
import { Image, Platform, View } from "react-native";
import { Card, Hairline } from "./Card";
import { Glyph, Icon, type IconName, type Tone } from "./Icon";
import { Press, Rise } from "./motion";
import { Status, type StatusShape, type StatusTone } from "./Status";
import { Num, Text } from "./Text";
import { useTheme, type ColorName } from "./theme";
import { Avatar, type AvatarTint } from "./Avatar";
import Svg, { Path, Rect } from "react-native-svg";
import type { Block } from "@/lib/contracts";

/** The four steps in one card: a 26 round marker (done: `inv` with a tick; current: ringed; to do: `sunk`), the label under it and a 2 tall line to the next. */
export function StepsCard({ label, steps, current }: { label: string; steps: string[]; /** How many are done; the next one is the current step. */ current: number }) {
  const { colors } = useTheme();
  return (
    <Card style={{ paddingTop: 18, paddingBottom: 16, paddingHorizontal: 8 }}>
      <View accessibilityLabel={label} style={{ flexDirection: "row" }}>
        {steps.map((s, i) => {
          const done = i < current;
          const cur = i === current;
          return (
            <View key={s} accessible accessibilityLabel={`${i + 1}. ${s}`} accessibilityState={{ selected: cur, checked: done }} style={{ flex: 1, minWidth: 0, alignItems: "center", gap: 8, paddingHorizontal: 2 }}>
              {i < steps.length - 1 ? (
                <View style={{ position: "absolute", top: 13, left: "50%", marginLeft: 17, right: "-50%", marginRight: 17, height: 2, borderRadius: 2, backgroundColor: i < current ? colors.inv : colors.line2 }} />
              ) : null}
              <View style={{
                width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center",
                backgroundColor: done ? colors.inv : cur ? colors.card : colors.sunk, boxShadow: cur ? `0 0 0 2px ${colors.ink}` : undefined,
              }}>
                {done ? <Glyph name="check" size={14} weight={2.6} color="on-inv" /> : <Num size={12.5} weight={600} color={cur ? "ink" : "faint"}>{String(i + 1)}</Num>}
              </View>
              <Text size={12.5} weight={done || cur ? 600 : 400} color={done || cur ? "ink" : "muted"} align="center" leading={1.25}>{s}</Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

/** One line of the contract's text: plain, with the bold phrases in 600. */
function BlockLine({ block }: { block: Block }) {
  const text = (
    <Text size={14.5} color="t2" leading={1.55} style={{ flexShrink: 1 }}>
      {block.parts.map((p, i) => (p.bold ? <Text key={i} size={14.5} weight={600} color="t2" leading={1.55}>{p.text}</Text> : <Fragment key={i}>{p.text}</Fragment>))}
    </Text>
  );
  if (block.kind === "p") return text;
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <Text size={14.5} color="t2" leading={1.55}>•</Text>
      {text}
    </View>
  );
}

/** A section of the agreement: its number, title and what kind of clause it is (a lock for the standard ones, a violet dot for AI's); a tap opens the text under it. */
export function AgreementRow({ n, title, tag, locked, ai, open, onToggle, first, openLabel, children, blocks, action }: {
  n: number; title: string; tag: string; locked: boolean; ai: boolean; open: boolean; onToggle: () => void; first?: boolean; openLabel: string;
  children?: ReactNode; blocks?: Block[]; action?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View>
      {first ? null : <Hairline inset={0} />}
      <Press onPress={onToggle} accessibilityRole="button" accessibilityLabel={openLabel} accessibilityState={{ expanded: open }}
        style={{ minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 16 }}>
        <Num size={13.5} weight={600} color="faint" style={{ width: 22 }}>{String(n)}</Num>
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
          <Text size={14.5} weight={500}>{title}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            {locked ? <LockMark /> : null}
            {ai ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.acc }} /> : null}
            <Text size={12.5} color="muted" style={{ flexShrink: 1 }}>{tag}</Text>
          </View>
        </View>
        <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}><Glyph name="chevronDown" size={16} color="faint" /></View>
      </Press>
      {open ? (
        <Rise>
          <View style={{ paddingTop: 0, paddingRight: 16, paddingBottom: 16, paddingLeft: 50, gap: 8 }}>
            {blocks?.map((b, i) => <BlockLine key={i} block={b} />)}
            {children}
            {action ? <View style={{ alignItems: "flex-start", paddingTop: 4 }}>{action}</View> : null}
          </View>
        </Rise>
      ) : null}
    </View>
  );
}

function LockMark() {
  const { colors } = useTheme();
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth={2.2} strokeLinecap="round" pointerEvents="none">
      <Rect x={5} y={11} width={14} height={9} rx={2} />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

/** The signature as it was given: a name in a script face in a `soft` box, or the drawn image. */
export function Signature({ typed, image, label, flush }: { typed?: string | null; image?: string | null; label: string; /** In a sheet, not under a signer: no inset. */ flush?: boolean }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={label} style={{ alignSelf: "flex-start", marginTop: flush ? 0 : 12, marginLeft: flush ? 0 : 50, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.soft, boxShadow: `0 0 0 1px ${colors.line}` }}>
      {image ? <Image source={{ uri: image }} style={{ width: 160, height: 56 }} resizeMode="contain" accessibilityIgnoresInvertColors /> : (
        <Text size={24} leading={1.2} color="ink" style={{ fontFamily: Platform.OS === "ios" ? "Snell Roundhand" : "cursive", fontStyle: "italic" }}>{typed ?? ""}</Text>
      )}
    </View>
  );
}

/** A signer: avatar, name and role, the status; the signature under it once given, and a faint line about when. */
export function SignerRow({ initials, tint, name, role, status, meta, signature, first }: {
  initials: string; tint: AvatarTint; name: string; role: string; status: { tone: StatusTone; shape: StatusShape; label: string }; meta: string; signature?: ReactNode; first?: boolean;
}) {
  return (
    <View>
      {first ? null : <Hairline inset={0} />}
      <View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Avatar initials={initials} tint={tint} />
          <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
            <Text size={14.5} weight={500} numberOfLines={1}>{name}</Text>
            <Text size={12.5} color="muted" numberOfLines={2}>{role}</Text>
          </View>
          <Status tone={status.tone} shape={status.shape}>{status.label}</Status>
        </View>
        {signature}
        <View style={{ marginTop: 8, marginLeft: 50 }}><Text size={12.5} color="faint">{meta}</Text></View>
      </View>
    </View>
  );
}

/** A term: the name on the left in 13.5 muted, the value on the right (all Manrope when it is a figure). */
export function TermRow({ k, v, figure, strong, first }: { k: string; v: string; figure?: boolean; strong?: boolean; first?: boolean }) {
  return (
    <View>
      {first ? null : <Hairline inset={0} />}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 16, paddingVertical: 12, paddingHorizontal: 16 }}>
        <Text size={13.5} color="muted" style={{ flexShrink: 0 }}>{k}</Text>
        {figure ? <Num size={14.5} weight={strong ? 600 : 400} align="right" style={{ flexShrink: 1 }}>{v}</Num> : <Text size={14.5} weight={strong ? 600 : 400} align="right" leading={1.35} style={{ flexShrink: 1 }}>{v}</Text>}
      </View>
    </View>
  );
}

/** The activity card: a 24 icon on a 1.5 line down the left, the sentence and its time (faint, Manrope digits) on the right. */
export function Timeline({ items }: { items: { key: string; icon: IconName; tone: Tone; text: string; time: string }[] }) {
  const { colors } = useTheme();
  return (
    <Card style={{ paddingTop: 14, paddingHorizontal: 16, paddingBottom: 4 }}>
      {items.map((a, i) => (
        <View key={a.key} accessible accessibilityLabel={`${a.text}, ${a.time}`} style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ alignItems: "center", width: 24, flexShrink: 0 }}>
            <Icon name={a.icon} tone={a.tone} size={24} />
            <View style={{ flexGrow: 1, width: 1.5, marginVertical: 4, backgroundColor: i === items.length - 1 ? "transparent" : colors.line2 }} />
          </View>
          <View style={{ flexShrink: 1, minWidth: 0, gap: 2, paddingTop: 2, paddingBottom: 14 }}>
            <Text size={14.5}>{a.text}</Text>
            <Text size={11.5} color="faint">{a.time}</Text>
          </View>
        </View>
      ))}
    </Card>
  );
}


/** The head: a 6 dot and the status line, the title (24/600), and the client with where the contract came from. */
export function ContractHead({ dot, line, title, avatar, client, from }: { dot: ColorName; line: string; title: string; avatar: ReactNode; client: string; from: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingTop: 8, paddingHorizontal: 20 }}>
      <View accessible accessibilityLabel={line} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors[dot] }} />
        <Text size={12.5} color="muted" style={{ flexShrink: 1 }}>{line}</Text>
      </View>
      <Text size={24} weight={600} tracking={-0.035} leading={1.2} accessibilityRole="header" style={{ marginTop: 8 }}>{title}</Text>
      <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
        {avatar}
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 1 }}>
          <Text size={14.5} weight={500} numberOfLines={1}>{client}</Text>
          {from}
        </View>
      </View>
    </View>
  );
}
