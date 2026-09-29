/**
 * The Pocket parts kit: the canvas's own components (docs/POCKET-DESIGN-PLAN.md),
 * styled by src/pocket.css. Screens the canvas draws use them as drawn; screens it
 * doesn't draw are built from these parts only.
 */
import { Link } from "wouter";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { BackIcon, ChevronIcon, LinkChevron, MinusIcon, MoreIcon, PlusIcon, TileIcon, type MenuIcon } from "./icons";

/** A staggered entrance, as the canvas's `.rise` sections (60-70 ms apart). */
export const rise = (i: number): CSSProperties => ({ animationDelay: `${i * 70}ms` });

export function Section({ children, i = 0, className, style }: { children: ReactNode; i?: number; className?: string; style?: CSSProperties }) {
  return <section className={cn("pk-section pk-rise", className)} style={{ ...rise(i), ...style }}>{children}</section>;
}

export function SectionHead({ title, link, linkHref, id, children }: { title: string; link?: string; linkHref?: string; id?: string; children?: ReactNode }) {
  return (
    <div className="pk-sec-head">
      <h2 id={id}>{title}</h2>
      {children ?? (link && linkHref ? <Link href={linkHref} className="pk-sec-link">{link}<LinkChevron /></Link> : link ? <span className="pk-sec-link">{link}</span> : null)}
    </div>
  );
}

export const GroupLabel = ({ children, id }: { children: ReactNode; id?: string }) => <h2 className="pk-group-label" id={id}>{children}</h2>;

export function Card({ children, className, style, as = "div" }: { children: ReactNode; className?: string; style?: CSSProperties; as?: "div" | "section" }) {
  const Tag = as;
  return <Tag className={cn("pk-card", className)} style={style}>{children}</Tag>;
}

/** Back · centred mono title · ⋯ (Quote draft, Menu, Settings). */
export function BackHeader({ backHref, backLabel, title, onMore, moreLabel, right }: { backHref: string; backLabel: string; title?: string; onMore?: () => void; moreLabel?: string; right?: ReactNode }) {
  return (
    <header className="pk-header">
      <Link href={backHref} className="pk-icon-btn pk-press tb-back" aria-label={backLabel}><BackIcon /></Link>
      {title ? <span className="pk-header-title pk-mono">{title}</span> : <span />}
      {right ?? (onMore ? <button type="button" className="pk-icon-btn pk-press" aria-label={moreLabel} onClick={onMore}><MoreIcon /></button> : <span />)}
    </header>
  );
}

/** Menu row: 30 px icon tile, label, grey value (accent when something waits), chevron. */
export function MenuRow({ icon, label, value, accent, href, onClick, danger }: { icon: MenuIcon; label: string; value?: ReactNode; accent?: boolean; href?: string; onClick?: () => void; danger?: boolean }) {
  const inner = (
    <>
      <span className="pk-mrow-tile"><TileIcon name={icon} /></span>
      <span className="pk-mrow-label" style={danger ? { color: "var(--pk-danger)" } : undefined}>{label}</span>
      <span className={cn("pk-mrow-value", accent && "accent")}>{value}<ChevronIcon /></span>
    </>
  );
  return href ? <Link href={href} className="pk-mrow pk-row">{inner}</Link> : <button type="button" className="pk-mrow pk-row" onClick={onClick}>{inner}</button>;
}

/** Settings row: label with an optional hint, and its control on the right. */
export function SettingRow({ label, hint, children, href }: { label: string; hint?: string; children?: ReactNode; href?: string }) {
  const body = (
    <>
      <span className="pk-lbl"><b>{label}</b>{hint && <small>{hint}</small>}</span>
      {children}
    </>
  );
  return href ? <Link href={href} className="pk-srow">{body}</Link> : <div className="pk-srow">{body}</div>;
}

/** The 50 × 30 switch (knob with the canvas's overshoot). */
export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="pk-switch" disabled={disabled} onClick={() => { haptic("selection"); onChange(!on); }}>
      <span />
    </button>
  );
}

/** Segmented control with the sliding white thumb. `size`: the cell height (30 Settings, 28 Home, 50 Quote). */
export function Segmented<T extends string>({ options, value, onChange, label, width, size = 30, variant, renderOption }: {
  options: { value: NoInfer<T>; label: string; sub?: string; style?: CSSProperties }[];
  value: T;
  onChange: (v: NoInfer<T>) => void;
  label: string;
  width?: number | string;
  size?: number;
  variant?: "big" | "tint";
  renderOption?: (o: { value: T; label: string; sub?: string }) => ReactNode;
}) {
  const i = Math.max(0, options.findIndex((o) => o.value === value));
  const n = options.length;
  const inset = variant === "big" ? 6 : 4;
  return (
    <div role="group" aria-label={label} className={cn("pk-seg", variant)} style={{ width, gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
      <span className="pk-seg-thumb" aria-hidden="true" style={{ width: `calc((100% - ${inset}px) / ${n})`, height: size, transform: `translateX(${i * 100}%)` }} />
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} style={{ height: size, ...o.style }} onClick={() => { if (o.value !== value) { haptic("selection"); onChange(o.value); } }}>
          {renderOption ? renderOption(o) : o.label}
        </button>
      ))}
    </div>
  );
}

/** −/+ stepper with the value in mono between. */
export function Stepper({ value, onDec, onInc, decLabel, incLabel, minWidth = 58, fontSize = 12.5, canDec = true, canInc = true }: { value: ReactNode; onDec: () => void; onInc: () => void; decLabel: string; incLabel: string; minWidth?: number; fontSize?: number; canDec?: boolean; canInc?: boolean }) {
  return (
    <div className="pk-stepper">
      <button type="button" className="pk-press" aria-label={decLabel} onClick={onDec} disabled={!canDec}><MinusIcon /></button>
      <span className="pk-mono" style={{ minWidth, fontSize }} aria-live="polite">{value}</span>
      <button type="button" className="pk-press" aria-label={incLabel} onClick={onInc} disabled={!canInc}><PlusIcon /></button>
    </div>
  );
}

export function Avatar({ initials, image, size, fontSize, dark, style }: { initials: string; image?: ReactNode; size: number; fontSize: number; dark?: boolean; style?: CSSProperties }) {
  return <span className={cn("pk-avatar", dark && "dark")} style={{ width: size, height: size, fontSize, ...style }} aria-hidden="true">{image ?? initials}</span>;
}

export function Bar({ pct, width, height = 3, track, fill, grow }: { pct: number; width?: number; height?: number; track?: string; fill?: string; grow?: boolean }) {
  return (
    <span className="pk-bar" style={{ width, height, borderRadius: height, background: track }} aria-hidden="true">
      <span className={grow ? "pk-grow" : undefined} style={{ width: `${Math.max(0, Math.min(100, pct))}%`, borderRadius: height, background: fill }} />
    </span>
  );
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return ((parts[0]![0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]![0] ?? "" : parts[0]![1] ?? "")).toUpperCase();
}
