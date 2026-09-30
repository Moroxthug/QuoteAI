// Copied from docs/pocket-design/handoff/tokens/tokens.ts, which is the source: re-copy it when the handoff changes; never edit values here.
// quoteAI Pocket design tokens (generated). Use with React Native / Expo or any TS front end.
// Colours are strings usable in RN styles; rgba() values included as-is.

export const tokens = {
  color: {
    light: {
      ground: "#f5f4f1",
      card: "#ffffff",
      sunk: "#efeeea",
      soft: "#f7f6f3",
      ink: "#141416",
      inv: "#141416",
      "on-inv": "#ffffff",
      t2: "#3c3c43",
      muted: "#6e6e76",
      faint: "#8a8a90",
      line: "#efeeea",
      line2: "#e2e1dc",
      ring: "rgba(20,20,22,.05)",
      acc: "#6a2fbf",
      "acc-t": "#5e2ab0",
      "acc-soft": "#efe9ff",
      "acc-soft-t": "#3d1a86",
      ok: "#1f7a45",
      "ok-dot": "#1f9d55",
      "ok-soft": "#e8f3ee",
      warn: "#9a6412",
      "warn-dot": "#d69524",
      bad: "#c2371f",
      "bad-soft": "#fbf1ee",
      "info-soft": "#e7f0fa",
      info: "#1f4f86",
      av: "#f1ede4",
      glass: "rgba(255,255,255,.84)",
      "track-off": "#dddcd8",
      shadow: "rgba(20,20,22,.22)",
      scrim: "rgba(20,20,22,.2)"
    },
    dark: {
      ground: "#0c0c0e",
      card: "#18181b",
      sunk: "#26262b",
      soft: "#1f1f23",
      ink: "#f3f2ef",
      inv: "#f3f2ef",
      "on-inv": "#141416",
      t2: "#d0cfd5",
      muted: "#a09fa7",
      faint: "#7c7b83",
      line: "rgba(255,255,255,.07)",
      line2: "rgba(255,255,255,.12)",
      ring: "rgba(255,255,255,.07)",
      acc: "#8b5cf6",
      "acc-t": "#bda6ff",
      "acc-soft": "rgba(139,92,246,.2)",
      "acc-soft-t": "#d8caff",
      ok: "#62d498",
      "ok-dot": "#34c375",
      "ok-soft": "rgba(52,195,117,.16)",
      warn: "#f2b660",
      "warn-dot": "#e9a53a",
      bad: "#ff7d68",
      "bad-soft": "rgba(255,125,104,.13)",
      "info-soft": "rgba(63,134,208,.2)",
      info: "#9cc8f6",
      av: "#2d2a26",
      glass: "rgba(28,28,32,.8)",
      "track-off": "#3b3b41",
      shadow: "rgba(0,0,0,.6)",
      scrim: "rgba(0,0,0,.45)"
    },
    roles: {
      ground: "Screen background",
      card: "Cards, sheets, inputs",
      sunk: "Wells: chips, search, secondary buttons, segmented track",
      soft: "Row hover / pressed",
      ink: "Primary text and icons",
      inv: "Primary button fill (inverts in dark)",
      "on-inv": "Text on primary button",
      t2: "Secondary text (body copy inside cards)",
      muted: "Meta text, labels",
      faint: "Placeholders, hints (decorative only, below 4.5:1)",
      line: "Hairline dividers",
      line2: "Stronger borders: inputs, grab handle",
      ring: "1px outline around cards",
      acc: "Brand violet: focus, links, accent buttons",
      "acc-t": "Violet text on ground",
      "acc-soft": "Violet tint background",
      "acc-soft-t": "Text on violet tint",
      ok: "Success text",
      "ok-dot": "Success dot",
      "ok-soft": "Success tint",
      warn: "Warning text",
      "warn-dot": "Warning dot",
      bad: "Error / overdue text",
      "bad-soft": "Error tint",
      info: "Info text",
      "info-soft": "Info tint",
      av: "Avatar background",
      glass: "Floating tab bar / FAB glass",
      "track-off": "Switch track off",
      shadow: "Float shadow colour",
      scrim: "Sheet scrim"
    }
  },
  ground: {
    default: "dusk",
    note: "Light theme only. Each ground overrides the listed tokens; night mode ignores grounds. Fades are fixed to the screen, not the content.",
    options: {
      stone: {
        ground: "#f5f4f1",
        sunk: "#efeeea",
        soft: "#f7f6f3",
        line: "#efeeea",
        line2: "#e2e1dc",
        av: "#f1ede4"
      },
      linen: {
        ground: "#f7f3ec",
        sunk: "#efe9df",
        soft: "#faf7f2",
        line: "#efe9df",
        line2: "#e4ddd1",
        av: "#efe7da"
      },
      mist: {
        ground: "#f1f4f0",
        sunk: "#e6ebe4",
        soft: "#f6f8f5",
        line: "#e7ece5",
        line2: "#d9e0d6",
        av: "#e6ece3"
      },
      porcelain: {
        ground: "#f3f5f8",
        sunk: "#e9edf2",
        soft: "#f7f9fb",
        line: "#e9edf2",
        line2: "#dde2e9",
        av: "#e8ecf2"
      },
      lilac: {
        ground: "#f5f3f9",
        sunk: "#ece8f3",
        soft: "#f9f8fc",
        line: "#ece8f3",
        line2: "#e0dbea",
        av: "#ebe6f3"
      },
      oat: {
        ground: "#f4f1ea",
        sunk: "#ebe6dc",
        soft: "#f9f7f2",
        line: "#ebe6dc",
        line2: "#dfd8cb",
        av: "#ece5d8"
      },
      sage: {
        ground: "#eef2ec",
        sunk: "#e2e8df",
        soft: "#f5f7f3",
        line: "#e3e9e0",
        line2: "#d3dccf",
        av: "#e1e9dd"
      },
      sky: {
        ground: "#eff4f8",
        sunk: "#e3eaf1",
        soft: "#f6f9fb",
        line: "#e4ebf2",
        line2: "#d6dfe8",
        av: "#e2eaf2"
      },
      shell: {
        ground: "#f7f2f0",
        sunk: "#eee6e3",
        soft: "#fbf8f6",
        line: "#eee7e4",
        line2: "#e3d9d5",
        av: "#efe5e1"
      },
      paper: {
        ground: "#f8f8f6",
        sunk: "#efefec",
        soft: "#fbfbfa",
        line: "#efefec",
        line2: "#e4e4e0",
        av: "#eeeeea"
      },
      fog: {
        ground: "#f0f1f2",
        sunk: "#e5e7e9",
        soft: "#f6f7f8",
        line: "#e6e8ea",
        line2: "#d9dcdf",
        av: "#e5e8eb"
      },
      lavender: {
        ground: "#f4f2fa",
        sunk: "#eae6f4",
        soft: "#f9f8fd",
        line: "#eae6f3",
        line2: "#ddd7ec",
        av: "#ece7f6"
      },
      dawn: {
        muted: "#66666e",
        ground: "#f2f2f8",
        sunk: "#e8e7f2",
        soft: "#f7f7fb",
        line: "#e8e7f1",
        line2: "#dcdbe9",
        av: "#e9e6f4",
        image: "linear-gradient(180deg,#eee8fa 0,#f1eef9 200px,#f3f5f8 480px)"
      },
      dusk: {
        muted: "#66666e",
        ground: "#f2f2f8",
        sunk: "#e8e7f2",
        soft: "#f7f7fb",
        line: "#e8e7f1",
        line2: "#dcdbe9",
        av: "#e9e6f4",
        image: "linear-gradient(0deg,#ece6f8 0,#f0edf9 220px,#f3f5f8 560px)"
      },
      veil: {
        muted: "#66666e",
        ground: "#f2f2f8",
        sunk: "#e8e7f2",
        soft: "#f7f7fb",
        line: "#e8e7f1",
        line2: "#dcdbe9",
        av: "#e9e6f4",
        image: "linear-gradient(160deg,#f3f5f8 0%,#f2f1f9 55%,#eee9f8 100%)"
      },
      iris: {
        muted: "#66666e",
        ground: "#f4f4f8",
        sunk: "#e9e8f2",
        soft: "#f8f8fb",
        line: "#e9e8f1",
        line2: "#dddbe9",
        av: "#ebe7f5",
        image: "linear-gradient(180deg,rgba(106,47,191,.085) 0,rgba(106,47,191,.03) 220px,rgba(106,47,191,0) 420px)"
      }
    },
    homeScrollerImage: {
      dawn: "linear-gradient(180deg,#eee8fa 0,#f1eef9 200px,#f3f5f8 480px)",
      dusk: "linear-gradient(0deg,#ece6f8 0,#f0edf9 220px,#f3f5f8 560px)",
      veil: "linear-gradient(160deg,#f3f5f8 0%,#f2f1f9 55%,#eee9f8 100%)",
      iris: "linear-gradient(180deg,rgba(106,47,191,.085) 0,rgba(106,47,191,.03) 220px,rgba(106,47,191,0) 420px)"
    }
  },
  font: {
    text: {
      family: "Geist",
      weights: [400, 500, 600],
      fallback: "-apple-system, \"SF Pro Text\", \"Segoe UI\", sans-serif",
      letterSpacing: "-0.01em"
    },
    numbers: {
      family: "Manrope",
      weights: [500, 600, 700],
      features: "tnum (tabular figures) on standalone figures",
      rule: "Every digit and the characters $ % + − ° render in Manrope, everywhere, including inside sentences, chips, buttons and inputs. Words stay Geist."
    },
    license: "Both SIL Open Font License 1.1 (Google Fonts). Bundle the font files in the app."
  },
  type: {
    scale: [10.5, 11.5, 12.5, 13.5, 14.5, 15, 16, 17, 19, 21, 24, 28, 30, 32],
    weights: [400, 500, 600],
    roles: {
      pageTitle: {
        size: 30,
        weight: 600,
        letterSpacing: "-0.045em",
        lineHeight: 1.1,
        use: "Tab screen title (Quotes, Jobs, Clients)"
      },
      detailTitle: {
        size: [21, 24],
        weight: 600,
        letterSpacing: "-0.03em",
        use: "Detail screen title"
      },
      groupTitle: {
        size: 17,
        weight: 600,
        letterSpacing: "-0.025em"
      },
      sectionHeader: {
        size: 15,
        weight: 600,
        letterSpacing: "-0.02em",
        use: "Section header left; link on the right 13.5 muted"
      },
      navTitle: {
        size: 15,
        weight: 600,
        use: "Centered title in the back header"
      },
      body: {
        size: 15,
        weight: 400,
        lineHeight: 1.45
      },
      rowTitle: {
        size: 14.5,
        weight: 500
      },
      meta: {
        size: 12.5,
        weight: 400,
        color: "muted"
      },
      caption: {
        size: 11.5,
        weight: 400,
        color: "muted"
      },
      status: {
        size: 11.5,
        weight: 600
      },
      kpiValue: {
        size: 19,
        weight: 600,
        letterSpacing: "-0.03em",
        font: "numbers"
      },
      heroFigure: {
        size: [32, 44],
        weight: 600,
        letterSpacing: "-0.04em",
        font: "numbers"
      }
    }
  },
  radius: {
    card: 22,
    sheet: 28,
    tile: 18,
    banner: 16,
    buttonLg: 17,
    button: 15,
    search: 14,
    buttonMd: 13,
    field: 13,
    buttonSm: 11,
    segment: 11,
    segmentThumb: 9,
    chip: 999,
    avatar: 999,
    bar: 4
  },
  size: {
    buttonSm: 36,
    buttonMd: 44,
    button: 50,
    buttonLg: 54,
    fabBar: 56,
    chip: 34,
    search: 44,
    field: 46,
    segment: 36,
    tab: 44,
    header: 52,
    iconButton: 44,
    avatar: 38,
    rowMin: 44,
    formRow: 62,
    minTouch: 44,
    tabBar: 62,
    progressBar: 4,
    icon: {
      list: 28,
      quickAction: 30,
      tabBar: 25,
      range: [22, 44]
    },
    statusPill: 24
  },
  space: {
    gutter: 16,
    cardPadding: 16,
    rowPaddingY: 12,
    rowPaddingX: 16,
    sectionGap: [18, 24],
    chipGap: 6,
    tileGap: 8,
    listItemGap: 12,
    tabGap: 22,
    fabBarInset: {
      side: 16,
      bottom: 26
    }
  },
  shadow: {
    ring: "0 0 0 1px var(--ring)",
    float: "0 10px 30px -8px var(--shadow)",
    sheet: "0 -20px 60px -20px var(--shadow)",
    thumb: "0 1px 3px rgba(0,0,0,.14)",
    tileSelected: "0 0 0 2px var(--ink), 0 12px 24px -16px var(--shadow)",
    expandOpen: "deep soft shadow on the open card, see motion.expandPop"
  },
  motion: {
    easing: {
      out: "cubic-bezier(.16,1,.3,1)",
      spring: "cubic-bezier(.34,1.4,.64,1)",
      expand: "cubic-bezier(.32,.72,0,1)",
      pop: "cubic-bezier(.22,1,.36,1)",
      tick: "cubic-bezier(.34,1.5,.64,1)"
    },
    press: {
      scale: 0.96,
      duration: 200,
      easing: "out"
    },
    rise: {
      from: {
        opacity: 0,
        translateY: 10
      },
      duration: 800,
      easing: "out",
      stagger: [40, 80],
      use: "Sections entering a screen"
    },
    segmentThumb: {
      duration: 450,
      easing: "out"
    },
    switchKnob: {
      duration: 400,
      easing: "spring"
    },
    expand: {
      height: {
        duration: 450,
        easing: "expand"
      },
      content: {
        translateY: -6,
        fadeDelay: 120,
        duration: 450
      },
      chevron: "rotates 180°, gets a sunk circle when open"
    },
    expandPop: {
      scale: [0.985, 1.022, 1],
      translateY: -2,
      duration: 620,
      easing: "pop",
      rows: {
        translateY: 10,
        scaleFrom: 0.97,
        stagger: 40
      },
      listDetach: {
        margin: -8,
        radius: 22,
        othersOpacity: 0.45
      }
    },
    progressGrow: {
      duration: 1200,
      delay: 200,
      easing: "out"
    },
    sheetUp: {
      from: "translateY(100%)",
      easing: "out"
    },
    assistantOrb: {
      swirl: "18s linear rotate",
      halo: "3.2s ease-in-out breathing"
    },
    reducedMotion: "All animation and transitions off when the OS asks for reduced motion."
  },
  status: {
    anatomy: "Word + colour + shape. 24px pill, radius 999, 11.5/600 text, 14px shape icon on the left. Plain variant: no background, 18px tall.",
    tones: {
      ok: "done, paid, signed, active",
      warn: "waiting on time, due soon, partial",
      bad: "overdue, failed, blocked",
      acc: "viewed / needs your review",
      info: "sent, scheduled, planning",
      mute: "draft, archived, expired"
    },
    shapes: {
      draft: "dashed ring: not started",
      q1: "quarter pie: sent / first step",
      q2: "half pie: viewed / in review",
      q3: "three-quarter pie: partly paid / nearly done",
      check: "filled check: done, paid, accepted",
      live: "pulsing dot: happening now",
      clock: "clock: waiting on a date",
      pause: "pause: on hold",
      alert: "exclamation: overdue, needs action",
      x: "cross: declined, failed",
      off: "slashed ring: expired, cancelled",
      dot: "plain dot: neutral"
    }
  },
  layout: {
    phone: {
      width: 390,
      height: 844
    },
    tablet: {
      width: 1366,
      height: 1024
    },
    maxContentWidth: 358,
    tabBar: "Floating glass bar, 62 tall, radius 31, 16 from the sides, 26 from the bottom, 4 tabs (Home, Quotes, Jobs, Clients) + assistant orb on the right"
  }
} as const;

export type ThemeName = "light" | "dark";
export type GroundName = keyof typeof tokens.ground.options;
