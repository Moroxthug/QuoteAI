// A tab screen: the screen on its ground. The tab bar and the assistant orb are drawn once for every screen by GlobalTabBar (in the root layout), so Home, Quotes, Jobs and Clients only reserve the room.
import type { ReactNode } from "react";
import { Screen } from "./Screen";
import type { TabKey } from "./TabBar";

export function TabScreen({ children }: { active?: TabKey; children: ReactNode }) {
  return <Screen>{children}</Screen>;
}
