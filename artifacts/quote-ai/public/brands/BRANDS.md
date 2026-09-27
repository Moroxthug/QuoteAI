# Third-party brand assets

The logos in this folder are trademarks of their respective owners. QuoteAI uses them only to identify an integration with that company's product, next to the product's name, and only as each owner's guidelines allow. Their presence does not imply endorsement, sponsorship or partnership.

Every file was taken from the owner's own domain (or an asset CDN that the owner's own page loads/links). Files are unaltered artwork. The only edits were mechanical: XML comments removed, fixed `width`/`height` removed from the root `<svg>` so it scales (a `viewBox` was added from those values where the original lacked one: `google-calendar.svg`). None contained scripts, event handlers, `<foreignObject>`, embedded rasters or external links.

## Files

| File | Company | Source URL | Fetched | Variant |
|---|---|---|---|---|
| `google.svg` | Google LLC | https://www.gstatic.com/images/branding/productlogos/googleg/v6/24px.svg (loaded by https://ads.google.com/local-services-ads/) | 2026-09-26 | symbol ("G") |
| `google-calendar.svg` | Google LLC | https://www.gstatic.com/images/branding/productlogos/calendar_2026/v2/web/192px.svg (loaded by https://workspace.google.com/products/calendar/ and https://calendar.google.com/calendar/about/) | 2026-09-26 | symbol (product icon) |
| `gmail.svg` | Google LLC | https://www.gstatic.com/images/branding/productlogos/gmail_2026/v2/web/192px.svg (loaded by https://workspace.google.com/products/gmail/ and https://www.google.com/gmail/about/) | 2026-09-26 | symbol (product icon) |
| `quickbooks-connect.svg` | Intuit Inc. | https://static.developer.intuit.com/resources/Connect_to_QuickBooks_buttons.zip → `Connect_to_QuickBooks_English/Connect_to_QuickBooks_SVG/C2QB_green_btn_med_default.svg` (linked from https://developer.intuit.com/app/developer/qbo/docs/go-live/list-on-the-app-store/naming-and-logo-guidelines) | 2026-09-26 | button (green, medium, default state) |
| `quickbooks-connect-transparent.svg` | Intuit Inc. | same ZIP → `C2QB_transparent_btn_short_default.svg` | 2026-09-26 | button (transparent, short, default state) |
| `wave.svg` | Wave Financial Inc. | https://cdn.prod.website-files.com/62446230dcb514b828a6e237/677ed61188695f2316217fc5_Wave-2_0-logo-fullcolour-rgb.svg (loaded by https://www.waveapps.com/press) | 2026-09-26 | wordmark (symbol + name, full colour) |
| `stripe.svg` | Stripe, Inc. | https://assets.stripeassets.com/fzn2n1nzq965/7q0dJGs6fRS1LRmMpChoAF/87def4edfbb7fd5aef4ab9baf904b2db/Stripe_logo_kit.zip → `asset-wordmark/Stripe wordmark - Blurple.svg` (linked from https://stripe.com/newsroom/brand-assets) | 2026-09-26 | wordmark (Blurple) |
| `financeit.svg` | Financeit Canada Inc. | https://www.financeit.io/wp-content/themes/financeit/img/logo-2020.svg (loaded by https://www.financeit.io/) | 2026-09-26 | wordmark |
| `flinks.png` | Flinks (legal entity not stated on flinks.com) | https://cdn.prod.website-files.com/6733567c88ece7f1d9007402/69272b3e156859e681fafd42_Flinks_Horizontal_Colour.png (loaded by https://www.flinks.com/, 512x226 PNG) | 2026-09-26 | wordmark (PNG; no SVG is published) |

## Not sourced (no file in this folder)

- **QuickBooks logo (`quickbooks.svg`)**: Intuit's approved icon for apps (`qb_logo_icon.zip`) is behind a developer.intuit.com login; the press-room logos at intuit.com/company/press-room/logos/ are marked "for editorial use only". The owner must sign in to developer.intuit.com and download it from the naming-and-logo-guidelines page.
- **Outlook (`outlook.svg`)**: Microsoft's trademark guidelines say app/product icons can never be used without an express licence. Refer to Outlook by name in text only.
- **Twilio (`twilio.svg`)**: Twilio's trademark guidelines require express written permission for Twilio logos. Only the "Powered by Twilio" badge is allowed, and its download portal (library.twilio.com) was returning an error on 2026-09-26.
- **WhatsApp (`whatsapp.svg`)** and **Meta (`meta.svg`)**: the official kits on meta.com/brand/resources are behind an "I have read and accept the applicable guidelines" checkbox, which the owner has to tick. The Meta logo also needs approval from a Meta contact for every use, and must not stand in for Facebook.

