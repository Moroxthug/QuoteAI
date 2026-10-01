// Values Welcome.dc.html uses that tokens.json doesn't name (the wordmark's gradient stops, the
// slide halos and sparks). Kept in src/theme so src/ui stays free of typed colours.
export const welcomeBoard = {
  /** The logo's mark gradient and lettering gradient (the board's #qmS and #qwS). */
  logo: { markFrom: "#6A2FBF", markTo: "#4A8EDB", wordFrom: "#6A3FC6", wordTo: "#4C9DE5" },
  /** .w-halo --h1 / --h2 per slide: a colour and its alpha (the circle fades to the same colour at 0). */
  halo: [
    { h1: ["#A387F4", 0.46], h2: ["#93B8F6", 0.46] },
    { h1: ["#8AD8D2", 0.46], h2: ["#A387F4", 0.36] },
    { h1: ["#98D5B2", 0.46], h2: ["#F3D79B", 0.46] },
  ] as { h1: [string, number]; h2: [string, number] }[],
  /** .w-spark fills per slide. */
  spark: { s1a: "#C0A6F6", s1b: "#93B8F6", s2: "#8AD8D2", s3: "#F3D79B" },
} as const;
