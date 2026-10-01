// Components.dc.html · "Inputs": text, email, phone, money and unit fields, multi-line, select,
// date and time, the one-time code, an error, a disabled field and search.
import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { dayDate, number, time, type Locale } from "@/lib/format";
import { AffixField, CodeField, SelectField, TextField } from "../Field";
import { Search } from "../Search";
import { BoardPad, BoardSection } from "../sandbox";

const SAMPLE = new Date(2026, 8, 29, 9, 0); // Tue Sep 29, 9:00 am, the boards' sample day

/** Remounted on a language switch so the sample values are re-formatted for the new locale. */
export function InputsSection() {
  const { i18n } = useTranslation();
  return <Inputs key={i18n.language} />;
}

function Inputs() {
  const { t, i18n } = useTranslation();
  const c = (k: string) => t(`board.inputs.${k}`);
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const [company, setCompany] = useState(c("company"));
  const [email, setEmail] = useState(c("emailValue"));
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState(number(4131.05, locale, 2));
  const [area, setArea] = useState(number(420, locale));
  const [note, setNote] = useState(c("note"));
  const [code, setCode] = useState("482");
  const [bad, setBad] = useState(c("badEmail"));
  const [query, setQuery] = useState("");
  return (
    <>
      <BoardSection title={c("title")} />
      <BoardPad style={{ paddingTop: 14, gap: 14 }}>
        <TextField label={c("text")} value={company} onChangeText={setCompany} forceFocused />
        <TextField label={c("email")} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <TextField label={c("phone")} value={phone} onChangeText={setPhone} placeholder={c("phoneHint")} keyboardType="phone-pad" autoComplete="tel" numeric />
        <AffixField label={c("money")} value={amount} onChangeText={setAmount} prefix={c("currency")} suffix={c("cad")} keyboardType="decimal-pad" weight={600} />
        <AffixField label={c("unit")} value={area} onChangeText={setArea} suffix={c("sqft")} keyboardType="decimal-pad" />
        <TextField label={c("multi")} value={note} onChangeText={setNote} multiline numberOfLines={3} />
        <SelectField label={c("select")} value={c("foreman")} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0 }}><SelectField label={c("date")} value={dayDate(SAMPLE, locale)} mono chevron={false} /></View>
          <View style={{ flex: 1, minWidth: 0 }}><SelectField label={c("time")} value={time(SAMPLE, locale)} mono chevron={false} /></View>
        </View>
        <CodeField label={c("code")} value={code} onChange={setCode} />
        <TextField label={c("emailError")} value={bad} onChangeText={setBad} error={c("badEmailMsg")} keyboardType="email-address" autoCapitalize="none" />
        <TextField label={c("disabled")} value={c("hst")} disabled />
        <Search label={c("search")} placeholder={c("searchHint")} value={query} onChangeText={setQuery} />
      </BoardPad>
    </>
  );
}
