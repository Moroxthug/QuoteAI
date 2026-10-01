// "Record progress" (the Overview and Schedule tabs' action): a note on the job, saved as one.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { jobsApi } from "@/lib/jobsApi";
import { Button } from "@/ui/Button";
import { useToast } from "@/ui/Feedback";
import { TextField } from "@/ui/Field";
import { Stack } from "@/ui/Layout";
import { Sheet, SheetTitle } from "@/ui/Sheet";

export function RecordSheet({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const j = (k: string) => t(`job.${k}`) as string;
  const toast = useToast();
  const client = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await jobsApi.addNote(id, text.trim());
      void client.invalidateQueries({ queryKey: ["job-notes", id] });
      setText("");
      onClose();
      toast({ message: j("notes.saved") });
    } catch {
      toast({ message: j("failed") });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} label={j("primary.overview")} closeLabel={t("close")}>
      <SheetTitle>{j("primary.overview")}</SheetTitle>
      <Stack px={20} gap={14} pb={20}>
        <TextField label={j("notes.placeholder")} value={text} onChangeText={setText} multiline autoFocus />
        <Button label={j("notes.save")} block disabled={!text.trim()} busy={busy ? j("saving") : false} onPress={() => void save()} />
      </Stack>
    </Sheet>
  );
}
