// "Add client" (Clients tab): a sheet with name, phone, email and site address; one button. The server does not
// add the same person twice (name, email and phone are the key): the existing client opens instead.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { clientsApi } from "@/lib/clientsApi";
import { canSaveDetails, type ClientDetail, type Details } from "@/lib/clients";
import { Button } from "@/ui/Button";
import { FormBody } from "@/ui/Clients";
import { TextField } from "@/ui/Field";
import { useToast } from "@/ui/Feedback";
import { Sheet, SheetTitle } from "@/ui/Sheet";

const EMPTY: Details = { name: "", email: "", phone: "", address: "", city: "", province: "", postalCode: "", notes: "" };

export function AddClientSheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (d: ClientDetail) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [d, setD] = useState<Details>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const set = (k: keyof Details) => (v: string) => setD((x) => ({ ...x, [k]: v }));

  const save = async () => {
    if (!canSaveDetails(d)) { setError(d.name.trim() ? t("clients.detail.invalidEmail") : undefined); return; }
    setBusy(true);
    setError(undefined);
    try {
      const body = Object.fromEntries(Object.entries(d).filter(([, v]) => v.trim() !== "").map(([k, v]) => [k, v.trim()]));
      const r = await clientsApi.add(body);
      setD(EMPTY);
      toast({ message: t("clients.addSheet.done") });
      onAdded(r);
    } catch {
      toast({ message: t("clients.addSheet.failed") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} label={t("clients.addSheet.title")} closeLabel={t("close")}>
      <SheetTitle>{t("clients.addSheet.title")}</SheetTitle>
      <FormBody button={<Button label={t("clients.addSheet.save")} busy={busy ? t("clients.addSheet.saving") : false} disabled={!canSaveDetails(d)} onPress={() => void save()} block />}>
        <TextField label={t("clients.addSheet.name")} value={d.name} onChangeText={set("name")} placeholder={t("clients.addSheet.namePlaceholder")} autoCapitalize="words" autoCorrect={false} />
        <TextField label={t("clients.addSheet.phone")} value={d.phone} onChangeText={set("phone")} placeholder="(416) 555-0100" keyboardType="phone-pad" numeric />
        <TextField label={t("clients.addSheet.email")} value={d.email} onChangeText={set("email")} placeholder={t("clients.addSheet.optional")} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} error={error} />
        <TextField label={t("clients.addSheet.address")} value={d.address} onChangeText={set("address")} placeholder={t("clients.addSheet.addressPlaceholder")} autoCapitalize="words" />
      </FormBody>
    </Sheet>
  );
}
