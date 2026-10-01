// Layout for screens. The lint (scripts/lint-tokens.mjs) keeps typed spacing out of src/app, so a
// screen lays itself out with these: the board's own paddings and gaps go in as props
// (`<Section px={20} pt={26} gap={14}>`), never as style objects.
import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { Rise } from "./motion";

export type Space = {
  /** Horizontal padding. */
  px?: number;
  /** Top / bottom padding. */
  pt?: number;
  pb?: number;
  /** Gap between children. */
  gap?: number;
  row?: boolean;
  align?: ViewStyle["alignItems"];
  justify?: ViewStyle["justifyContent"];
  wrap?: boolean;
  grow?: boolean;
  /** Fixed width / height (a logo, a round button). */
  w?: number;
  h?: number;
  mt?: number;
};

function box({ px, pt, pb, gap, row, align, justify, wrap, grow, w, h, mt }: Space): ViewStyle {
  return {
    paddingHorizontal: px, paddingTop: pt, paddingBottom: pb, gap, marginTop: mt, width: w, height: h,
    flexDirection: row ? "row" : "column", alignItems: align, justifyContent: justify, flexWrap: wrap ? "wrap" : undefined, flexGrow: grow ? 1 : undefined,
  };
}

export function Stack({ children, ...space }: Space & { children?: ReactNode }) {
  return <View style={box(space)}>{children}</View>;
}

/** A Stack that rises in (COMPONENTS §24), staggered by `delay` ms. */
export function Section({ children, delay = 0, ...space }: Space & { delay?: number; children?: ReactNode }) {
  return <Rise delay={delay} style={box(space)}>{children}</Rise>;
}

/** Empty space that pushes what follows to the bottom. */
export function Spacer({ h }: { h?: number }) {
  return <View style={h ? { height: h } : { flexGrow: 1 }} />;
}
