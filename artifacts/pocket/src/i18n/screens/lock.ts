// SystemStates.dc.html, "App lock and permissions": the lock screen, the offer to turn it on, and the sheets shown before the phone asks for a permission.
// French from SystemStatesFR.dc.html. The board says Face ID; on a phone without it the method's own name is used (not on the board).
export const en = {
  method: { faceId: "Face ID", touchId: "Touch ID", face: "face unlock", fingerprint: "fingerprint", device: "your phone’s lock" },
  screen: { title: "quoteAI is locked", unlock: "Unlock with {{method}}", signOut: "Sign out and use my password", prompt: "Unlock quoteAI", cancel: "Cancel" },
  offer: { label: "App lock", title: "Lock quoteAI with {{method}}?", body: "Client details and money stay private if someone else picks up your phone.", later: "Not now", on: "Turn on", close: "Close" },
  ask: {
    later: "Not now", go: "Continue", close: "Close",
    camera: { title: "Allow the camera", body: "For receipts and site photos. Nothing is taken unless you tap." },
    mic: { title: "Allow the microphone", body: "Only while the mic is on, to describe jobs and write notes." },
    location: { title: "Allow location at clock-in", body: "Only at clock-in and clock-out, to confirm you are on site." },
    notifications: { title: "Allow notifications", body: "Know when a quote is viewed, signed or paid." },
  },
  // The sandbox page (/sandbox/system-states)
  board: { section: "App lock and permissions", lock: "App lock", offer: "Offer to turn on app lock", ask: "Before the phone asks", company: "Rossi Renovations", email: "marco@rossireno.ca" },
};

export const fr: typeof en = {
  method: { faceId: "Face ID", touchId: "Touch ID", face: "la reconnaissance faciale", fingerprint: "l’empreinte digitale", device: "le verrouillage du téléphone" },
  screen: { title: "quoteAI est verrouillée", unlock: "Déverrouiller avec {{method}}", signOut: "Me déconnecter et utiliser mon mot de passe", prompt: "Déverrouiller quoteAI", cancel: "Annuler" },
  offer: { label: "Verrouillage de l’app", title: "Verrouiller quoteAI avec {{method}} ?", body: "Les données clients et les montants restent privés si quelqu’un d’autre prend votre téléphone.", later: "Plus tard", on: "Activer", close: "Fermer" },
  ask: {
    later: "Plus tard", go: "Continuer", close: "Fermer",
    camera: { title: "Autoriser l’appareil photo", body: "Pour les reçus et les photos de chantier. Rien n’est pris sans votre accord." },
    mic: { title: "Autoriser le micro", body: "Seulement quand le micro est ouvert, pour décrire les travaux et dicter des notes." },
    location: { title: "Autoriser la position au pointage", body: "Seulement à l’arrivée et au départ, pour confirmer votre présence sur le chantier." },
    notifications: { title: "Autoriser les notifications", body: "Sachez quand une soumission est consultée, signée ou payée." },
  },
  board: { section: "Verrouillage et autorisations", lock: "Verrouillage de l’app", offer: "Proposer le verrouillage", ask: "Avant la demande du téléphone", company: "Rossi Renovations", email: "marco@rossireno.ca" },
};
