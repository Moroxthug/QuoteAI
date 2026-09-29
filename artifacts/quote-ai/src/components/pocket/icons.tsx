/**
 * The canvas's own icons (docs/pocket-design/*.dc.html): inline stroke SVGs with the
 * exact paths, sizes and stroke widths drawn there. Pocket screens use these, not lucide.
 */
import type { CSSProperties } from "react";

type P = { size?: number; stroke?: number; style?: CSSProperties; className?: string; color?: string };

function Svg({ size = 20, stroke = 1.7, style, className, color = "currentColor", children, cap = "round" }: P & { children: React.ReactNode; cap?: "round" | "butt" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap={cap} strokeLinejoin="round" aria-hidden="true" focusable="false" style={style} className={className}>
      {children}
    </svg>
  );
}

/** Menu tiles: the path strings the canvas's Menu uses (17 px, 1.7). */
export const MENU_PATHS = {
  building: "M4 21V5l8-2v18M12 7l8 2v12M3 21h18M7.5 9h1M7.5 13h1M7.5 17h1M15.5 12h1M15.5 16h1",
  tag: "M3 12V4h8l10 10-8 8zM7.5 8h.01",
  file: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5",
  percent: "M19 5 5 19M7 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM17 19.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  users: "M9 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20a6 6 0 0 1 12 0M16 5.5a3.5 3.5 0 0 1 0 6.5M18 14.5a6 6 0 0 1 3 5.5",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  card: "M3 6h18v12H3zM3 10h18M7 15h3",
  sync: "M20 8a8 8 0 0 0-14.5-2M4 4v4h4M4 16a8 8 0 0 0 14.5 2M20 20v-4h-4",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5l1.6 1-1.8 3.2-1.8-.6a7 7 0 0 1-2.2 1.3L14.8 21h-3.6l-.4-2.6a7 7 0 0 1-2.2-1.3l-1.8.6-1.8-3.2 1.6-1a7 7 0 0 1 0-3l-1.6-1 1.8-3.2 1.8.6a7 7 0 0 1 2.2-1.3L11.2 3h3.6l.4 2.6a7 7 0 0 1 2.2 1.3l1.8-.6 1.8 3.2-1.6 1a7 7 0 0 1 0 3z",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0",
} as const;
export type MenuIcon = keyof typeof MENU_PATHS;

export const TileIcon = ({ name }: { name: MenuIcon }) => <Svg size={17} stroke={1.7}><path d={MENU_PATHS[name]} /></Svg>;

export const BackIcon = () => <Svg size={20} stroke={2}><path d="m15 5-7 7 7 7" /></Svg>;
export const ChevronIcon = ({ size = 14, className = "pk-chev" }: { size?: number; className?: string }) => <Svg size={size} stroke={2} color="#b0afab" className={className}><path d="m9 6 6 6-6 6" /></Svg>;
export const LinkChevron = () => <Svg size={14} stroke={2}><path d="m9 6 6 6-6 6" /></Svg>;
export const MoreIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><circle cx="5.5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="18.5" cy="12" r="1.6" /></svg>
);
export const MinusIcon = () => <Svg size={14} stroke={2.2}><path d="M5 12h14" /></Svg>;
export const PlusIcon = () => <Svg size={14} stroke={2.2}><path d="M5 12h14M12 5v14" /></Svg>;
export const CheckIcon = ({ size = 14, stroke = 2.6, color }: { size?: number; stroke?: number; color?: string }) => <Svg size={size} stroke={stroke} color={color}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>;

/* Tab bar (20 px; the current tab's stroke is 1.9, the others 1.7). */
export const TabHome = ({ on }: { on?: boolean }) => <Svg size={20} stroke={on ? 1.9 : 1.7}><path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z" /></Svg>;
export const TabQuotes = ({ on }: { on?: boolean }) => <Svg size={20} stroke={on ? 1.9 : 1.7}><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h5" /></Svg>;
export const TabJobs = ({ on }: { on?: boolean }) => <Svg size={20} stroke={on ? 1.9 : 1.7}><path d="M4 16a8 8 0 0 1 16 0" /><path d="M3 16h18v3H3zM10 8.5V5h4v3.5" /></Svg>;
export const TabClients = ({ on }: { on?: boolean }) => <Svg size={20} stroke={on ? 1.9 : 1.7}><circle cx="9" cy="8.5" r="3.5" /><path d="M3 20a6 6 0 0 1 12 0M16 5.5a3.5 3.5 0 0 1 0 6.5M18 14.5a6 6 0 0 1 3 5.5" /></Svg>;

/* Home composer and assistant. */
export const MicIcon = ({ size = 18, stroke = 1.9 }: { size?: number; stroke?: number }) => <Svg size={size} stroke={stroke}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></Svg>;
export const MicOffIcon = () => <Svg size={26} stroke={1.9}><path d="M15 9.5V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.6 2.5M5.5 11a6.5 6.5 0 0 0 10.4 5.2M18.5 11a6.4 6.4 0 0 1-.6 2.7M12 17.5V21M4 4l16 16" /></Svg>;
export const ArrowUpIcon = ({ size = 19, stroke = 2.2 }: { size?: number; stroke?: number }) => <Svg size={size} stroke={stroke}><path d="M12 19V5M6 11l6-6 6 6" /></Svg>;
export const PhotoIcon = () => <Svg size={15} stroke={1.8}><rect x="3.5" y="5" width="17" height="14" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="m20 16-5-5-8 8" /></Svg>;
export const KeyboardIcon = () => <Svg size={22} stroke={1.7}><rect x="2.5" y="6" width="19" height="12" rx="3" /><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M8 14h8" /></Svg>;
export const CloseIcon = ({ size = 20 }: { size?: number }) => <Svg size={size} stroke={2}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const WaveIcon = () => <Svg size={20} stroke={1.9}><path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" /></Svg>;

/* Weather (the header's 14 px, 1.8 stroke). The canvas draws rain; the others use the same cloud. */
const CLOUD = "M7 16a4.5 4.5 0 1 1 1-8.9A6 6 0 0 1 19 8.5 3.8 3.8 0 0 1 17.5 16z";
export function WeatherIcon({ kind }: { kind: "clear" | "cloud" | "rain" | "snow" | "storm" | "fog" }) {
  const s = { size: 14, stroke: 1.8 };
  if (kind === "clear") return <Svg {...s}><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></Svg>;
  if (kind === "rain") return <Svg {...s}><path d={CLOUD} /><path d="M9 19.5l-.8 1.5M13 19.5l-.8 1.5M17 19.5l-.8 1.5" /></Svg>;
  if (kind === "snow") return <Svg {...s}><path d={CLOUD} /><path d="M9 20h.01M13 20h.01M17 20h.01" /></Svg>;
  if (kind === "storm") return <Svg {...s}><path d={CLOUD} /><path d="m13 17-2 3h3l-2 3" /></Svg>;
  if (kind === "fog") return <Svg {...s}><path d={CLOUD} /><path d="M6 20h12" /></Svg>;
  return <Svg {...s}><path d={CLOUD} /></Svg>;
}
