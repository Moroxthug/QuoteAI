// The wordmark's gradient stops, which tokens.json doesn't name. Kept in src/theme so src/ui stays free of typed colours.
export const welcomeBoard = {
  /** The logo's mark gradient and lettering gradient (the board's #qmS and #qwS). */
  logo: { markFrom: "#6A2FBF", markTo: "#4A8EDB", wordFrom: "#6A3FC6", wordTo: "#4C9DE5" },
} as const;
