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
import { setToken } from "@/lib/session";
import { SessionProvider } from "@/lib/useSession";
import { fontFiles } from "@/ui/fonts";
import { ThemeProvider } from "@/ui/theme";
import { ToastHost } from "@/ui/Feedback";
import { CardOpenProvider } from "@/ui/CardOpen";
import { GlobalTabBar } from "@/ui/GlobalTabBar";
import { FreeQuotesGate } from "@/ui/FreeQuotes";
import { board } from "@/theme/board";

void SplashScreen.preventAutoHideAsync();

/** The navigator paints no ground of its own: every screen has its own, and the black behind a pushed-back Home (COMPONENTS §6b) has to show through. */
const NAV_THEME = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: "transparent" } };

function RootLayout() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  const [fontsLoaded, fontError] = useFonts(fontFiles);
  const url = Linking.useLinkingURL();

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
                    <NavThemeProvider value={NAV_THEME}>
                      <Stack screenOptions={{ headerShown: false, animation: "fade", contentStyle: { backgroundColor: "transparent" } }} />
                    </NavThemeProvider>
                    <GlobalTabBar />
                    <FreeQuotesGate />
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
