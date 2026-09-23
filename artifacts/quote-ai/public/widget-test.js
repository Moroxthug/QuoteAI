// Phase 92: builds the contractor snippet on /widget-test.html from ?key=
// and ?lang= (an external file because the site CSP allows no inline script).
(function () {
  var params = new URLSearchParams(location.search);
  var key = params.get("key") || "";
  // ?lang= from the Settings link, else the language the app was last used in on this browser.
  var stored = "";
  try { stored = localStorage.getItem("quoteai-lang") || ""; } catch (e) { /* storage blocked */ }
  var lang = (params.get("lang") || stored) === "fr" ? "fr" : "en";
  document.documentElement.lang = lang;

  if (lang === "fr") {
    document.title = "Aperçu du widget · QuoteAI";
    document.getElementById("note").textContent =
      "Cette page remplace votre site web : le formulaire ci-dessous est votre widget, tel que vos visiteurs le voient. Une demande envoyée d'ici arrive dans vos prospects comme toute autre.";
    document.getElementById("heading").textContent = "Cuisines, salles de bain et sous-sols";
    document.getElementById("lede").textContent = "Entreprise familiale au service de la région depuis 1998. Parlez-nous de votre projet ci-dessous.";
  }

  if (!key) {
    document.getElementById("note").textContent =
      lang === "fr"
        ? "Ouvrez cette page depuis Paramètres → Widget → « Tester votre widget » pour voir votre formulaire."
        : "Open this page from Settings → Widget → \"Test your widget\" to see your form.";
    return;
  }

  // The same two elements the pasted snippet creates.
  var container = document.createElement("div");
  container.id = "quoteai-widget";
  document.getElementById("slot").appendChild(container);
  var script = document.createElement("script");
  script.src = "/widget.js";
  script.async = true;
  script.setAttribute("data-api-key", key);
  document.body.appendChild(script);
})();
