import "@/i18n";
import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import * as Linking from "expo-linking";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setToken } from "@/lib/session";
import { fontFiles } from "@/ui/fonts";
import { ThemeProvider } from "@/ui/theme";
import { ToastHost } from "@/ui/Feedback";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  const [fontsLoaded, fontError] = useFonts(fontFiles);
  const url = Linking.useLinkingURL();

  // Development only: `quoteai:///?devToken=…` stores a local test token (the real sign-in is phase 124).
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
            <ToastHost>
              <Stack screenOptions={{ headerShown: false }} />
            </ToastHost>
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
