// Phones stay upright (the boards are 390 wide); a tablet turns, so held sideways it gets the tablet layout (Tablet.dc.html, from 1024 wide).
// app.json allows every orientation; this locks a phone back to portrait. A phone is a screen whose short side is under 600.
import { Dimensions, Platform } from "react-native";

export async function fitOrientation(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const O = await import("expo-screen-orientation");
    const { width, height } = Dimensions.get("screen");
    if (Math.min(width, height) < 600) await O.lockAsync(O.OrientationLock.PORTRAIT_UP);
    else await O.unlockAsync();
  } catch { /* an older dev client without the module stays as it is */ }
}
