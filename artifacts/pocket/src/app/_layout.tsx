import "@/i18n";
import { withSentry } from "@/lib/sentry";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from "expo-router";
import * as Linking from "expo-linking";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { API_ORIGIN, setToken } from "@/lib/session";
import { startNet } from "@/lib/net";
import { startOutbox } from "@/lib/outbox";
import { startUpdates } from "@/lib/appUpdates";
import { fitOrientation } from "@/lib/orientation";
import { SessionProvider } from "@/lib/useSession";
import { fontFiles } from "@/ui/fonts";
import { ThemeProvider } from "@/ui/theme";
import { ToastHost } from "@/ui/Feedback";
import { CardOpenProvider } from "@/ui/CardOpen";
import { GlobalTabBar } from "@/ui/GlobalTabBar";
import { RailSlot } from "@/ui/Rail";
import { FreeQuotesGate } from "@/ui/FreeQuotes";
import { AppLockHost } from "@/ui/AppLock";
import { usePlayBillingBoot } from "@/lib/usePlayBilling";
import { board } from "@/theme/board";

void SplashScreen.preventAutoHideAsync();

/** The navigator paints no ground of its own: every screen has its own, and the black behind a pushed-back Home (COMPONENTS §6b) has to show through. */
const NAV_THEME = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: "transparent" } };

/** Android: connect to Google Play once signed in, and finish any purchase left open. Renders nothing. */
function PlayBillingBoot() {
  usePlayBillingBoot();
  return null;
}

function RootLayout() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  const [fontsLoaded, fontError] = useFonts(fontFiles);
  const url = Linking.useLinkingURL();

  // SystemStates: the connection, and what waits on the phone to be sent when it is back.
  useEffect(() => { startNet(API_ORIGIN); startOutbox(client); startUpdates(); void fitOrientation(); }, [client]);

  // Development only: `quoteai:///?devToken=…` stores a local test token (a shortcut; the real sign-in is /sign-in).
  useEffect(() => {
    if (!__DEV__ || !url) return;
    const token = Linking.parse(url).queryParams?.devToken;
    if (typeof token === "string" && token) void setToken(token).then(() => client.invalidateQueries());
  }, [url, client]);

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryClientProvider client={client}>
            <SessionProvider>
              <ToastHost>
                <CardOpenProvider>
                  <View style={{ flex: 1, backgroundColor: board.cardOpen.backdrop }}>
                    <View style={{ flex: 1, flexDirection: "row" }}>
                      <RailSlot />
                      <View style={{ flex: 1 }}>
                        <NavThemeProvider value={NAV_THEME}>
                          <Stack screenOptions={{ headerShown: false, animation: "fade", contentStyle: { backgroundColor: "transparent" } }} />
                        </NavThemeProvider>
                      </View>
                    </View>
                    <GlobalTabBar />
                    <FreeQuotesGate />
                    <PlayBillingBoot />
                    <AppLockHost />
                  </View>
                </CardOpenProvider>
              </ToastHost>
            </SessionProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default withSentry(RootLayout);
