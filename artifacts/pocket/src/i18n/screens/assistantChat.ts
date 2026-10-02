// HomeAI.dc.html's assistant layer: voice (the orb, type instead, mute, close) and the keyboard (messages and the bar). The replies are the assistant's own; these are the words around them.
export const en = {
  label: "Assistant", openKeyboard: "Type instead", backToVoice: "Back to voice", close: "Close assistant", mute: "Mute microphone", unmute: "Unmute microphone",
  placeholder: "Ask anything, or describe a job", field: "Message the assistant", send: "Send",
  noVoice: "Voice isn’t available on this phone yet. Tap the keyboard to type.",
  locked: "The assistant is included in Business. It drafts reminders, orders and schedule changes, and waits for your yes.", seePlan: "See plans",
  failed: "I couldn’t answer that right now. Try again in a moment.", offline: "You’re offline. Try again when you’re back online.",
  proposals_one: "{{count}} thing is waiting for your OK.", proposals_other: "{{count}} things are waiting for your OK.", review: "Review",
};
export const fr: typeof en = {
  label: "Assistant", openKeyboard: "Écrire plutôt", backToVoice: "Retour à la voix", close: "Fermer l’assistant", mute: "Couper le micro", unmute: "Réactiver le micro",
  placeholder: "Posez une question ou décrivez un chantier", field: "Message à l’assistant", send: "Envoyer",
  noVoice: "La voix n’est pas encore disponible sur ce téléphone. Touchez le clavier pour écrire.",
  locked: "L’assistant est inclus dans Business. Il prépare les rappels, les commandes et les changements d’horaire, et attend votre accord.", seePlan: "Voir les forfaits",
  failed: "Je n’ai pas pu répondre pour le moment. Réessayez dans un instant.", offline: "Vous êtes hors ligne. Réessayez une fois reconnecté.",
  proposals_one: "{{count}} chose attend votre accord.", proposals_other: "{{count}} choses attendent votre accord.", review: "Voir",
};
