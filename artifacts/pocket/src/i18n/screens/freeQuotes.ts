// Free quotes: the counter banner (the board's Trial banner) and the "free quotes used" sheet (SystemStates: Locked by plan, and the Quota card's "reached" state).
// No prices and no purchase: the action opens the same plan path as every other plan link. French: Québec, vous.
export const en = {
  banner: {
    count: { lead: "{{left}} of {{limit}} free quotes left.", body: "Then pick a plan to keep quoting." },
    one: { lead: "1 of {{limit}} free quotes left.", body: "After that, pick a plan to keep quoting." },
    zero: { lead: "0 of {{limit}} free quotes left.", body: "Pick a plan to keep quoting." },
    used: { lead: "You’ve used your {{limit}} free quotes.", body: "Your quotes stay here. Pick a plan to write new ones." },
    link: "See plans",
  },
  locked: {
    label: "Free quotes used", close: "Close", title: "You’ve used your {{limit}} free quotes", body: "Pick a plan to keep writing quotes.",
    status: "Free quotes used", meter: "Free quotes", of: "of", keep: "Your quotes stay here. You can still view, edit and send the ones you have.",
    plans: "See plans", later: "Not now", note: "Plans can’t be changed in the app", soon: "Plans",
  },
};

export const fr: typeof en = {
  banner: {
    count: { lead: "{{left}} soumissions gratuites restantes sur {{limit}}.", body: "Ensuite, choisissez un forfait pour continuer." },
    one: { lead: "1 soumission gratuite restante sur {{limit}}.", body: "Ensuite, choisissez un forfait pour continuer." },
    zero: { lead: "0 soumission gratuite restante sur {{limit}}.", body: "Choisissez un forfait pour continuer." },
    used: { lead: "Vous avez utilisé vos {{limit}} soumissions gratuites.", body: "Vos soumissions restent ici. Choisissez un forfait pour en créer de nouvelles." },
    link: "Voir les forfaits",
  },
  locked: {
    label: "Soumissions gratuites utilisées", close: "Fermer", title: "Vous avez utilisé vos {{limit}} soumissions gratuites", body: "Choisissez un forfait pour continuer à créer des soumissions.",
    status: "Soumissions gratuites utilisées", meter: "Soumissions gratuites", of: "sur", keep: "Vos soumissions restent ici. Vous pouvez toujours les consulter, les modifier et les envoyer.",
    plans: "Voir les forfaits", later: "Pas maintenant", note: "Les forfaits se modifient sur le site Web", soon: "Forfaits",
  },
};
