// Values Components.dc.html uses that tokens.json doesn't name. Kept here (src/theme) so
// src/ui stays free of typed colours; sync:design doesn't touch this file.
export const board = {
  /** Switch knob and the round tick's mark: white in both themes (.th .knob, .cp-box.rd.on). */
  white: "#ffffff",
  /** .cp-sw .knob */
  knobShadow: "0 2px 6px rgba(0,0,0,.2)",
} as const;
