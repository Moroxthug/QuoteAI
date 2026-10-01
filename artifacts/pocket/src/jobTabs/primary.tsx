// The Job screen's one primary action changes with the tab ("Record progress", "Scan a receipt"...). A tab says what it is with
// `usePrimary`; the screen draws it in the action bar. `run` can change on every render, so it is kept in a ref.
import { createContext, useContext, useEffect, useRef } from "react";

export type Primary = { label: string; run: () => void; busy?: boolean; done?: boolean; disabled?: boolean };
type Set = (p: Primary | null) => void;

export const PrimaryContext = createContext<Set>(() => undefined);

export function usePrimary(p: Primary): void {
  const set = useContext(PrimaryContext);
  const run = useRef(p.run);
  run.current = p.run;
  useEffect(() => {
    set({ label: p.label, run: () => run.current(), busy: p.busy, done: p.done, disabled: p.disabled });
    return () => set(null);
  }, [p.label, p.busy, p.done, p.disabled, set]);
}
