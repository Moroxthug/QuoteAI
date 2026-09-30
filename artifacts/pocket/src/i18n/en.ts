// English (en-CA). Keys are grouped by screen; French mirrors every key in fr.ts.
export const en = {
  sandbox: {
    title: "Components",
    intro: "Every piece the app is built from, with its states. Tap the controls to try them.",
    appearance: { light: "Light", dark: "Dark", auto: "Auto" },
    foundations: "Foundations",
    typeScale: "Type scale",
    icons: "Icons",
    grounds: "Backgrounds",
    digits: "Sent 6 days ago · $4,131.05 · 13% · 14:30",
  },
  board: {
    buttons: {
      title: "Buttons",
      default: "Default",
      pressed: "Pressed",
      disabled: "Disabled",
      loading: "Loading",
      primary: {
        name: "Primary",
        label: "Send quote",
        busy: "Sending"
      },
      secondary: {
        name: "Secondary",
        label: "Preview",
        busy: "Loading"
      },
      destructive: {
        name: "Destructive",
        label: "Delete draft",
        busy: "Deleting"
      },
      accent: {
        name: "Accent",
        label: "Ask quoteAI",
        busy: "Thinking"
      },
      link: {
        name: "Link",
        label: "Forgot password?",
        busy: "Opening"
      },
      sizes: "Sizes: small 36, medium 44, default 50, large 54",
      small: "Small",
      medium: "Medium",
      defaultSize: "Default",
      large: "Large, full width",
      smallGroup: "Small",
      send: "Send",
      edit: "Edit",
      remove: "Remove",
      reload: "Reload",
      newQuote: "New quote",
      fab: "Floating action bar",
      more: "More actions"
    },
  },
  dev: {
    session: "Signed in: {{company}}",
    noSession: "Not signed in",
  },
};

export type Dict = typeof en;
