import "@/i18n";
import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import * as Linking from "expo-linking";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setToken } from "@/lib/session";

export default function RootLayout() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  const url = Linking.useLinkingURL();

  // Development only: `quoteai:///?devToken=…` stores a local test token (the real sign-in is phase 1).
  useEffect(() => {
    if (!__DEV__ || !url) return;
    const token = Linking.parse(url).queryParams?.devToken;
    if (typeof token === "string" && token) void setToken(token).then(() => client.invalidateQueries());
  }, [url, client]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={client}>
          <Stack screenOptions={{ headerShown: false }} />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
