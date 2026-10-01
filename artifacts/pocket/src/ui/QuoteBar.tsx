// SmartHome's AI quote bar (AI-QUOTE-BAR-SPEC.md, SmartHome.dc.html .aib).
// Collapsed: a 58 pill (radius 29) with the placeholder, a 40 mic and a 40 ink send. Tap it and the
// same card grows (the pill folds away, the body folds open): a 4-line text area and a 34 collapse
// button; chips Client / Budget / Photo, then the mic and send. One panel at a time under the chips
// (client: search, recent clients, New client; budget: a big amount, four presets, No budget / Set
// budget). Send builds the quote: a paper card whose line items arrive one by one under a gradient
// progress line, the total counting up, and (with a budget) a fit bar. Done: Review and send / Edit.
// The card is `card` with the ring; open it takes the violet ring and halo (board.aibOpenShadow).
import { useEffect, useMemo, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { board } from "@/theme/board";
import { BUDGET_PRESETS, budgetFit, canAddClient, canBuild, clientDataOf, firstName, initialsFor, parseBudget, presetLabel, type NewClient } from "@/lib/quoteBar";
import { money, type Locale } from "@/lib/format";
import { Glyph, Icon } from "./Icon";
import { inputText, noOutline, usePlaceholder } from "./Field";
import { Fold, Press, Rise } from "./motion";
import { Num, Text } from "./Text";
import { useTheme } from "./theme";
import { easing } from "./motion";
import { avatarTint, type AvatarTint } from "./Avatar";

export type ClientOpt = { id: string; name: string; sub: string; data: Record<string, string> };
export type Built = { id: string; number?: string; client: string; lines: { name: string; amount: number }[]; total: number };
export type BarProblem = "offline" | "quota" | "cannot" | "unlock" | "failed";
export type BarInput = { text: string; client: { name: string; data: Record<string, string> } | null; budget: number | null };

type Panel = "client" | "budget" | null;
type Phase = "idle" | "building" | "done";

const TINTS: AvatarTint[] = [1, 2, 3, 4, 5];
const EMPTY_CLIENT: NewClient = { name: "", phone: "", email: "", address: "" };
const LINE_MS = 640;
const OUT = easing("out");

function Chip({ onPress, label, set, open, expanded, children, icon }: { onPress: () => void; label: string; set?: boolean; open?: boolean; expanded?: boolean; children?: React.ReactNode; icon?: boolean }) {
  const { colors } = useTheme();
  const bg = open ? colors.inv : set ? colors["acc-soft"] : colors.sunk;
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: expanded ?? false }} hitSlop={{ top: 4, bottom: 4 }}
      style={{ height: 36, minWidth: icon ? 36 : undefined, paddingLeft: icon ? 0 : 9, paddingRight: icon ? 0 : 10, borderRadius: 18, backgroundColor: bg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
      {children}
      {!icon ? <Glyph name="chevronDown" size={12} color={open ? "on-inv" : "ink"} weight={2.4} /> : null}
    </Press>
  );
}

function CircleButton({ label, onPress, size = 40, bg, children, disabled }: { label: string; onPress?: () => void; size?: number; bg?: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <Press onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} hitSlop={size < 44 ? { top: 4, bottom: 4, left: 4, right: 4 } : undefined}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: bg, flexShrink: 0 }}>
      {children}
    </Press>
  );
}

function Check({ on }: { on: boolean }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const s = useSharedValue(on ? 1 : 0);
  useEffect(() => { s.value = withTiming(on ? 1 : 0, { duration: reduced ? 0 : 400 }); }, [on, reduced, s]);
  const a = useAnimatedStyle(() => ({ opacity: s.value, transform: [{ scale: 0.4 + 0.6 * s.value }] }));
  return (
    <Animated.View style={[{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.inv, alignItems: "center", justifyContent: "center" }, a]}>
      <Glyph name="check" size={12} color="on-inv" weight={3.2} />
    </Animated.View>
  );
}

function Shimmer({ width, height }: { width: `${number}%`; height: number }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const o = useSharedValue(0.5);
  useEffect(() => { if (!reduced) o.value = withDelay(0, withTiming(1, { duration: 550 })); }, [reduced, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width, height, borderRadius: 5, backgroundColor: colors.sunk }, a]} />;
}

