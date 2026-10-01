// Onboarding.dc.html: three steps (your work + province, your company, your team). The header's
// Skip moves on a step (the last one finishes); Finish setup sends the invitations and goes Home,
// as the board's button links to SmartHome (/home). Everything typed is saved best-effort, and a
// person who leaves without a company name is marked "skipped" so the gate doesn't bring them back.
import { useState } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { getGetBusinessProfileQueryKey, useUpdateBusinessProfile } from "@workspace/api-client-react";
import {
  PROVINCES, TRADES, codeCount, companyBody, detailsBody, initialsOf, isEmail, nameOf, nextRole, setupBody, togglePick,
  type Person, type ProvinceCode,
} from "@/lib/onboarding";
import { pickLogo } from "@/lib/onboardingLogo";
import { onboardingApi } from "@/lib/onboardingApi";
import { useSession } from "@/lib/useSession";
import { AuthBody } from "@/ui/Auth";
import { Avatar, type AvatarTint } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Banner, useToast } from "@/ui/Feedback";
import { TextField } from "@/ui/Field";
import { FormCard, FormRow } from "@/ui/FormCard";
import { Glyph, Icon } from "@/ui/Icon";
import { Section, Stack } from "@/ui/Layout";
import { BottomBar, ControlRow, DisclosureRow, FormAction, PickerRow, PickRow, QuotePreview, RolePill, SheetList, SheetTitle, StepBar, TileGrid, TradeTile } from "@/ui/Onboarding";
import { Press } from "@/ui/motion";
import { RowBody, RowList, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Segmented } from "@/ui/Segmented";
import { Sheet } from "@/ui/Sheet";
import { Status } from "@/ui/Status";
import { Switch } from "@/ui/Switch";
import { Text } from "@/ui/Text";

const TINTS: AvatarTint[] = [1, 2, 3, 4, 5];

