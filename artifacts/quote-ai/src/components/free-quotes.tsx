// Free quotes on the site: a quiet line for accounts that are not paid, and the dialog for HTTP 402 FREE_QUOTES_USED.
import { useLocation } from "wouter";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useLanguage } from "@/i18n/LanguageContext";
import { closeFreeQuotesUsed, useAllowance, useFreeQuotesUsedOpen } from "@/lib/free-quotes";
import { isNativeApp } from "@/lib/native/env";

/** Where plans are: the billing page on the site, the plan page in the app (no purchases there). */
export const PLANS_PATH = isNativeApp ? "/dashboard/settings/plan" : "/dashboard/billing";

export function FreeQuotesLine() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const s = useAllowance();
  if (s.kind === "none") return null;
  const text = (s.kind === "used" ? t("freeQuotes.line.used") : t("freeQuotes.line.left")).replace("{left}", String(s.left)).replace("{limit}", String(s.limit));
  return (
    <p className="sub" role="status" data-testid="free-quotes-line">
      {text}{" "}
      <a href={PLANS_PATH} onClick={(e) => { e.preventDefault(); setLocation(PLANS_PATH); }} style={{ fontWeight: 600, textDecoration: "underline" }}>{t("freeQuotes.plans")}</a>
    </p>
  );
}

export function FreeQuotesUsedDialog() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const open = useFreeQuotesUsedOpen();
  const s = useAllowance();
  const limit = s.kind === "none" ? null : s.limit;
  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) closeFreeQuotesUsed(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{limit != null ? t("freeQuotes.used.title").replace("{limit}", String(limit)) : t("freeQuotes.used.titleNoCount")}</AlertDialogTitle>
          <AlertDialogDescription>{t("freeQuotes.used.body")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("freeQuotes.notNow")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => setLocation(PLANS_PATH)}>{t("freeQuotes.plans")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
