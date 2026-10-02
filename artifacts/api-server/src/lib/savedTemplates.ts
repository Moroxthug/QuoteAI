// Pocket 128.4: the wording the owner saved in Settings → Message templates (business_profiles.pocket_settings.templates, keys like "f1_en"). A saved text replaces the built-in one; the
// {slots} in it are filled here. No saved text (or an empty one) means the built-in wording is used, so nothing changes for a company that never opened the screen.

export type TemplateVars = Partial<Record<"first" | "link" | "job" | "amount" | "due" | "inv" | "me" | "co" | "eta" | "review" | "sign", string>>;

export function savedTemplate(pocketSettings: unknown, id: string, lang: "en" | "fr"): string | null {
  const page = (pocketSettings as { templates?: Record<string, unknown> } | null | undefined)?.templates;
  const v = page?.[`${id}_${lang}`];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Fills {slots}; one with no value is removed together with the space before it, so a missing link does not leave a hole. */
export function fillTemplate(text: string, vars: TemplateVars): string {
  return text.replace(/\s?\{(\w+)\}/g, (m, k: string) => {
    const v = (vars as Record<string, string | undefined>)[k];
    return v ? (m.startsWith(" ") ? ` ${v}` : v) : "";
  }).replace(/\s{2,}/g, " ").trim();
}