## Rules

### Google (G logo, Calendar, Gmail)
- Product icons only "when necessary", e.g. to show compatible products; don't use product icons on their own. Make sure it doesn't look like the feature comes from Google, and don't alter the icons. Include a trademark legal line. See https://partnermarketinghub.withgoogle.com/brands/google/use-cases/product-co-branding/ (formerly about.google/brand-resource-center/guidance/apis/).
- G logo (Sign in with Google rules, https://developers.google.com/identity/branding-guidelines): full-colour standard G only. Don't change its size ratio or colour, don't use monochrome or custom versions, and put it on a white background. On a sign-in button, keep the fixed padding (web: 12px left, 10px after the G, 12px right). The sign-in G is meant to be used inside the official button.
- Workspace Marketplace (https://developers.google.com/workspace/marketplace/terms/branding): never use Google product icons as your own app logo. Say "for" / "compatible with" when naming the integration.

### Intuit QuickBooks
Source: https://developer.intuit.com/app/developer/qbo/docs/go-live/list-on-the-app-store/naming-and-logo-guidelines
- Start the OAuth flow with the official "Connect to QuickBooks" button, not a link or custom widget. Show it only while not connected. Once connected, replace it with a "Disconnect from QuickBooks" button or link.
- Don't modify the button graphics. Use the size as supplied and keep the aspect ratio. Green is preferred. Use the transparent button only when the green lacks contrast. Provide base and hover states (hover SVGs are in the same ZIP).
- QuickBooks logo: clear space of half the QuickBooks symbol's height on every side, and never show the symbol under 16px (digital, 72dpi). Don't alter the logo.
- Your own name/logo must be larger than any Intuit logo. Never use Intuit brands or brand fragments ("quick", "QB" …) in your product or app name.

### Wave
Source: https://www.waveapps.com/press
- Wave doesn't publish usage rules. The press page offers the logo under "Media Resources". Apply standard practice: don't recolour, stretch, rotate or crop it, and give it clear space.

### Stripe
Source: https://stripe.com/newsroom/brand-assets
- Use Slate or Blurple on light backgrounds and White on dark. Don't use the wordmark in any other colour.
- Businesses using Stripe may show the logo / "Powered by Stripe" badge (for example at checkout), and linking the badge to stripe.com is suggested. All use falls under Stripe's Marks Usage Agreement. Don't alter, stretch or rotate it.

### Financeit
Source: https://www.financeit.io/
- No public brand guidelines were found. The logo is the one Financeit's own site uses. Use it unaltered and only to identify the integration. Confirm with Financeit (partner or press@financeit.io) before any wider marketing use.

### Flinks
Source: https://www.flinks.com/
- No public brand guidelines or SVG were found. The PNG is the logo Flinks' own site uses. Use it unaltered at or below its native 512x226 size to stay sharp. Confirm with your Flinks partner contact before marketing use.

### Microsoft Outlook (not included)
Source: https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks
- Logos, app and product icons can never be used without an express licence. Accurate text references are allowed (e.g. "Works with Microsoft Outlook").

### Twilio (not included)
Source: https://www.twilio.com/en-us/legal/trademark
- Using Twilio logos needs express written permission. Customers and developers may use the unmodified "Powered by Twilio" badge while their account is in good standing, and that permission can be revoked. Your own branding must be more prominent than Twilio's.

### WhatsApp (not included)
Source: https://www.meta.com/brand/resources/whatsapp/whatsapp-brand/
- Only use logos from the WhatsApp brand resource page. Don't modify the design or colours or combine them with other marks. Don't let the logo be the most prominent feature, and don't use it to replace the word "WhatsApp" in a sentence. Write "WhatsApp" with a capital W and A. Downloading the kit requires accepting the guidelines.

### Meta (not included)
Source: https://www.meta.com/brand/resources/meta/company-brand/
- Every use of the Meta logo requires approval through a Meta contact. Minimum size is 12px / 5mm symbol height. Clear space is twice the symbol height. Use the primary colour versions. The Meta logo must not be used to represent Facebook. Downloading requires accepting the guidelines.

## Trademark notice

Google, Gmail and Google Calendar are trademarks of Google LLC. Intuit and QuickBooks are registered trademarks of Intuit Inc. Wave is a trademark of Wave Financial Inc. Stripe is a trademark of Stripe, Inc. Financeit is a trademark of Financeit Canada Inc. Flinks is a trademark of Flinks (confirm the legal entity name before publishing). All other trademarks belong to their respective owners.
