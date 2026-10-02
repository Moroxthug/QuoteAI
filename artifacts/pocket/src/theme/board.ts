// Values Components.dc.html uses that tokens.json doesn't name. Kept here (src/theme) so
// src/ui stays free of typed colours; sync:design doesn't touch this file.
export const board = {
  /** SetCompany's brand colours for quotes and invoices (the swatches, in the board's order); what is saved is the hex. */
  brandColours: { violet: "#6A2FBF", harbour: "#1F4F86", forest: "#1F7A45", brick: "#B4462B", teal: "#1E7F80", charcoal: "#2B2B30" },
  /** The notification opt-in sheet's halo (.nt-stage::before: rgba(163,135,244,.32) → 0). */
  pushHalo: "#a387f4",
  /** The website widget preview (SetWidget): the form on a white or dark page, whatever the app's own theme. */
  widgetSurface: {
    light: { bg: "#ffffff", fg: "#141416", input: "#f3f2ef", inputFg: "#8a8a90", chip: "#f3f2ef", chipFg: "#3c3c43" },
    dark: { bg: "#1b1b1f", fg: "#f3f2ef", input: "#2a2a30", inputFg: "#9d9ca4", chip: "#2a2a30", chipFg: "#d0cfd5" },
  },
  /** VideoPlayer: the dark stage whatever the app's theme is (.vp-*). */
  player: { stage: "#0c0c0e", frame: "#141418", fg: "#f3f2ef", dim: "rgba(255,255,255,.62)", track: "rgba(255,255,255,.22)", border: "rgba(255,255,255,.35)", caption: "rgba(0,0,0,.72)", scrim: "rgba(12,12,14,.45)", card: "rgba(255,255,255,.94)", cardInk: "#141416", cardMuted: "#6e6e76", cardOk: "#1f7a45", wave: "#8b5cf6", cloud: "#92c8f3", glowA: "rgba(139,92,246,.42)", glowB: "rgba(56,189,160,.22)" },
  /** The WhatsApp preview bubble (.mt-bub.wa). */
  waBubble: "#1f7a45",
  /** The three assistant voices as AssistantPermissions draws them (.pm-orb: a dark ground and three glows). */
  voiceOrbs: {
    ember: { base: "#160e36", glow: ["#7b3fe4", "#6ec8f5", "#4c9de5"] },
    tide: { base: "#08172a", glow: ["#3d8bff", "#6ef0d2", "#b7a6ff"] },
    stone: { base: "#1a1a1c", glow: ["#c9c4ba", "#8e8a84", "#f4efe6"] },
  },
  /** Switch knob and the round tick's mark: white in both themes (.th .knob, .cp-box.rd.on). */
  white: "#ffffff",
  /** .cp-sw .knob */
  knobShadow: "0 2px 6px rgba(0,0,0,.2)",
  /** Input and textarea placeholders at night (.th[data-theme="dark"] input::placeholder); light uses `faint`. */
  placeholderDark: "#6f6e76",
  /** The warn status tint, both themes (.st-warn); tokens.json has no warn-soft. */
  warnSoft: "rgba(214,149,36,.14)",
  /** SVG mask values for the status shapes' cut-outs (white keeps, black cuts), not colours on screen. */
  maskKeep: "#fff",
  maskCut: "#000",
  /** The photo placeholder (.cp-photo: linear-gradient(145deg, #93B8F6, #4D72D9)). */
  photoFrom: "#93b8f6",
  photoTo: "#4d72d9",
  /** The live mic's halo (.cp-mic.live::before: rgba(139,92,246,.35) → 0). */
  micHalo: "#8b5cf6",
  /** FirstQuote's round mic (.fq mic: 0 8px 22px -8px rgba(106,47,191,.7)) and the done orb's green glow (#98d5b2 at .45 → 0). */
  fqMicShadow: "0 8px 22px -8px rgba(106,47,191,.7)",
  fqOrbGlow: "#98d5b2",
  /** The assistant orb's shadow (.ai-fab on the screen boards). */
  orbShadow: "0 12px 28px -8px rgba(106,47,191,.6), 0 0 0 1px var(--ring)",
  /** The Verify orb's halo (.vf-orb::before: rgba(147,184,246,.4) → 0). */
  orbGlow: "rgba(147,184,246,.4)",
  /** The join-code orb's halo (.jc-orb::before: rgba(243,215,155,.5) → 0). */
  joinHalo: "#f3d79b",
  /** The two-step orb halo (.ts-orb::before: rgba(163,135,244,.38) → 0) and the reset-password done orb halo (rgba(152,213,178,.45) → 0). */
  twoStepGlow: "rgba(163,135,244,.38)",
  resetOkGlow: "rgba(152,213,178,.45)",
  /** SmartHome: the AI quote bar (.aib): resting shadow, and open the violet ring and halo. */
  aibShadow: "0 0 0 1px var(--ring), 0 10px 26px -14px rgba(20,20,22,.25)",
  aibOpenShadow: "0 0 0 1px rgba(106,47,191,.26), 0 0 0 6px rgba(106,47,191,.06), 0 30px 60px -22px rgba(20,20,22,.34)",
  /** The client chip's avatar (.chip-av) and the build bar's logo gradient (.paper-bar span). */
  chipAvatar: "#3d1a86",
  logoFrom: "#6a2fbf",
  logoTo: "#4a8edb",
  /** The weather widget's rain bars and cloud (#3f86d0), and the 7-day strip's rain tint. */
  rain: "#3f86d0",
  /** A tick on a green round (.ny-tick / .p-check) is white in both themes. */
  checkWhite: "#ffffff",
} as const;
