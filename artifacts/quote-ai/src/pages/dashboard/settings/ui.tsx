import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

// ── Phase 102: the settings vocabulary ───────────────────────────────────────
// Every section is a SettingsSection (heading + one sentence on what it
// controls) made of SettingsGroup cards of SettingsRow (label and help on
// the left, the field on the right; stacked on a phone) and ToggleRow (the
// whole row is the switch). Fields never save themselves:
// a section keeps one draft (useSettingsDraft) and the page shows one
// "Unsaved changes — Discard / Save" bar while it differs from what is saved.

/** Below this the settings list is its own screen and a section opens as a page. */
const SETTINGS_SINGLE_PANE = "(max-width: 859.98px)";

/**
 * True under 860 px. Read synchronously on the first render (unlike
 * useMediaQuery, which starts false): the bare /dashboard/settings redirects
 * to a section on a wide screen, and a phone must never take that redirect.
 */
export function useSinglePane(): boolean {
  const [single, setSingle] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(SETTINGS_SINGLE_PANE).matches);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(SETTINGS_SINGLE_PANE);
    setSingle(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setSingle(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return single;
}

type DraftRegistration = {
  dirty: boolean;
  valid: boolean;
  saving: boolean;
  save: () => Promise<boolean>;
  discard: () => void;
};

type DraftCtx = { register: (r: DraftRegistration | null) => void };
const DraftContext = createContext<DraftCtx | null>(null);

/** The page's end: which section (if any) has unsaved edits, and how to save or drop them. */
export function useDraftHost() {
  const [reg, setReg] = useState<DraftRegistration | null>(null);
  const ctx = useMemo<DraftCtx>(() => ({ register: setReg }), []);
  return { reg, DraftProvider: DraftContext.Provider, ctx };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * One section's editable values. `source` is what the server has (undefined
 * while loading); edits live in `draft` until the save bar saves them with
 * `save(draft)`. When the server's values change underneath (another tab, a
 * refetch) an untouched draft follows them; an edited one is left alone.
 */
export function useSettingsDraft<T>(
  source: T | undefined,
  save: (draft: T, saved: T) => Promise<void>,
  validate?: (draft: T) => boolean,
) {
  const ctx = useContext(DraftContext);
  const [saved, setSaved] = useState<T | undefined>(source);
  const [draft, setDraft] = useState<T | undefined>(source);
  const [saving, setSaving] = useState(false);
  const sourceKey = source === undefined ? null : JSON.stringify(source);
  const savedRef = useRef(saved);
  savedRef.current = saved;

  useEffect(() => {
    if (source === undefined) return;
    setDraft((d) => (d === undefined || same(d, savedRef.current) ? source : d));
    setSaved(source);
    // sourceKey stands in for source: a fresh object with the same values is not a change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey]);

  const dirty = draft !== undefined && saved !== undefined && !same(draft, saved);
  const valid = draft === undefined || !validate || validate(draft);

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setDraft((d) => (d === undefined ? d : { ...d, [key]: value }));
  }, []);

  const draftRef = useRef(draft);
  draftRef.current = draft;
  // Sections pass a fresh closure every render; the ref keeps doSave (and so the registration) stable.
  const saveRef = useRef(save);
  saveRef.current = save;
  const doSave = useCallback(async () => {
    const d = draftRef.current;
    const s = savedRef.current;
    if (d === undefined || s === undefined) return true;
    setSaving(true);
    try {
      await saveRef.current(d, s);
      setSaved(d);
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }, []);
  const discard = useCallback(() => setDraft(savedRef.current), []);

  const register = ctx?.register;
  useEffect(() => {
    register?.({ dirty, valid, saving, save: doSave, discard });
  }, [register, dirty, valid, saving, doSave, discard]);
  useEffect(() => () => register?.(null), [register]);

  return { draft, set, setDraft, dirty, saving };
}

/** The sticky bar that appears only while the open section has unsaved edits. */
export function SaveBar({ reg }: { reg: DraftRegistration | null }) {
  const { t } = useLanguage();
  if (!reg?.dirty) return null;
  return (
    <>
      <div className="savebar-spacer" aria-hidden="true" />
      <div className="savebar" role="region" aria-label={t("settings.save.unsaved")}>
        <span className="savebar-msg">
          <span className="savebar-dot" aria-hidden="true" />
          {reg.valid ? t("settings.save.unsaved") : t("settings.save.fixErrors")}
        </span>
        <button type="button" className="btn btn-sm secondary" onClick={reg.discard} disabled={reg.saving}>
          {t("settings.save.discard")}
        </button>
        <button type="button" className="btn btn-sm btn-navy" data-primary-action onClick={() => void reg.save()} disabled={reg.saving || !reg.valid}>
          {reg.saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {t("settings.save.save")}
        </button>
      </div>
    </>
  );
}

/** A section: its name and one sentence on what it controls, then its groups. */
export function SettingsSection({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  const single = useSinglePane();
  const Heading = single ? "h1" : "h2";
  return (
    <section className="sset" aria-labelledby="settings-section-title">
      <header className="sset-head">
        <Heading id="settings-section-title">{title}</Heading>
        <p>{intro}</p>
      </header>
      <div className="sset-body">{children}</div>
    </section>
  );
}

/** One card of rows, optionally titled. `danger` marks the account-deletion zone. */
export function SettingsGroup({ title, desc, children, danger, action }: { title?: string; desc?: ReactNode; children: ReactNode; danger?: boolean; action?: ReactNode }) {
  // One level under the section heading: h3 under the wide screen's h2, h2 under a phone section's h1.
  const Heading = useSinglePane() ? "h2" : "h3";
  return (
    <div className={cn("card sgroup", danger && "sgroup-danger")}>
      {(title || action) && (
        <div className="sgroup-head">
          <div>
            {title && <Heading>{title}</Heading>}
            {desc && <p>{desc}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/** Label and help on the left, the field on the right (stacked under 640 px). */
export function SettingsRow({ label, help, htmlFor, error, children }: { label: string; help?: ReactNode; htmlFor?: string; error?: string | null; children: ReactNode }) {
  const helpId = useId();
  return (
    <div className="srow">
      <div className="srow-txt">
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span className="srow-label">{label}</span>}
        {help && <p id={helpId}>{help}</p>}
      </div>
      <div className="srow-field field">
        {children}
        {error && <p className="field-err" role="alert">{error}</p>}
      </div>
    </div>
  );
}

/** A full-row switch: tapping anywhere on the row flips it. */
export function ToggleRow({ label, help, checked, onChange, disabled }: { label: string; help?: ReactNode; checked: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  const labelId = useId();
  const helpId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={help ? helpId : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="srow srow-toggle"
    >
      <span className="srow-txt">
        <span id={labelId} className="srow-label">{label}</span>
        {help && <span id={helpId} className="srow-help">{help}</span>}
      </span>
      <span className={cn("tgl", checked && "on")} aria-hidden="true" />
    </button>
  );
}

/** Rows that are not form fields: a line of text and an action button on the right. */
export function ActionRow({ label, help, children }: { label: string; help?: ReactNode; children?: ReactNode }) {
  return (
    <div className="srow srow-action">
      <div className="srow-txt">
        <span className="srow-label">{label}</span>
        {help && <p>{help}</p>}
      </div>
      {children && <div className="srow-act">{children}</div>}
    </div>
  );
}