export default function Onboarding() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { skipSetup } = useSession();
  const updateProfile = useUpdateBusinessProfile();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);

  // Step 1
  const [trades, setTrades] = useState<string[]>([]);
  const [province, setProvince] = useState<ProvinceCode | null>(null);
  const [provOpen, setProvOpen] = useState(false);

  // Step 2
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [more, setMore] = useState(false);
  const [bn, setBn] = useState("");
  const [licence, setLicence] = useState("");
  const [address, setAddress] = useState("");
  const [etransfer, setEtransfer] = useState("");
  const [needName, setNeedName] = useState(false);
  const [saved, setSaved] = useState(false); // the company name reached the server

  // Step 3
  const [size, setSize] = useState(1);
  const [field, setField] = useState(true);
  const [people, setPeople] = useState<Person[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [codes, setCodes] = useState(false);
  const [codesBusy, setCodesBusy] = useState(false);

  const prov = province ? { name: t(`onboarding.provinces.${province}.name`), tax: t(`onboarding.provinces.${province}.tax`), note: t(`onboarding.provinces.${province}.note`) } : null;
  const tradeNames = TRADES.filter((x) => trades.includes(x.id)).map((x) => t(`onboarding.work.trade.${x.id}`));

  const back = () => (step > 1 ? setStep((step - 1) as 1 | 2) : router.canGoBack() ? router.back() : undefined);

  /** Province, licence, e-Transfer email and the "your work" answers: never blocks the flow. */
  async function saveRest(withSize: boolean) {
    const d = detailsBody({ province, licenceNumber: licence, etransferEmail: etransfer });
    if (d) await onboardingApi.saveDetails(d).catch(() => undefined);
    const s = setupBody({ trades, sizeIndex: withSize ? size : null, fieldCrew: withSize ? field : null });
    if (s) await onboardingApi.saveSetup(s).catch(() => undefined);
  }

  async function saveCompany(): Promise<boolean> {
    try {
      await updateProfile.mutateAsync({ data: companyBody({ companyName: company, phone, email, vatNumber: bn, address }) });
      await saveRest(false);
      await queryClient.invalidateQueries({ queryKey: getGetBusinessProfileQueryKey() });
      setSaved(true);
      return true;
    } catch {
      toast({ message: t("onboarding.company.saveFailed") });
      return false;
    }
  }

  async function next() {
    if (busy) return;
    if (step === 1) { setStep(2); return; }
    if (!company.trim()) { setNeedName(true); toast({ message: t("onboarding.company.needName") }); return; }
    setBusy(true);
    const ok = await saveCompany();
    setBusy(false);
    if (ok) setStep(3);
  }

  async function skip() {
    if (busy) return;
    if (step < 3) { setStep((step + 1) as 2 | 3); return; }
    await finish();
  }

  async function finish() {
    if (busy) return;
    setBusy(true);
    let hasCompany = saved;
    if (!hasCompany && company.trim()) hasCompany = await saveCompany();
    else if (!hasCompany) await saveRest(false);
    await saveRest(true);
    let failed = 0;
    for (const p of people) {
      try { await onboardingApi.invite(p.email, p.role); } catch { failed += 1; }
    }
    if (failed) toast({ message: t("onboarding.team.inviteFailed") });
    if (!hasCompany) await skipSetup(true);
    setBusy(false);
    router.replace("/home");
  }

  async function logo() {
    const r = await pickLogo();
    if (!r.ok && r.reason === "unavailable") toast({ message: t("onboarding.company.logoUnavailable") });
  }

  function addPerson() {
    const e = addEmail.trim();
    if (!isEmail(e)) { setAddError(t("onboarding.team.badEmail")); return; }
    if (people.some((p) => p.email.toLowerCase() === e.toLowerCase())) { setAddError(t("onboarding.team.duplicate")); return; }
    setPeople([...people, { email: e, role: "crew" }]);
    setAddEmail("");
    setAddError(null);
    setAddOpen(false);
  }

  async function makeCodes() {
    if (codesBusy) return;
    setCodesBusy(true);
    try {
      await onboardingApi.makeCodes(codeCount(people));
      setCodes(true);
    } catch {
      toast({ message: t("onboarding.team.codesFailed") });
    }
    setCodesBusy(false);
  }

  const showBack = step > 1 || router.canGoBack();
  const sizes = t("onboarding.team.sizes", { returnObjects: true }) as unknown as string[];
  const bnShown = bn.trim() ? t("onboarding.company.bnLine", { n: bn.trim() }) : t("onboarding.company.bnNone");

  return (
    <Screen>
      <StepBar step={step} progressLabel={t("onboarding.progress", { n: step })} onBack={showBack ? back : undefined} backLabel={t("onboarding.back")}
        onSkip={() => void skip()} skipLabel={t("onboarding.skip")} />
      <AuthBody bottom={24}>
        {step === 1 ? (
          <Stack key="s1">
            <Section px={20} pt={20} gap={8}>
              <Text size={28} weight={600} tracking={-0.045} leading={1.15} accessibilityRole="header">{t("onboarding.work.title")}</Text>
              <Text color="muted" leading={1.45}>{t("onboarding.work.sub")}</Text>
            </Section>
            <Section delay={60} px={16} pt={20}>
              <TileGrid>
                {TRADES.map((x) => (
                  <TradeTile key={x.id} label={t(`onboarding.work.trade.${x.id}`)} icon={x.icon} tone={x.tone} selected={trades.includes(x.id)}
                    onPress={() => setTrades(togglePick(trades, x.id))} />
                ))}
              </TileGrid>
              <Stack px={4} pt={10}>
                <Text size={12.5} color="muted" accessibilityLiveRegion="polite">
                  {tradeNames.length ? t("onboarding.work.picked", { count: tradeNames.length, names: tradeNames.join(", ") }) : t("onboarding.work.none")}
                </Text>
              </Stack>
            </Section>
            <Section delay={110} px={16} pt={22}>
              <SectionHeader title={t("onboarding.work.where")} />
              <PickerRow icon="pin" tone="rose" label={t("onboarding.work.province")} value={prov ? prov.name : "—"} onPress={() => setProvOpen(true)} />
              {prov ? (
                <Stack pt={10}>
                  <Banner tone="acc" icon="percent" iconTone="violet" lead={prov.tax}>{prov.note}</Banner>
                </Stack>
              ) : null}
            </Section>
          </Stack>
        ) : null}

        {step === 2 ? (
          <Stack key="s2">
            <Section px={20} pt={20} gap={8}>
              <Text size={28} weight={600} tracking={-0.045} leading={1.15} accessibilityRole="header">{t("onboarding.company.title")}</Text>
              <Text color="muted" leading={1.45}>{t("onboarding.company.sub")}</Text>
            </Section>
            <Section delay={60} px={16} pt={20}>
              <FormCard error={needName && !company.trim()}>
                <FormRow first icon="building" tone="violet" label={t("onboarding.company.name")} value={company} onChangeText={(v) => { setCompany(v); setNeedName(false); }}
                  placeholder={t("onboarding.company.namePlaceholder")} autoComplete="organization" autoCapitalize="words" returnKeyType="next" />
                <FormRow icon="phone" tone="teal" label={t("onboarding.company.phone")} value={phone} onChangeText={setPhone} numeric
                  placeholder={t("onboarding.company.phonePlaceholder")} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
                <FormRow icon="mail" tone="sky" label={t("onboarding.company.email")} value={email} onChangeText={setEmail}
                  placeholder={t("onboarding.company.emailPlaceholder")} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" />
              </FormCard>
            </Section>
            <Section delay={100} px={16} pt={12} gap={10}>
              <DisclosureRow icon="list" tone="slate" title={t("onboarding.company.more")} sub={t("onboarding.company.moreSub")} open={more} onPress={() => setMore(!more)} />
              {more ? (
                <Section>
                  <FormCard>
                    <FormAction first icon="camera" tone="lilac" label={t("onboarding.company.logo")} value={t("onboarding.company.logoAdd")} onPress={() => void logo()} />
                    <FormRow icon="doc" tone="indigo" label={t("onboarding.company.bn")} value={bn} onChangeText={setBn} numeric
                      placeholder={t("onboarding.company.bnPlaceholder")} autoCapitalize="characters" autoCorrect={false} />
                    <FormRow icon="shield" tone="sage" label={province === "QC" ? t("onboarding.company.licenceQc") : t("onboarding.company.licence")} value={licence} onChangeText={setLicence}
                      placeholder={t("onboarding.company.optional")} autoCapitalize="characters" autoCorrect={false} />
                    <FormRow icon="pin" tone="rose" label={t("onboarding.company.address")} value={address} onChangeText={setAddress}
                      placeholder={t("onboarding.company.addressPlaceholder")} autoComplete="street-address" />
                    <FormRow icon="bank" tone="gold" label={t("onboarding.company.etransfer")} value={etransfer} onChangeText={setEtransfer}
                      placeholder={t("onboarding.company.etransferPlaceholder")} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                  </FormCard>
                </Section>
              ) : null}
            </Section>
            <Section delay={140} px={16} pt={22}>
              <SectionHeader title={t("onboarding.company.onQuotes")} />
              <QuotePreview name={company.trim() || t("onboarding.company.namePlaceholder")}
                contact={`${phone.trim() || "—"} · ${email.trim() || t("onboarding.company.noEmail")}`}
                number={t("onboarding.company.sample")}
                province={prov ? `${prov.name} · ${prov.tax}` : ""} taxId={bnShown} />
            </Section>
          </Stack>
        ) : null}

        {step === 3 ? (
          <Stack key="s3">
            <Section px={20} pt={20} gap={8}>
              <Text size={28} weight={600} tracking={-0.045} leading={1.15} accessibilityRole="header">{t("onboarding.team.title")}</Text>
              <Text color="muted" leading={1.45}>{t("onboarding.team.sub")}</Text>
            </Section>
            <Section delay={60} px={16} pt={20}>
              <Segmented options={sizes} value={size} onChange={setSize} label={t("onboarding.team.size")} />
            </Section>
            {size === 0 ? (
              <Section px={16} pt={16}>
                <Card padded>
                  <Stack row gap={14} align="center" pt={6} pb={6}>
                    <Stack w={34}><SoloIcon /></Stack>
                    <Stack grow gap={3}>
                      <Text weight={600}>{t("onboarding.team.soloTitle")}</Text>
                      <Text size={13.5} color="muted" leading={1.4}>{t("onboarding.team.soloBody")}</Text>
                    </Stack>
                  </Stack>
                </Card>
              </Section>
            ) : (
              <>
                <Section delay={90} px={16} pt={16}>
                  <Card>
                    <ControlRow icon="cone" tone="amber" title={t("onboarding.team.crewTitle")} sub={t("onboarding.team.crewBody")}>
                      <Switch value={field} onChange={setField} label={t("onboarding.team.crewTitle")} />
                    </ControlRow>
                  </Card>
                </Section>
                <Section delay={130} px={16} pt={22}>
                  <Stack row justify="space-between" align="center" px={4} pb={10}>
                    <Text weight={600} tracking={-0.02} accessibilityRole="header">{t("onboarding.team.invite")}</Text>
                    <Text size={12.5} color="muted">{t("onboarding.team.tapRole")}</Text>
                  </Stack>
                  <Card>
                    <RowList>
                      {people.map((p, i) => (
                        <RowBody key={p.email} title={nameOf(p.email)} meta={p.email}
                          leading={<Avatar initials={initialsOf(p.email)} tint={TINTS[i % 5]} size={36} />}
                          trailing={
                            <RolePill label={t(`onboarding.team.role.${p.role}`)} accent={p.role === "admin"}
                              a11y={t("onboarding.team.roleLabel", { name: nameOf(p.email), role: t(`onboarding.team.role.${p.role}`) })}
                              onPress={() => setPeople(people.map((x, j) => (j === i ? { ...x, role: nextRole(x.role) } : x)))} />
                          } />
                      ))}
                      <AddRow label={t("onboarding.team.add")} onPress={() => setAddOpen(true)} />
                    </RowList>
                  </Card>
                </Section>
                {field ? (
                  <Section delay={160} px={16} pt={12}>
                    <Card>
                      <ControlRow icon="key" tone="indigo" title={t("onboarding.team.codes")} sub={codes ? t("onboarding.team.codesMade") : t("onboarding.team.codesSub")} minHeight={60}>
                        {codes ? <Status tone="ok" shape="check">{t("onboarding.team.ready")}</Status>
                          : <Button size="sm" kind="secondary" label={t("onboarding.team.create")} busy={codesBusy ? t("onboarding.team.create") : false} onPress={() => void makeCodes()} />}
                      </ControlRow>
                    </Card>
                  </Section>
                ) : null}
              </>
            )}
          </Stack>
        ) : null}
      </AuthBody>

      <BottomBar>
        {step < 3 ? (
          <Button size="lg" block busy={busy ? t("onboarding.company.saving") : false} label={step === 1 && !trades.length ? t("onboarding.continueNoTrade") : t("onboarding.continue")} onPress={() => void next()} />
        ) : (
          <Button size="lg" block busy={busy ? t("onboarding.team.finishing") : false} label={t("onboarding.finish")} onPress={() => void finish()} />
        )}
      </BottomBar>

      <Sheet open={provOpen} onClose={() => setProvOpen(false)} label={t("onboarding.work.province")} closeLabel={t("onboarding.team.close")}>
        <SheetTitle title={t("onboarding.work.province")} closeLabel={t("onboarding.team.close")} onClose={() => setProvOpen(false)} />
        <SheetList>
          {PROVINCES.map((c) => (
            <PickRow key={c} title={t(`onboarding.provinces.${c}.name`)} sub={t(`onboarding.provinces.${c}.tax`)} selected={province === c}
              onPress={() => { setProvince(c); setProvOpen(false); }} />
          ))}
        </SheetList>
      </Sheet>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} label={t("onboarding.team.addTitle")} closeLabel={t("onboarding.team.close")}>
        <SheetTitle title={t("onboarding.team.addTitle")} closeLabel={t("onboarding.team.close")} onClose={() => setAddOpen(false)} />
        <Stack px={16} pb={16} gap={14}>
          <TextField label={t("onboarding.team.addEmail")} value={addEmail} onChangeText={(v) => { setAddEmail(v); setAddError(null); }} error={addError ?? undefined}
            placeholder={t("onboarding.team.addEmailPlaceholder")} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email"
            returnKeyType="done" onSubmitEditing={addPerson} />
          <Button size="lg" block label={t("onboarding.team.addSubmit")} onPress={addPerson} />
        </Stack>
      </Sheet>
    </Screen>
  );
}

// Small local pieces that only compose kit parts.
function SoloIcon() {
  return <Icon name="user" tone="violet" size={34} />;
}

function AddRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Stack row gap={12} align="center" px={16} pt={10} pb={10}>
        <Stack w={36} h={36} align="center" justify="center"><PlusGlyph /></Stack>
        <Text weight={500} color="acc-t">{label}</Text>
      </Stack>
    </Press>
  );
}

function PlusGlyph() {
  return <Glyph name="plus" size={20} color="acc-t" />;
}
