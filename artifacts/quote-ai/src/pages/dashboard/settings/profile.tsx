import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/i18n/LanguageContext";
import { PersonAvatar } from "@/components/people/avatar";
import { peopleApi } from "@/lib/people-api";
import { ActionRow, SettingsGroup, SettingsSection } from "./ui";

/**
 * You → Profile: who you are to your team and your clients. The editing
 * lives on your profile page (/dashboard/me, Phase 91), which also shows your
 * numbers and history; this is the summary and the way there.
 */
export function ProfileSection() {
  const { t } = useLanguage();
  const me = useQuery({ queryKey: ["me"], queryFn: peopleApi.me });
  const person = me.data?.person;
  return (
    <SettingsSection title={t("settings.section.profile")} intro={t("settings.intro.profile")}>
      {me.isLoading ? (
        <Skeleton className="h-40 w-full rounded-[var(--radius)]" />
      ) : person ? (
        <SettingsGroup>
          <div className="sprofile">
            <PersonAvatar name={person.name} image={person.image} size={56} />
            <div className="sprofile-txt">
              <b>{person.name}</b>
              <span>{[person.jobTitle, person.email].filter(Boolean).join(" · ")}</span>
              {person.phone && <span>{person.phone}</span>}
            </div>
          </div>
          <ActionRow label={t("settings.profile.editLabel")} help={t("settings.profile.editHelp")}>
            <Link href="/dashboard/me" className="btn btn-outline-navy btn-sm">{t("settings.profile.edit")}</Link>
          </ActionRow>
        </SettingsGroup>
      ) : null}
    </SettingsSection>
  );
}
