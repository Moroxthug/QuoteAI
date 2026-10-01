// COMPONENTS §5 (.sheet): a bottom sheet for input and choices only (pickers, Quick add,
// confirmations, Edit Home). `card`, radius 28 on top, the `sheet` shadow, a 36×5 grab handle
// in `line2` (padding 8 0 6). It slides up with the `out` easing over a `scrim`; drag it down or
// tap the scrim to close. Reduced motion: it appears and goes without sliding.
import { useEffect, useState, type ReactNode } from "react";
import { Modal, Pressable, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "@/theme/tokens";
import { easing } from "./motion";
import { shadow } from "./shadow";
import { useTheme } from "./theme";

const OUT = easing("out");
const MS = tokens.motion.segmentThumb.duration; // 450, the `out` timing the boards use for slides

export function Sheet({ open, onClose, label, closeLabel, children }: { open: boolean; onClose: () => void; /** What the sheet is, for screen readers. */ label: string; closeLabel: string; children: ReactNode }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const [mounted, setMounted] = useState(open);
  const [h, setH] = useState(0);
  const y = useSharedValue(screenH); // the sheet's offset below its resting place
  const start = useSharedValue(0);
  const ms = reduced ? 0 : MS;

  useEffect(() => {
    if (open) setMounted(true);
    else if (mounted) {
      y.value = withTiming(h || screenH, { duration: ms, easing: OUT });
      const t = setTimeout(() => setMounted(false), ms);
      return () => clearTimeout(t);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && mounted && h) {
      y.value = h;
      y.value = withTiming(0, { duration: ms, easing: OUT });
    }
  }, [open, mounted, h, ms, y]);

  const drag = Gesture.Pan()
    .activeOffsetY(8)
    .onBegin(() => { start.value = y.value; })
    .onUpdate((e) => { y.value = Math.max(0, start.value + e.translationY); })
    .onEnd((e) => {
      if (e.velocityY > 800 || y.value > h / 3) scheduleOnRN(onClose);
      else y.value = withTiming(0, { duration: ms, easing: OUT });
    });

  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const scrim = useAnimatedStyle(() => ({ opacity: h ? 1 - Math.min(1, y.value / h) : 0 }));

  if (!mounted) return null;
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1, justifyContent: "flex-end" }}>
        <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim }, scrim]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityRole="button" accessibilityLabel={closeLabel} />
        </Animated.View>
        <GestureDetector gesture={drag}>
          <Animated.View accessibilityViewIsModal accessibilityLabel={label} onLayout={(e) => setH(e.nativeEvent.layout.height)}
            style={[{ backgroundColor: colors.card, borderTopLeftRadius: tokens.radius.sheet, borderTopRightRadius: tokens.radius.sheet, boxShadow: shadow("sheet", colors), paddingBottom: insets.bottom }, sheet]}>
            <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 6 }}>
              <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: colors.line2 }} />
            </View>
            {children}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}
