// "/" decides where a person starts (lib/useGate.ts); it draws nothing itself.
import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { View } from "react-native";
import { loadCrewSession, useCrewSession } from "@/lib/crewSession";
import { peekPendingJoinCode } from "@/lib/joinCodeDevice";
import { useGate } from "@/lib/useGate";
import { useTheme } from "@/ui/theme";

export default function Index() {
  const gate = useGate();
  // A phone paired as a crew phone has no account: it opens on the crew's day.
  const crew = useCrewSession();
  useEffect(() => { void loadCrewSession(); }, []);
  // An access code typed before signing up or in comes back to the join screen once they are in.
  const signedIn = gate !== null && gate !== "/welcome" && gate !== "/sign-in";
  const [pending, setPending] = useState<string | null | undefined>(undefined);
  useEffect(() => { if (signedIn) void peekPendingJoinCode().then(setPending); }, [signedIn]);
  const { colors } = useTheme();
  if ((gate === "/welcome" || gate === "/sign-in") && crew.token) return <Redirect href="/crew-now" />;
  if (!gate || (signedIn && pending === undefined)) return <View style={{ flex: 1, backgroundColor: colors.ground }} />;
  if (signedIn && pending) return <Redirect href={{ pathname: "/join-code", params: { code: pending } }} />;
  return <Redirect href={gate} />;
}
