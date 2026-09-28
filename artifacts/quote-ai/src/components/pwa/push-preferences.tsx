import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { pushApi, type PushCategory, type PushPreferencesDto } from "@/lib/push-api";

/**
 * Phase 119: what reaches this person's phone and browsers, by kind. One
 * choice per person and company, on every device they use; the bell keeps
 * everything either way.
 */
export function PushPreferences() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["push-preferences"], queryFn: pushApi.preferences, staleTime: 60_000 });
  const save = useMutation({
    mutationFn: (muted: PushCategory[]) => pushApi.setPreferences(muted),
    onMutate: (muted) => {
      const prev = queryClient.getQueryData<PushPreferencesDto>(["push-preferences"]);
      if (prev) queryClient.setQueryData(["push-preferences"], { ...prev, muted });
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["push-preferences"], ctx.prev);
      toast({ title: t("push.errorToast"), description: e.message, variant: "destructive" });
    },
    onSuccess: (r) => queryClient.setQueryData(["push-preferences"], r),
  });
  if (!data) return null;
  const muted = new Set(data.muted);
  const flip = (c: PushCategory) => {
    const next = new Set(muted);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    save.mutate(data.categories.filter((x) => next.has(x)));
  };
  return (
    <fieldset className="mt-3 border-t pt-3" style={{ borderColor: "var(--line)" }}>
      <legend className="text-xs font-bold" style={{ color: "var(--navy)" }}>{t("native.push.prefsTitle")}</legend>
      <ul className="mt-1">
        {data.categories.map((c) => (
          <li key={c}>
            <label className="flex items-center gap-3 min-h-[44px] text-sm cursor-pointer">
              <input type="checkbox" className="h-5 w-5 shrink-0" checked={!muted.has(c)} onChange={() => flip(c)} />
              <span>{t(`native.push.cat.${c}`)}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="text-xs" style={{ color: "var(--faint)" }}>{t("native.push.prefsHint")}</p>
    </fieldset>
  );
}
