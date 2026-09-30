# French (Canada) boards: brief for translation agents

Root: `/tmp/claude-0/-home-claude/623c0fab-b115-55d7-b946-c161fcbc5c10/scratchpad` (call it `$S`).
App: quoteAI Pocket, a mobile CRM for Canadian trade contractors. The English boards are final and approved. You make faithful French copies. You are not redesigning anything.

## What you produce, per screen NAME in your list
1. `cp $S/screens/NAME.body.html $S/screens/NAMEFR.body.html` and `cp $S/screens/NAME.js $S/screens/NAMEFR.js`.
2. Translate every user-visible string in the two FR files (see rules). Edit them with Edit/Write or a python script. Never touch the English files, manifest.json, other screens, or anything in `design/`, except the build output below.
3. `python3 $S/kit/frtypo.py $S/screens/NAMEFR.body.html $S/screens/NAMEFR.js` (French spacing: non-breaking spaces before `$ % : ?`, thousands).
4. `cd $S && python3 kit/frbuild.py NAME` builds `design/project/NAMEFR.dc.html`, renders it, and prints: content height vs board height, overflowing text, and possible English left. Read the screenshot `$S/prev/frchk_NAMEFR.png` with the Read tool for at least your 3 busiest screens.
   - If content bottom > board H, re-run with a bigger H: `python3 kit/frbuild.py NAME 2000`, and report that H.
   - "Overflowing text" and "English left" are heuristics. Proper names (Rossi Renovations, Harbourfront Dental, street names, CSV, PDF, Interac, Stripe, QuickBooks) are fine. Swipe-action labels (hidden until swiped) are false positives. Run it once on the English original mentally: if the English had the same item, it is pre-existing and fine.
   - A real overflow means a French label is too long for a fixed-width chip or button: pick a shorter French wording. Never change CSS, sizes or layout.
5. If the build throws a JS/template error, you broke a quote or a `{{hole}}`: fix it.

## What to translate
- Text nodes in the body, `aria-label`, `placeholder`, `title`, `alt`.
- JS string literals that end up on screen: labels, statuses, dates, messages, sample data descriptions (job names like "Kitchen backsplash" → "Dosseret de cuisine"), toasts, empty states, errors.
- The `<title>` is built from the manifest. Ignore it.

## What NOT to touch
- CSS, class names, ids, variable names, object keys, state keys, `{{holes}}`, `sc-for` / `sc-if` attributes, macros like `[[ICON x 24]]`, `[[BACK Menu.dc.html]]`, `[[MORE]]`, icon names, hrefs and `.dc.html` links (a later pass remaps links to FR boards), phone numbers, emails, IDs (Q-2026-119, INV-0412), person and company names, street addresses, brand names.
- Status mapping keys and the tone/shape classes (`st-ok si-check` etc.): translate only the word.
- Numbers stay the same values.

## Style and conventions (Quebec / Canadian French, matching the existing FR boards)
- Read `$S/screens/QuotesFR.js`, `$S/screens/InvoiceFR.js` and `$S/screens/JobsFR.js` first and match their vocabulary and tone. Tutoiement: no. Use `vous`. Short, plain, contractor-friendly. No anglicisms where a common Quebec term exists, but keep widely used ones (texto, courriel).
- Glossary: quote = soumission; invoice = facture; job = chantier (a single job) / travaux (the Jobs section); client = client; lead = demande (or prospect); crew = équipe; foreman = contremaître; subcontractor = sous-traitant; change order = ordre de changement; deposit = dépôt; balance due = solde dû; overdue = en retard; paid = payée; partly paid = payée en partie; draft = brouillon; sent = envoyée; viewed = consultée; accepted = acceptée; declined = refusée; expired = expirée; on hold = en pause; active = actif; done = terminé; price book = liste de prix; receipt = reçu; timesheet / hours = heures; payroll = paie; settings = réglages; save = enregistrer; cancel = annuler; edit = modifier; send = envoyer; open = ouvrir; add = ajouter; search = rechercher; today = aujourd’hui; assistant = assistant; HST = TVH; GST = TPS; QST = TVQ; per diem = indemnité journalière; drywall = gypse; sq ft = pi²; email = courriel; text message = texto; sign in = se connecter; sign up / create account = créer un compte; password = mot de passe; two-step verification = vérification en deux étapes.
- Money: `4 131,05 $` via `n.toLocaleString('fr-CA', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' $'` (replace existing `'$' + ...` money helpers the same way QuotesFR.js does). Whole amounts: `2 500 $`. Short forms: `$2.5k` → `2,5 k$`.
- Dates: `29 sept.`, `lun. 13 oct.`, months: janv. févr. mars avr. mai juin juil. août sept. oct. nov. déc. Days: lun. mar. mer. jeu. ven. sam. dim. Times: 24 h clock, `14 h 30`, `9 h`. Durations: `31,5 h`, `2 j`.
- Decimals use a comma: `31,5 h`, `13 %`.
- Typographic apostrophe `’` in French text. In JS single-quoted strings, use `’` (not `'`) so you never break the string.
- Capitalise like French: only the first word of a label ("Nouvelle soumission", not "Nouvelle Soumission").
- Keep it the same length or shorter where you can. Buttons and chips have fixed widths.

## Report back (short)
For each screen: done / problem, and the final board H if you changed it, and the French board title (e.g. "Heures de l’équipe (FR)"). Nothing else.
