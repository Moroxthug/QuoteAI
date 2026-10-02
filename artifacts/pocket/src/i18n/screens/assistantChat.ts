// HomeAI.dc.html's assistant layer: voice (the orb, type instead, mute, close) and the keyboard (messages and the bar). The replies are the assistant's own; these are the words around them.
export const en = {
  label: "Assistant", openKeyboard: "Type instead", backToVoice: "Back to voice", close: "Close assistant", mute: "Mute microphone", unmute: "Unmute microphone",
  placeholder: "Ask anything, or describe a job", field: "Message the assistant", send: "Send",
  tapToTalk: "Tap the microphone and talk.", listening: "Listening. Tap again to send.", talk: "Talk", stopSend: "Stop and send",
  micDenied: "The microphone is off for quoteAI. Turn it on in your phone’s settings, or tap the keyboard to type.", micFailed: "I couldn’t use the microphone. Tap the keyboard to type.", empty: "I didn’t catch that. Try again.",
  locked: "The assistant is included in Business. It drafts reminders, orders and schedule changes, and waits for your yes.", seePlan: "See plans",
  failed: "I couldn’t answer that right now. Try again in a moment.", offline: "You’re offline. Try again when you’re back online.",
  proposals_one: "{{count}} thing is waiting for your OK.", proposals_other: "{{count}} things are waiting for your OK.", review: "Review",
};
export const fr: typeof en = {
  label: "Assistant", openKeyboard: "Écrire plutôt", backToVoice: "Retour à la voix", close: "Fermer l’assistant", mute: "Couper le micro", unmute: "Réactiver le micro",
  placeholder: "Posez une question ou décrivez un chantier", field: "Message à l’assistant", send: "Envoyer",
  tapToTalk: "Touchez le micro et parlez.", listening: "J’écoute. Touchez de nouveau pour envoyer.", talk: "Parler", stopSend: "Arrêter et envoyer",
  micDenied: "Le micro est désactivé pour quoteAI. Activez-le dans les réglages du téléphone, ou touchez le clavier pour écrire.", micFailed: "Je n’ai pas pu utiliser le micro. Touchez le clavier pour écrire.", empty: "Je n’ai pas compris. Réessayez.",
  locked: "L’assistant est inclus dans Business. Il prépare les rappels, les commandes et les changements d’horaire, et attend votre accord.", seePlan: "Voir les forfaits",
  failed: "Je n’ai pas pu répondre pour le moment. Réessayez dans un instant.", offline: "Vous êtes hors ligne. Réessayez une fois reconnecté.",
  proposals_one: "{{count}} chose attend votre accord.", proposals_other: "{{count}} choses attendent votre accord.", review: "Voir",
};
