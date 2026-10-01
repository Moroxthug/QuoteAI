// Values Components.dc.html uses that tokens.json doesn't name. Kept here (src/theme) so
// src/ui stays free of typed colours; sync:design doesn't touch this file.
export const board = {
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
} as const;