export function QuoteBar({ open, clients, locale, text, onText, onBuild, onReview, onOpenChange, onMic, listening, onPhoto, photoCount = 0, defaultTax }: {
  open: boolean;
  clients: ClientOpt[];
  locale: Locale;
  text: string;
  onText: (v: string) => void;
  onBuild: (input: BarInput) => Promise<{ ok: true; quote: Built } | { ok: false; problem: BarProblem }>;
  onReview: (id: string) => void;
  onOpenChange: (open: boolean) => void;
  onMic?: () => void;
  listening?: boolean;
  onPhoto?: () => void;
  photoCount?: number;
  /** "HST", "GST + QST": the tax's name for the total line. */
  defaultTax?: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const placeholder = usePlaceholder();
  const taRef = useRef<TextInput>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [search, setSearch] = useState("");
  const [newMode, setNewMode] = useState(false);
  const [draft, setDraft] = useState<NewClient>(EMPTY_CLIENT);
  const [client, setClient] = useState<{ id?: string; name: string; data: Record<string, string> } | null>(null);
  const [budgetText, setBudgetText] = useState("");
  const [budget, setBudget] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [built, setBuilt] = useState<Built | null>(null);
  const [shown, setShown] = useState(0);
  const [total, setTotal] = useState(0);
  const [problem, setProblem] = useState<BarProblem | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const raf = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { timers.current.forEach(clearTimeout); if (raf.current) clearInterval(raf.current); }, []);

  const setOpenTo = (v: boolean) => onOpenChange(v);
  useEffect(() => {
    if (!open) { setPanel(null); return; }
    const id = setTimeout(() => taRef.current?.focus(), 380);
    return () => clearTimeout(id);
  }, [open]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => !q || `${c.name} ${c.sub}`.toLowerCase().includes(q));
  }, [clients, search]);

  const pick = (c: ClientOpt) => {
    setClient({ id: c.id, name: c.name, data: c.data });
    timers.current.push(setTimeout(() => setPanel(null), 280));
  };
  const addClient = () => {
    if (!canAddClient(draft)) return;
    const d = clientDataOf(draft);
    setClient({ name: d.nome, data: Object.fromEntries(Object.entries(d).filter(([, v]) => v)) as Record<string, string> });
    setDraft(EMPTY_CLIENT);
    setNewMode(false);
    setPanel(null);
  };
  const setBudgetTo = (n: number | null) => { setBudget(n); setBudgetText(n ? new Intl.NumberFormat(locale).format(n) : ""); setPanel(null); };
  const togglePanel = (p: Exclude<Panel, null>) => { setPanel((cur) => (cur === p ? null : p)); setNewMode(false); };

  const countUp = (to: number) => {
    if (raf.current) clearInterval(raf.current);
    if (reduced) { setTotal(to); return; }
    const from = total;
    const start = Date.now();
    raf.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / 480);
      setTotal(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p >= 1 && raf.current) clearInterval(raf.current);
    }, 16);
  };

  const build = async () => {
    if (!canBuild(text) || phase === "building") { taRef.current?.focus(); return; }
    setPanel(null);
    setProblem(null);
    setPhase("building");
    setBuilt(null);
    setShown(0);
    setTotal(0);
    const r = await onBuild({ text, client: client ? { name: client.name, data: client.data } : null, budget });
    if (!r.ok) { setPhase("idle"); setProblem(r.problem); return; }
    setBuilt(r.quote);
    const lines = r.quote.lines;
    let running = 0;
    lines.forEach((l, i) => {
      timers.current.push(setTimeout(() => {
        running += l.amount;
        setShown(i + 1);
        countUp(i === lines.length - 1 ? r.quote.total : running);
      }, reduced ? 0 : (i + 1) * LINE_MS));
    });
    timers.current.push(setTimeout(() => { countUp(r.quote.total); setPhase("done"); }, reduced ? 0 : (lines.length + 1) * LINE_MS));
  };

  const edit = () => { setPhase("idle"); setBuilt(null); setShown(0); setTotal(0); taRef.current?.focus(); };

  const fit = budget && built ? budgetFit(phase === "done" ? built.total : total, budget) : null;
  const bar = useSharedValue(0);
  useEffect(() => {
    bar.value = phase === "building" ? withTiming(0.92, { duration: reduced ? 0 : 3400 }) : phase === "done" ? withTiming(1, { duration: reduced ? 0 : 300 }) : 0;
  }, [phase, reduced, bar]);
  const barStyle = useAnimatedStyle(() => ({ width: `${bar.value * 100}%`, opacity: phase === "done" ? withDelay(300, withTiming(0, { duration: 800 })) : 1 }));
  const fitW = useSharedValue(0);
  useEffect(() => { fitW.value = withTiming(fit ? fit.ratio : 0, { duration: reduced ? 0 : 500, easing: OUT }); }, [fit?.ratio, reduced, fitW]); // eslint-disable-line react-hooks/exhaustive-deps
  const fitStyle = useAnimatedStyle(() => ({ width: `${fitW.value * 100}%` }));

  const [whole, cents] = money(total, locale).replace(/ /g, " ").split(/(?=[.,]\d\d(?: \$)?$)/);

  return (
    <View style={{ borderRadius: open ? 26 : 29, backgroundColor: colors.card, boxShadow: open ? board.aibOpenShadow : board.aibShadow.replace("var(--ring)", colors.ring) }}>
      <Fold open={!open}>
        <Press onPress={() => setOpenTo(true)} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={t("home.bar.pillLabel")}
          style={{ height: 58, flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 20, paddingRight: 9 }}>
          <Text color="faint" style={{ flexGrow: 1 }} numberOfLines={1}>{t("home.bar.placeholder")}</Text>
          <View style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}><Glyph name="mic" size={19} color="t2" /></View>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.inv, alignItems: "center", justifyContent: "center" }}>
            <Glyph name="arrowUp" size={17} color="on-inv" weight={2.3} />
          </View>
        </Press>
      </Fold>
      <Fold open={open}>
        <View style={{ paddingTop: 14, paddingHorizontal: 14, paddingBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
            <TextInput ref={taRef} value={text} onChangeText={onText} multiline accessibilityLabel={t("home.bar.describeLabel")} placeholder={t("home.bar.describePlaceholder")} placeholderTextColor={placeholder}
              textAlignVertical="top" autoCapitalize="sentences"
              style={[inputText(colors, {}), { flexGrow: 1, flexShrink: 1, minWidth: 0, fontSize: 15.5, lineHeight: 23, minHeight: 96, paddingTop: 4, paddingHorizontal: 4, paddingBottom: 0 }, noOutline]} />
            <CircleButton label={t("home.bar.collapse")} onPress={() => setOpenTo(false)} size={34} bg={colors.sunk}><Glyph name="chevronDown" size={18} color="t2" /></CircleButton>
          </View>
          <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Chip onPress={() => togglePanel("client")} label={client ? t("home.bar.clientSet", { name: client.name }) : t("home.bar.client")} open={panel === "client"} expanded={panel === "client"} set={!!client}>
              {client ? (
                <View style={{ width: 24, height: 24, marginLeft: -5, borderRadius: 12, backgroundColor: panel === "client" ? colors.card : board.chipAvatar, alignItems: "center", justifyContent: "center" }}>
                  <Text size={10.5} weight={600} tint={panel === "client" ? undefined : board.white} color={panel === "client" ? "ink" : undefined}>{initialsFor(client.name)}</Text>
                </View>
              ) : <Glyph name="user" size={15} color={panel === "client" ? "on-inv" : "ink"} weight={1.8} />}
              <Text size={13.5} weight={500} color={panel === "client" ? "on-inv" : client ? "acc-soft-t" : "ink"} numberOfLines={1} style={{ maxWidth: 96 }}>{client ? firstName(client.name) : t("home.bar.client")}</Text>
            </Chip>
            <Chip onPress={() => togglePanel("budget")} label={budget ? t("home.bar.budgetSet", { amount: money(budget, locale, { cents: false }) }) : t("home.bar.budget")} open={panel === "budget"} expanded={panel === "budget"} set={!!budget}>
              <Glyph name="dollar" size={15} color={panel === "budget" ? "on-inv" : budget ? "acc-soft-t" : "ink"} weight={1.8} />
              <Text size={13.5} weight={500} color={panel === "budget" ? "on-inv" : budget ? "acc-soft-t" : "ink"}>{budget ? money(budget, locale, { cents: false }) : t("home.bar.budget")}</Text>
            </Chip>
            {onPhoto ? (
              <Chip onPress={onPhoto} label={t("home.bar.photos")} icon set={photoCount > 0}>
                <Glyph name="photo" size={16} color={photoCount > 0 ? "acc-soft-t" : "ink"} weight={1.8} />
              </Chip>
            ) : null}
            <View style={{ flexGrow: 1 }} />
            {onMic ? <CircleButton label={listening ? t("home.bar.stopDictation") : t("home.bar.dictate")} onPress={onMic} size={36} bg={listening ? colors["acc-soft"] : undefined}><Glyph name="mic" size={18} color={listening ? "acc-soft-t" : "t2"} /></CircleButton> : null}
            <Press onPress={() => void build()} accessibilityRole="button" accessibilityLabel={t("home.bar.build")} accessibilityState={{ busy: phase === "building" }} hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.inv, alignItems: "center", justifyContent: "center", opacity: canBuild(text) ? 1 : 0.5 }}>
              {phase === "building" ? <Glyph name="more" size={17} color="on-inv" /> : <Glyph name="arrowUp" size={17} color="on-inv" weight={2.3} />}
            </Press>
          </View>

          <Fold open={panel === "client"}>
            <View style={{ marginTop: 10, padding: 10, borderRadius: 18, backgroundColor: colors.soft }}>
              {!newMode ? (
                <>
                  <View style={{ minHeight: 40, borderRadius: 12, backgroundColor: colors.card, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, boxShadow: `0 0 0 1px ${colors.ring}` }}>
                    <Glyph name="search" size={16} color="faint" />
                    <TextInput value={search} onChangeText={setSearch} accessibilityLabel={t("home.bar.searchClients")} placeholder={t("home.bar.searchClients")} placeholderTextColor={placeholder} autoCorrect={false}
                      style={[inputText(colors, {}), { flexGrow: 1, minWidth: 0, fontSize: 14.5, paddingVertical: 0 }, noOutline]} />
                  </View>
                  <View style={{ marginTop: 6 }}>
                    {matches.slice(0, 6).map((c, i) => {
                      const on = client?.id === c.id;
                      const tint = avatarTint(TINTS[i % TINTS.length]!, colors);
                      return (
                        <Rise key={c.id} delay={i * 45}>
                          <Press onPress={() => pick(c)} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 12, minHeight: 48 }}>
                            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: tint.bg, alignItems: "center", justifyContent: "center" }}><Text size={11.5} weight={600} color={tint.fg}>{initialsFor(c.name)}</Text></View>
                            <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 1 }}>
                              <Text size={14.5} weight={500} numberOfLines={1}>{c.name}</Text>
                              {c.sub ? <Text size={12.5} color="muted" numberOfLines={1}>{c.sub}</Text> : null}
                            </View>
                            <Check on={on} />
                          </Press>
                        </Rise>
                      );
                    })}
                    <Press onPress={() => setNewMode(true)} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 6, minHeight: 48 }}>
                      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.inv, alignItems: "center", justifyContent: "center" }}><Glyph name="plus" size={15} color="on-inv" weight={2.2} /></View>
                      <Text size={14.5} weight={500}>{t("home.bar.newClient")}</Text>
                    </Press>
                  </View>
                </>
              ) : (
                <Rise style={{ gap: 10 }}>
                  <Press onPress={() => setNewMode(false)} accessibilityRole="button" style={{ alignSelf: "flex-start", minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4, paddingRight: 8 }}>
                    <Glyph name="back" size={14} color="muted" weight={2.2} /><Text size={12.5} weight={500} color="muted">{t("home.bar.existing")}</Text>
                  </Press>
                  <LabeledInput label={t("home.bar.fullName")} value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} placeholder={t("home.bar.namePlaceholder")} />
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1, minWidth: 0 }}><LabeledInput label={t("home.bar.phone")} value={draft.phone} onChange={(v) => setDraft((d) => ({ ...d, phone: v }))} placeholder="(416) 555-0100" keyboard="phone-pad" numeric /></View>
                    <View style={{ flex: 1, minWidth: 0 }}><LabeledInput label={t("home.bar.email")} value={draft.email} onChange={(v) => setDraft((d) => ({ ...d, email: v }))} placeholder={t("home.bar.optional")} keyboard="email-address" /></View>
                  </View>
                  <LabeledInput label={t("home.bar.address")} value={draft.address} onChange={(v) => setDraft((d) => ({ ...d, address: v }))} placeholder={t("home.bar.addressPlaceholder")} />
                  <Press onPress={addClient} disabled={!canAddClient(draft)} accessibilityRole="button" style={{ height: 44, borderRadius: 14, backgroundColor: colors.inv, alignItems: "center", justifyContent: "center", opacity: canAddClient(draft) ? 1 : 0.4 }}>
                    <Text weight={600} size={14.5} color="on-inv">{t("home.bar.addClient")}</Text>
                  </Press>
                </Rise>
              )}
            </View>
          </Fold>

          <Fold open={panel === "budget"}>
            <View style={{ marginTop: 10, padding: 10, borderRadius: 18, backgroundColor: colors.soft }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: 2, paddingTop: 6, paddingBottom: 2 }}>
                <Num size={28} weight={600} color="faint">$</Num>
                <TextInput value={budgetText} onChangeText={(v) => { const n = parseBudget(v); setBudgetText(n ? new Intl.NumberFormat(locale).format(n) : ""); }} accessibilityLabel={t("home.bar.budgetLabel")}
                  keyboardType="number-pad" placeholder="0" placeholderTextColor={placeholder}
                  style={[inputText(colors, { numeric: true, weight: 600 }), { fontSize: 40, letterSpacing: -1.4, paddingVertical: 0, paddingHorizontal: 0, minWidth: 60, textAlign: "left" }, noOutline]} />
              </View>
              <Text size={12.5} color="muted" align="center" style={{ marginTop: 2 }}>{t("home.bar.budgetHint")}</Text>
              <View style={{ marginTop: 12, flexDirection: "row", gap: 6 }}>
                {BUDGET_PRESETS.map((p) => {
                  const on = parseBudget(budgetText) === p;
                  return (
                    <Press key={p} onPress={() => { setBudgetText(new Intl.NumberFormat(locale).format(p)); }} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={money(p, locale, { cents: false })}
                      style={{ flex: 1, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: on ? colors.inv : colors.card, boxShadow: on ? undefined : `0 0 0 1px ${colors.ring}` }}>
                      <Num size={13.5} weight={600} color={on ? "on-inv" : "ink"}>{`$${presetLabel(p, locale)}`}</Num>
                    </Press>
                  );
                })}
              </View>
              <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
                <Press onPress={() => setBudgetTo(null)} accessibilityRole="button" style={{ height: 42, paddingHorizontal: 16, borderRadius: 13, backgroundColor: colors.sunk, alignItems: "center", justifyContent: "center" }}><Text size={13.5} weight={500}>{t("home.bar.noBudget")}</Text></Press>
                <Press onPress={() => setBudgetTo(parseBudget(budgetText))} accessibilityRole="button" style={{ flexGrow: 1, height: 42, borderRadius: 13, backgroundColor: colors.inv, alignItems: "center", justifyContent: "center" }}><Text size={13.5} weight={600} color="on-inv">{t("home.bar.setBudget")}</Text></Press>
              </View>
            </View>
          </Fold>

          {problem ? (
            <View style={{ marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: colors["bad-soft"] }} accessibilityLiveRegion="polite">
              <Text size={13.5} color="bad">{t(`home.bar.problem.${problem}`)}</Text>
            </View>
          ) : null}

          <Fold open={phase !== "idle"}>
            <View style={{ marginTop: 12, padding: 14, borderRadius: 18, backgroundColor: colors.soft, overflow: "hidden", boxShadow: `inset 0 0 0 1px ${colors.ring}` }}>
              <View style={{ position: "absolute", left: 0, right: 0, top: 0, height: 2 }}>
                <Animated.View style={[{ height: 2 }, barStyle]}><LinearGradient colors={[board.logoFrom, board.logoTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 2 }} /></Animated.View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
                  <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: client ? board.chipAvatar : "transparent", alignItems: "center", justifyContent: "center", borderWidth: client ? 0 : 1.5, borderStyle: "dashed", borderColor: colors.line2 }}>
                    <Text size={10.5} weight={600} tint={client ? board.white : undefined} color={client ? undefined : "muted"}>{client ? initialsFor(client.name) : "?"}</Text>
                  </View>
                  <Text size={13.5} weight={500} numberOfLines={1} style={{ flexShrink: 1 }}>{client ? client.name : t("home.bar.clientToConfirm")}</Text>
                </View>
                {built?.number ? <Text size={11.5} color="faint">{built.number}</Text> : null}
              </View>
              <View style={{ marginTop: 10 }}>
                {built?.lines.slice(0, shown).map((l, i) => (
                  <Rise key={i}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line }}>
                      <Text size={13.5} color="t2" style={{ flexShrink: 1 }}>{l.name}</Text>
                      <Num size={13.5} weight={600} style={{ flexShrink: 0 }}>{money(l.amount, locale)}</Num>
                    </View>
                  </Rise>
                ))}
                {phase === "building" ? (
                  <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.line }}><Shimmer width="58%" height={9} /><Shimmer width="18%" height={9} /></View>
                ) : null}
              </View>
              <View style={{ marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line2, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
                <Text size={12.5} color="muted">{t("home.bar.totalIncl", { tax: defaultTax ?? t("home.bar.tax") })}</Text>
                <Num size={28} weight={600} tracking={-0.035}>{whole}<Num size={16} color="faint" tracking={-0.01}>{cents ?? ""}</Num></Num>
              </View>
              {fit ? (
                <View style={{ marginTop: 10 }}>
                  <View style={{ height: 4, borderRadius: 4, backgroundColor: colors.sunk, overflow: "hidden" }}>
                    <Animated.View style={[{ height: 4, borderRadius: 4, backgroundColor: fit.over && phase === "done" ? colors.bad : phase === "done" ? colors["ok-dot"] : colors.inv }, fitStyle]} />
                  </View>
                  <Text size={12.5} color={phase !== "done" ? "muted" : fit.over ? "bad" : "ok"} style={{ marginTop: 6 }} accessibilityLiveRegion="polite">
                    {phase !== "done" ? t("home.bar.fitting", { budget: money(budget!, locale, { cents: false }) })
                      : fit.over ? t("home.bar.over", { diff: money(fit.diff, locale, { cents: false }) })
                      : t("home.bar.within", { budget: money(budget!, locale, { cents: false }), diff: money(fit.diff, locale, { cents: false }) })}
                  </Text>
                </View>
              ) : null}
              {phase === "done" && built ? (
                <Rise style={{ marginTop: 14, flexDirection: "row", gap: 8 }}>
                  <Press onPress={() => onReview(built.id)} accessibilityRole="button" style={{ flexGrow: 1, height: 46, borderRadius: 14, backgroundColor: colors.inv, alignItems: "center", justifyContent: "center" }}><Text size={14.5} weight={600} color="on-inv">{t("home.bar.review")}</Text></Press>
                  <Press onPress={edit} accessibilityRole="button" style={{ height: 46, paddingHorizontal: 16, borderRadius: 14, backgroundColor: colors.sunk, alignItems: "center", justifyContent: "center" }}><Text size={14.5} weight={500}>{t("home.bar.edit")}</Text></Press>
                </Rise>
              ) : null}
            </View>
          </Fold>
        </View>
      </Fold>
    </View>
  );
}

function LabeledInput({ label, value, onChange, placeholder, keyboard, numeric }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; keyboard?: "phone-pad" | "email-address"; numeric?: boolean }) {
  const { colors } = useTheme();
  const ph = usePlaceholder();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 5, minWidth: 0 }}>
      <Text size={12.5} color="muted" style={{ paddingLeft: 2 }}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} accessibilityLabel={label} placeholder={placeholder} placeholderTextColor={ph} keyboardType={keyboard} autoCapitalize={keyboard ? "none" : "words"} autoCorrect={false}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={[inputText(colors, { numeric }), { height: 42, borderRadius: 12, backgroundColor: colors.card, paddingHorizontal: 12, fontSize: 14.5, boxShadow: focus ? `0 0 0 1.5px ${colors.acc}` : `0 0 0 1px ${colors.ring}` }, noOutline]} />
    </View>
  );
}
