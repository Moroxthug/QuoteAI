// Phase 153 placeholder: proves the app boots, speaks EN/FR and reaches the API through the
// shared generated hooks with the stored token. Replaced by Welcome / Home in phase 1.
import { Text, View } from "react-native";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { getGetBusinessProfileQueryKey, useGetBusinessProfile } from "@workspace/api-client-react";
import { tokens } from "@/theme/tokens";

const c = tokens.color.light;

export default function Index() {
  const { t } = useTranslation();
  const { data } = useGetBusinessProfile({ query: { queryKey: getGetBusinessProfileQueryKey(), retry: false } });
  return (
    <View style={{ flex: 1, backgroundColor: c.ground, alignItems: "center", justifyContent: "center", gap: tokens.space.gutter }}>
      <Text style={{ color: c.ink, fontSize: tokens.type.roles.body.size }}>{data ? t("dev.session", { company: data.companyName }) : t("dev.noSession")}</Text>
      <Link href="/sandbox" style={{ color: c["acc-t"], fontSize: tokens.type.roles.body.size }}>{t("sandbox.title")}</Link>
    </View>
  );
}
