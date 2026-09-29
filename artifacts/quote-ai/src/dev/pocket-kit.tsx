// Phase 143 — /dashboard/__pocket (dev server only, see App.tsx): every Pocket part
// with the canvas's own sample content (docs/pocket-design/), inside the real shell,
// so each can be compared with the canvas render. English literals on purpose: this page never ships.
import { useState } from "react";
import { Avatar, Bar, Card, GroupLabel, MenuRow, Section, SectionHead, Segmented, SettingRow, Stepper, Switch } from "@/components/pocket/kit";

export default function PocketKit() {
  const [lang, setLang] = useState<"en" | "fr">("en");
  const [period, setPeriod] = useState<"W" | "M" | "Q">("M");
  const [ch, setCh] = useState<"email" | "sms" | "wa">("sms");
  const [speak, setSpeak] = useState(true);
  const [copy, setCopy] = useState(false);
  const [dep, setDep] = useState(30);
  return (
    <div className="pk-page">
      <h1 className="pk-h1 pk-rise">Settings</h1>

      <Section i={1}>
        <GroupLabel>Assistant</GroupLabel>
        <div className="pk-card-20">
          <SettingRow label="Language">
            <Segmented label="Language" width={150} value={lang} onChange={setLang} options={[{ value: "en", label: "English" }, { value: "fr", label: "Français" }]} />
          </SettingRow>
          <SettingRow label="Speak replies aloud" hint="Mutes when your phone is on silent"><Switch on={speak} onChange={setSpeak} label="Speak replies aloud" /></SettingRow>
          <SettingRow label="Send me a copy" hint="Every quote you send, by email"><Switch on={copy} onChange={setCopy} label="Send me a copy" /></SettingRow>
          <SettingRow label="Deposit" hint="Asked on acceptance">
            <Stepper value={`${dep}%`} onDec={() => setDep(Math.max(0, dep - 5))} onInc={() => setDep(Math.min(50, dep + 5))} decLabel="Decrease Deposit" incLabel="Increase Deposit" />
          </SettingRow>
        </div>
      </Section>

      <Section i={2}>
        <GroupLabel>Business</GroupLabel>
        <div className="pk-card-20">
          <MenuRow icon="building" label="Company profile" value="HST # on file" href="/dashboard/settings/company" />
          <MenuRow icon="tag" label="Price book" value="212 items" href="/dashboard/catalog" />
          <MenuRow icon="clock" label="Timesheets" value="1 to approve" accent href="/dashboard/team" />
        </div>
      </Section>

      <Section i={3}>
        <SectionHead title="Business">
          <Segmented label="Period" width={156} size={28} variant="tint" value={period} onChange={setPeriod} options={[{ value: "W", label: "Week" }, { value: "M", label: "Month" }, { value: "Q", label: "Quarter" }]} />
        </SectionHead>
        <Card style={{ padding: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 11.5, color: "var(--pk-text-2)" }}>Quotes won</span>
            <span className="pk-num" style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.03em" }}>62%</span>
            <span style={{ marginTop: 3 }}><Bar pct={62} width={72} grow /></span>
          </div>
        </Card>
      </Section>

      <Section i={4}>
        <h2 className="pk-group-label" style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--pk-ink)", margin: "0 4px 10px" }}>Send by</h2>
        <Segmented label="Send channel" size={50} variant="big" value={ch} onChange={setCh} options={[{ value: "email", label: "Email", sub: "dana.w@…" }, { value: "sms", label: "SMS", sub: "… 0121" }, { value: "wa", label: "WhatsApp", sub: "… 0121" }]}
          renderOption={(o) => (<span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}><span style={{ fontSize: 13, fontWeight: 500 }}>{o.label}</span><span className="pk-mono" style={{ fontSize: 10.5, opacity: .7 }}>{o.sub}</span></span>)} />
      </Section>

      <Section i={5}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Avatar initials="MR" size={52} fontSize={17} dark />
          <Avatar initials="DW" size={32} fontSize={11.5} />
          <button type="button" className="pk-btn pk-btn-dark pk-press" style={{ flexGrow: 1 }}>Review and send</button>
          <button type="button" className="pk-btn pk-btn-soft pk-press">Redo</button>
        </div>
      </Section>
    </div>
  );
}
