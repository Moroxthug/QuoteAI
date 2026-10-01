// "twoStep" strings. Wording from TwoStep.dc.html / TwoStepFR.dc.html. Marked "not on the board":
// the board's code is texted, the server's is the authenticator app's (and an ended step has no state).
export const en = {
  title: "Two-step check",
  titleDone: "You’re in",
  subApp: "Enter the 6-digit code from your authenticator app.", // not on the board (it says "texted")
  subBackup: "Enter one of the backup codes you saved when you turned this on.",
  subDone: "Taking you to your home screen.",
  codeLabel: "6-digit code",
  backupLabel: "Backup code",
  backupPlaceholder: "xxxxx-xxxxx",
  checking: "Checking the code",
  wrong: { lead: "That code isn’t right.", tries_one: "{{count}} try left.", tries_other: "{{count}} tries left." },
  done: "That’s you",
  locked: { lead: "Too many tries.", text: "Wait 10 min, or use a backup code." },
  ended: { lead: "That sign-in ran out.", text: "Go back and sign in again.", link: "Back to sign in" }, // not on the board
  other: "Use another method",
  useBackup: "Use backup code",
  continue: "Continue",
  sheet: {
    title: "Another way in",
    close: "Close",
    app: { name: "Authenticator app", sub: "The 6-digit code from your app" }, // not on the board
    backup: { name: "Backup code", sub: "One of the codes you saved" },
  },
};
export const fr: typeof en = {
  title: "Vérification en deux étapes",
  titleDone: "Vous êtes connecté",
  subApp: "Entrez le code à 6 chiffres de votre application d’authentification.",
  subBackup: "Entrez un des codes de secours conservés lors de l’activation.",
  subDone: "Nous vous amenons à votre écran d’accueil.",
  codeLabel: "Code à 6 chiffres",
  backupLabel: "Code de secours",
  backupPlaceholder: "xxxxx-xxxxx",
  checking: "Vérification du code…",
  wrong: { lead: "Code incorrect.", tries_one: "Essais restants : {{count}}", tries_other: "Essais restants : {{count}}" },
  done: "Identité confirmée",
  locked: { lead: "Trop d’essais.", text: "Attendez 10 min ou utilisez un code de secours." },
  ended: { lead: "Cette connexion a expiré.", text: "Retournez vous connecter.", link: "Retour à la connexion" },
  other: "Utiliser une autre méthode",
  useBackup: "Utiliser le code de secours",
  continue: "Continuer",
  sheet: {
    title: "Autre méthode",
    close: "Fermer",
    app: { name: "Application d’authentification", sub: "Le code à 6 chiffres de votre application" },
    backup: { name: "Code de secours", sub: "Un des codes que vous avez conservés" },
  },
};
