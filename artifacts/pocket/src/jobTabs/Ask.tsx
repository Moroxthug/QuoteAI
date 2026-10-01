// Job.dc.html, the Assistant tab: "Ask about this job", with the three suggested questions. The assistant is built in a later phase, exactly as its boards show it;
// until then the tab stays here as designed and says so, the way the assistant button on the tab bar does.
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Card } from "@/ui/Card";
import { Chip } from "@/ui/Chip";
import { useToast } from "@/ui/Feedback";
import { Icon } from "@/ui/Icon";
import { Section } from "@/ui/Layout";
import { Text } from "@/ui/Text";
import { usePrimary } from "./primary";

export function Ask() {
  const { t } = useTranslation();
  const j = (k: string) => t(`job.${k}`) as string;
  const toast = useToast();
  const soon = () => toast({ message: t("tabs.orbSoon") });
  usePrimary({ label: j("primary.ask"), run: soon });
  return (
    <Section pt={22} px={16} gap={12}>
      <Card padded>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <Icon name="orb" tone="violet" size={30} />
          <View style={{ flexShrink: 1, gap: 4 }}>
            <Text size={14.5} weight={600}>{j("ask.title")}</Text>
            <Text size={14.5} color="t2" leading={1.5}>{j("ask.body")}</Text>
          </View>
        </View>
      </Card>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(["budget", "update", "inspection"] as const).map((k) => <Chip key={k} label={j(`ask.chips.${k}`)} onPress={soon} />)}
      </View>
    </Section>
  );
}
