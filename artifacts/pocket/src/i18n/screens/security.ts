// SetSecurity (SetSecurity.dc.html and SetSecurityFR). French follows the board; the rest is my own wording, to review.
export const en = {
  back: "Back", title: "Sign-in and security", lede: "{{name}} · {{email}}",
  readOnly: { lead: "View only.", body: "Your role can see these settings but not change them. Ask the owner." },
  closing: { lead: "Account closes on {{date}}.", body: "Your team can still work until then. Nothing is erased before that date." },
  twoOff: { lead: "Two-step verification is off.", body: "Anyone with your password could see client and payment details.", link: "Turn it on" },
  loadFailed: { title: "Couldn’t load your security settings", body: "Check your connection and try again.", retry: "Try again" },
  sign: {
    title: "Sign in",
    password: { label: "Password", sub: "A link comes by email", value: "Change" },
    face: { label: "Face ID", sub: "Sign in and unlock after 5 minutes away", soon: "Face ID isn’t in this build yet." },
    two: { label: "Two-step verification", on: "A code from your authenticator app", off: "Off. A code on top of your password", onWord: "On", offWord: "Off" },
    backup: { label: "Backup codes", sub: "For when you lose your phone" },
    setup: { label: "Set up two-step", sub: "Takes about a minute" },
  },
  devices: {
    title: "Where you’re signed in", on: "{{browser}} on {{system}}", here: "This phone", hereSub: "Signed in now", active: "Active now", signOut: "Sign out", unknown: "Another device",
    foot: "Don’t recognise one? Sign it out and change your password.", footOut: "Signed out of {{what}}.", all: "Sign out everywhere else", only: "Only this phone is signed in", everyone: "every other device",
    when: { now: "just now", min_one: "{{count}} minute ago", min_other: "{{count}} minutes ago", hour_one: "{{count}} hour ago", hour_other: "{{count}} hours ago" },
  },
  activity: { title: "Recent activity", login: "New sign-in", twoOn: "Two-step turned on", twoOff: "Two-step turned off", signedOut: "Signed a device out", signedOutAll: "Signed out everywhere else", here: "On this phone" },
  data: {
    title: "Your data", label: "Export my data", sub: "Quotes, clients, invoices and photos", button: "Export", prep: "Preparing your files. We’ll email you too.", prepWord: "Preparing",
    ready: "Your export is ready", readySub: "{{size}} · link works until {{date}}", download: "Download", failed: "The last export didn’t finish. Try again.",
    foot: "Keep records for 6 years for the CRA. An export is the easiest way.", limited: "One export a day. Try again tomorrow.", ownerOnly: "Only the owner can export the company’s data.",
  },
  del: {
    title: "Delete account", body: "Closes {{company}} on quoteAI for everyone on your team.", open: "Delete account",
    grace: [
      { t: "{{days}} days to change your mind", s: "Use the link in our email before {{date}} to cancel. Nothing is lost." },
      { t: "Client links stop working", s: "Open quotes, invoices and the portal close on day {{days}}." },
      { t: "Then it’s erased for good", s: "Quotes, clients, invoices, photos and crew hours." },
    ],
    password: "Your password", type: "Type {{word}} to confirm", word: "DELETE", code: "Authenticator code", codeHint: "Enter the 6-digit code from your authenticator app.",
    keep: "Keep account", go: "Delete in {{days}} days", badPassword: "That password isn’t right.", badCode: "That code isn’t right.", scheduled: "Your account closes on {{date}}. We emailed you a link to cancel.",
  },
  toast: { failed: "Couldn’t do that.", offline: "You’re offline. Try again when you’re back online.", signedOut: "Signed out.", exportSent: "Preparing your export. We’ll email you the link.", soon: "Two-step setup isn’t in this build yet." },
};

