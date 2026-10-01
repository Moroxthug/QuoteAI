// "Edit" on the Client screen's Details: a sheet with the client's fields. Only what changed is sent; clearing a
// field removes it. Notes are free text.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { canSaveDetails, changedDetails, type ClientDetail, type Details } from "@/lib/clients";
import { clientsApi } from "@/lib/clientsApi";
import { Button } from "@/ui/Button";
import { FormBody } from "@/ui/Clients";
import { useToast } from "@/ui/Feedback";
import { TextField } from "@/ui/Field";
import { Sheet, SheetTitle } from "@/ui/Sheet";

export function detailsOf(c: ClientDetail["client"]): Details {
  return { name: c.name, email: c.email ?? "", phone: c.phone ?? "", address: c.address ?? "", city: c.city ?? "", province: c.province ?? "", postalCode: c.postalCode ?? "", notes: c.notes ?? "" };
}

export function ClientEditSheet({ open, client, onClose, onSaved }: { open: boolean; client: ClientDetail["client"]; onClose: () => void; onSaved: (d: ClientDetail) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [d, setD] = useState<Details>(detailsOf(client));
  const [busy, setBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>();
  useEffect(() => { if (open) { setD(detailsOf(client)); setEmailError(undefined); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof Details) => (v: string) => setD((x) => ({ ...x, [k]: v }));
  const changes = changedDetails(detailsOf(client), d);
  const dirty = Object.keys(changes).length > 0;

  const save = async () => {
    if (!canSaveDetails(d)) { if (d.name.trim()) setEmailError(t("clients.detail.invalidEmail")); return; }
    setBusy(true);
    setEmailError(undefined);
    try {
      const r = await clientsApi.save(client.id, changes);
      toast({ message: t("clients.detail.saved") });
      onSaved(r);
    } catch {
      toast({ message: t("clients.detail.saveFailed") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} label={t("clients.detail.editTitle")} closeLabel={t("close")}>
      <SheetTitle>{t("clients.detail.editTitle")}</SheetTitle>
      <FormBody button={<Button label={t("clients.detail.save")} busy={busy ? t("clients.detail.saving") : false} disabled={!dirty || !canSaveDetails(d)} onPress={() => void save()} block />}>
        <TextField label={t("clients.detail.fields.name")} value={d.name} onChangeText={set("name")} autoCapitalize="words" autoCorrect={false} />
        <TextField label={t("clients.detail.fields.phone")} value={d.phone} onChangeText={set("phone")} keyboardType="phone-pad" numeric />
        <TextField label={t("clients.detail.fields.email")} value={d.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} error={emailError} />
        <TextField label={t("clients.detail.fields.address")} value={d.address} onChangeText={set("address")} autoCapitalize="words" />
        <TextField label={t("clients.detail.fields.city")} value={d.city} onChangeText={set("city")} autoCapitalize="words" />
        <TextField label={t("clients.detail.fields.province")} value={d.province} onChangeText={set("province")} autoCapitalize="characters" maxLength={2} />
        <TextField label={t("clients.detail.fields.postalCode")} value={d.postalCode} onChangeText={set("postalCode")} autoCapitalize="characters" />
        <TextField label={t("clients.detail.fields.notes")} value={d.notes} onChangeText={set("notes")} multiline />
      </FormBody>
    </Sheet>
  );
}