export const fr: typeof en = {
  back: "Retour", title: "Connexion et sécurité", lede: "{{name}} · {{email}}",
  readOnly: { lead: "Consultation seulement.", body: "Votre rôle permet de voir ces réglages, mais pas de les modifier. Demandez au propriétaire." },
  closing: { lead: "Fermeture du compte le {{date}}.", body: "Votre équipe peut travailler d’ici là. Rien n’est effacé avant cette date." },
  twoOff: { lead: "La vérification en deux étapes est désactivée.", body: "Quiconque a votre mot de passe pourrait voir les données des clients et des paiements.", link: "L’activer" },
  loadFailed: { title: "Impossible de charger vos réglages de sécurité", body: "Vérifiez votre connexion et réessayez.", retry: "Réessayer" },
  sign: {
    title: "Connexion",
    password: { label: "Mot de passe", sub: "Un lien arrive par courriel", value: "Modifier" },
    face: { label: "Face ID", sub: "Déverrouillage après 5 min d’absence", soon: "Face ID n’est pas encore dans cette version." },
    two: { label: "Vérification en deux étapes", on: "Un code de votre application d’authentification", off: "Désactivée. Un code en plus du mot de passe", onWord: "Activée", offWord: "Désactivée" },
    backup: { label: "Codes de secours", sub: "Si vous perdez votre téléphone" },
    setup: { label: "Activer les deux étapes", sub: "Environ une minute" },
  },
  devices: {
    title: "Appareils connectés", on: "{{browser}} sur {{system}}", here: "Ce téléphone", hereSub: "Connecté en ce moment", active: "Actif", signOut: "Déconnecter", unknown: "Un autre appareil",
    foot: "Un appareil inconnu ? Déconnectez-le et changez votre mot de passe.", footOut: "Déconnecté de {{what}}.", all: "Déconnecter partout ailleurs", only: "Seul ce téléphone est connecté", everyone: "tous les autres appareils",
    when: { now: "à l’instant", min_one: "il y a {{count}} min", min_other: "il y a {{count}} min", hour_one: "il y a {{count}} h", hour_other: "il y a {{count}} h" },
  },
  activity: { title: "Activité récente", login: "Nouvelle connexion", twoOn: "Deux étapes activées", twoOff: "Deux étapes désactivées", signedOut: "Appareil déconnecté", signedOutAll: "Déconnecté partout ailleurs", here: "Sur ce téléphone" },
  data: {
    title: "Vos données", label: "Exporter mes données", sub: "Soumissions, clients, factures et photos", button: "Exporter", prep: "Préparation des fichiers. Vous recevrez aussi un courriel.", prepWord: "En cours",
    ready: "Exportation prête", readySub: "{{size}} · lien valide jusqu’au {{date}}", download: "Télécharger", failed: "La dernière exportation n’a pas abouti. Réessayez.",
    foot: "Conservez vos dossiers 6 ans pour l’ARC. L’exportation est le moyen le plus simple.", limited: "Une exportation par jour. Réessayez demain.", ownerOnly: "Seul le propriétaire peut exporter les données de l’entreprise.",
  },
  del: {
    title: "Supprimer le compte", body: "Ferme {{company}} sur quoteAI pour toute votre équipe.", open: "Supprimer le compte",
    grace: [
      { t: "{{days}} jours pour changer d’avis", s: "Utilisez le lien de notre courriel avant le {{date}} pour annuler. Rien n’est perdu." },
      { t: "Les liens client cessent de fonctionner", s: "Soumissions ouvertes, factures et portail ferment au jour {{days}}." },
      { t: "Puis tout est effacé pour de bon", s: "Soumissions, clients, factures, photos et heures de l’équipe." },
    ],
    password: "Votre mot de passe", type: "Tapez {{word}} pour confirmer", word: "SUPPRIMER", code: "Code d’authentification", codeHint: "Entrez le code à 6 chiffres de votre application d’authentification.",
    keep: "Garder le compte", go: "Supprimer dans {{days}} j", badPassword: "Ce mot de passe n’est pas le bon.", badCode: "Ce code n’est pas le bon.", scheduled: "Votre compte ferme le {{date}}. Nous vous avons envoyé un lien pour annuler.",
  },
  toast: { failed: "Impossible de le faire.", offline: "Vous êtes hors ligne. Réessayez une fois reconnecté.", signedOut: "Déconnecté.", exportSent: "Préparation de l’exportation. Le lien arrivera par courriel.", soon: "L’activation des deux étapes n’est pas encore dans cette version." },
};
