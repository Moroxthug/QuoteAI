/**
 * apply-clerk-email-templates.ts
 *
 * Applies QuoteAI branding to Clerk system email templates via the Clerk Backend API.
 * Custom HTML bodies with QuoteAI purple gradient header, logo, and Italian copy.
 *
 * Run for dev:  CLERK_SECRET_KEY=sk_test_... pnpm --filter @workspace/scripts run apply-clerk-email-templates
 * Run for prod: CLERK_SECRET_KEY=sk_live_... pnpm --filter @workspace/scripts run apply-clerk-email-templates
 */

const CLERK_API_BASE = "https://api.clerk.com/v1/templates/email";

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
if (!CLERK_SECRET_KEY) {
  console.error("Error: CLERK_SECRET_KEY environment variable is required.");
  process.exit(1);
}

// ─── Shared HTML Helpers ──────────────────────────────────────────────────────

const EMAIL_BASE_STYLES = `
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0;mso-table-rspace:0;border-collapse:collapse}
  body{margin:0;padding:0;width:100%!important;background:#f5f3ff}
  img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}
  a{color:#7c3aed;text-decoration:none}
  @media screen and (max-width:600px){
    .wrapper{width:100%!important}
    .btn{display:block!important;width:100%!important;box-sizing:border-box!important}
  }
`.trim();

function wrapEmail(title: string, preheader: string, bodyContent: string): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="it">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style type="text/css">${EMAIL_BASE_STYLES}</style>
</head>
<body>
  <!-- Preheader -->
  <span style="display:none;font-size:1px;color:#f5f3ff;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
  <!-- Outer table -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;padding:32px 16px">
    <tr><td align="center">
      <!-- Card -->
      <table class="wrapper" width="560" cellpadding="0" cellspacing="0" style="border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(124,58,237,0.10)">

        <!-- HEADER -->
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed 0%,#06b6d4 100%);padding:28px 40px;text-align:center">
            <!-- Logo text -->
            <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
              <span style="font-family:system-ui,-apple-system,Arial,sans-serif;font-size:26px;font-weight:700;letter-spacing:-0.5px;">
                <span style="color:#ffffff">prev</span><span style="color:#e0f2fe">ai</span>
              </span>
            </td></tr></table>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="background:#ffffff;padding:32px 40px">
            ${bodyContent}
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #f3f4f6;text-align:center">
            <p style="margin:0;font-family:system-ui,-apple-system,Arial,sans-serif;font-size:12px;color:#9ca3af;line-height:1.6">
              &copy; {{current_year}} QuoteAI &middot; Preventivi professionali con l'AI
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function primaryButton(label: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:28px auto 0">
    <tr><td align="center" style="border-radius:10px;background:linear-gradient(135deg,#7c3aed,#06b6d4)">
      <a href="${url}" class="btn" style="font-family:system-ui,-apple-system,Arial,sans-serif;display:inline-block;color:#ffffff;font-size:15px;font-weight:600;padding:13px 32px;border-radius:10px;text-decoration:none;mso-padding-alt:0">
        ${label}
      </a>
    </td></tr>
  </table>`;
}

function otpBlock(code: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0">
    <tr><td align="center" style="background:#f5f3ff;border:1px solid #ede9fe;border-radius:12px;padding:24px">
      <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:40px;font-weight:700;letter-spacing:8px;color:#7c3aed">${code}</p>
    </td></tr>
  </table>`;
}

function bodyText(html: string, style: string = ""): string {
  return `<p style="margin:16px 0 0;font-family:system-ui,-apple-system,Arial,sans-serif;font-size:14px;color:#6b7280;line-height:1.7;${style}">${html}</p>`;
}

function heading(text: string): string {
  return `<h1 style="margin:0;font-family:system-ui,-apple-system,Arial,sans-serif;font-size:22px;font-weight:700;color:#1a1a2e;line-height:1.3">${text}</h1>`;
}

function divider(): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td style="border-top:1px solid #ede9fe"></td></tr></table>`;
}

// ─── Template Bodies ──────────────────────────────────────────────────────────

const VERIFICATION_CODE_BODY = wrapEmail(
  "{{otp_code}} è il tuo codice di verifica – QuoteAI",
  "{{otp_code}} è il tuo codice di verifica QuoteAI. Scade tra 10 minuti.",
  `
  ${heading("Verifica il tuo indirizzo email")}
  ${bodyText("Usa il codice seguente per completare la verifica. Non condividerlo con nessuno.")}
  ${otpBlock("{{otp_code}}")}
  ${bodyText("Il codice scade tra <strong>10 minuti</strong>.")}
  ${divider()}
  ${bodyText("<strong>Non hai richiesto questo codice?</strong><br>Richiesta effettuata da <strong>{{requested_from}}</strong> il <strong>{{requested_at}}</strong>. Se non sei stato tu, puoi ignorare questa email.", "font-size:13px;color:#9ca3af")}
  `,
);

const RESET_PASSWORD_BODY = wrapEmail(
  "{{otp_code}} è il tuo codice per reimpostare la password – QuoteAI",
  "Codice per reimpostare la password del tuo account QuoteAI.",
  `
  ${heading("Reimposta la tua password")}
  ${bodyText("Hai richiesto di reimpostare la password del tuo account QuoteAI. Usa il codice seguente:")}
  ${otpBlock("{{otp_code}}")}
  ${bodyText("Il codice scade tra <strong>10 minuti</strong>. Non condividerlo con nessuno.")}
  ${divider()}
  ${bodyText("<strong>Non hai richiesto questo?</strong><br>Se non sei stato tu, puoi ignorare questa email. La tua password rimane invariata.", "font-size:13px;color:#9ca3af")}
  `,
);

// Magic link templates require {{magic_link}} variable in the body
const MAGIC_LINK_SIGN_IN_BODY = wrapEmail(
  "Il tuo link per accedere a QuoteAI",
  "Clicca sul link per accedere al tuo account QuoteAI.",
  `
  ${heading("Accedi al tuo account")}
  ${bodyText("Clicca sul pulsante qui sotto per accedere a QuoteAI. Il link è valido per {{ttl_minutes}} minuti.")}
  ${primaryButton("Accedi a QuoteAI →", "{{magic_link}}")}
  ${bodyText("Se il pulsante non funziona, copia e incolla questo link nel browser:<br><a href='{{magic_link}}' style='color:#7c3aed;word-break:break-all'>{{magic_link}}</a>", "font-size:13px;margin-top:20px")}
  ${divider()}
  ${bodyText("<strong>Non hai richiesto questo link?</strong><br>Richiesta da <strong>{{requested_from}}</strong>. Puoi ignorare questa email in sicurezza.", "font-size:13px;color:#9ca3af")}
  `,
);

const MAGIC_LINK_SIGN_UP_BODY = wrapEmail(
  "Il tuo link per registrarti su QuoteAI",
  "Clicca sul link per completare la registrazione su QuoteAI.",
  `
  ${heading("Completa la registrazione")}
  ${bodyText("Clicca sul pulsante qui sotto per completare la registrazione su QuoteAI e iniziare a creare preventivi professionali in pochi secondi.")}
  ${primaryButton("Completa registrazione →", "{{magic_link}}")}
  ${bodyText("Se il pulsante non funziona, copia e incolla questo link nel browser:<br><a href='{{magic_link}}' style='color:#7c3aed;word-break:break-all'>{{magic_link}}</a>", "font-size:13px;margin-top:20px")}
  ${divider()}
  ${bodyText("<strong>Non hai richiesto questo?</strong><br>Puoi ignorare questa email in sicurezza.", "font-size:13px;color:#9ca3af")}
  `,
);

const MAGIC_LINK_VERIFY_EMAIL_BODY = wrapEmail(
  "Verifica il tuo indirizzo email – QuoteAI",
  "Clicca sul link per verificare il tuo indirizzo email su QuoteAI.",
  `
  ${heading("Verifica il tuo indirizzo email")}
  ${bodyText("Clicca sul pulsante qui sotto per verificare il nuovo indirizzo email associato al tuo account QuoteAI.")}
  ${primaryButton("Verifica email →", "{{magic_link}}")}
  ${bodyText("Se il pulsante non funziona, copia e incolla questo link nel browser:<br><a href='{{magic_link}}' style='color:#7c3aed;word-break:break-all'>{{magic_link}}</a>", "font-size:13px;margin-top:20px")}
  ${divider()}
  ${bodyText("<strong>Non hai richiesto questo?</strong><br>Puoi ignorare questa email. Il link scadrà automaticamente.", "font-size:13px;color:#9ca3af")}
  `,
);

// password_changed requires {{primary_email_address}} variable in the body
const PASSWORD_CHANGED_BODY = wrapEmail(
  "La tua password QuoteAI è stata modificata",
  "La password del tuo account QuoteAI è stata modificata con successo.",
  `
  ${heading("Password modificata")}
  ${bodyText("Ti informiamo che la password dell'account <strong>{{primary_email_address}}</strong> su QuoteAI è stata modificata con successo.")}
  ${bodyText("Se sei stato tu a effettuare questa modifica, non è necessario fare nient'altro.")}
  ${divider()}
  ${bodyText("<strong>Non sei stato tu?</strong><br>Se non hai modificato la password, contatta immediatamente il supporto su <a href='mailto:supporto@quoteai.ca' style='color:#7c3aed'>supporto@quoteai.ca</a> o reimposta la password accedendo a QuoteAI.", "font-size:13px;color:#9ca3af")}
  `,
);

const NEW_DEVICE_BODY = wrapEmail(
  "Nuovo accesso al tuo account QuoteAI",
  "È stato rilevato un accesso da un nuovo dispositivo al tuo account QuoteAI.",
  `
  ${heading("Nuovo accesso rilevato")}
  ${bodyText("È stato effettuato un accesso al tuo account QuoteAI da un nuovo dispositivo o browser.")}
  ${divider()}
  ${bodyText("<strong>Non sei stato tu?</strong><br>Se non riconosci questo accesso, contatta immediatamente il supporto su <a href='mailto:supporto@quoteai.ca' style='color:#7c3aed'>supporto@quoteai.ca</a> e modifica la password.", "font-size:13px;color:#9ca3af")}
  `,
);

const INVITATION_BODY = wrapEmail(
  "Sei stato invitato su QuoteAI",
  "Hai ricevuto un invito per accedere a QuoteAI.",
  `
  ${heading("Sei stato invitato!")}
  ${bodyText("Hai ricevuto un invito per accedere a QuoteAI — la piattaforma AI per creare preventivi professionali in pochi secondi.")}
  ${primaryButton("Accetta invito →", "{{action_url}}")}
  ${bodyText("Se il pulsante non funziona, copia e incolla questo link nel browser:<br><a href='{{action_url}}' style='color:#7c3aed;word-break:break-all'>{{action_url}}</a>", "font-size:13px;margin-top:20px")}
  `,
);

// ─── Template Definitions ─────────────────────────────────────────────────────

type TemplateUpdate = {
  slug: string;
  name: string;
  subject: string;
  fromEmailName: string;
  body: string;
  markup?: string;
};

const TEMPLATE_UPDATES: TemplateUpdate[] = [
  {
    slug: "verification_code",
    name: "Verification code",
    subject: "{{otp_code}} è il tuo codice di verifica – QuoteAI",
    fromEmailName: "QuoteAI",
    body: VERIFICATION_CODE_BODY,
  },
  {
    slug: "reset_password_code",
    name: "Reset password code",
    subject: "{{otp_code}} è il tuo codice per reimpostare la password – QuoteAI",
    fromEmailName: "QuoteAI",
    body: RESET_PASSWORD_BODY,
  },
  {
    slug: "magic_link_sign_in",
    name: "Email link - Sign in",
    subject: "Il tuo link per accedere a QuoteAI",
    fromEmailName: "QuoteAI",
    body: MAGIC_LINK_SIGN_IN_BODY,
  },
  {
    slug: "magic_link_sign_up",
    name: "Email link - Sign up",
    subject: "Il tuo link per registrarti su QuoteAI",
    fromEmailName: "QuoteAI",
    body: MAGIC_LINK_SIGN_UP_BODY,
  },
  {
    slug: "magic_link_user_profile",
    name: "Email link - Verify email",
    subject: "Verifica il tuo indirizzo email – QuoteAI",
    fromEmailName: "QuoteAI",
    body: MAGIC_LINK_VERIFY_EMAIL_BODY,
  },
  {
    slug: "password_changed",
    name: "Password changed",
    subject: "La tua password QuoteAI è stata modificata",
    fromEmailName: "QuoteAI",
    body: PASSWORD_CHANGED_BODY,
  },
  {
    slug: "new_device_sign_in",
    name: "Sign in from new device",
    subject: "Nuovo accesso al tuo account QuoteAI",
    fromEmailName: "QuoteAI",
    body: NEW_DEVICE_BODY,
  },
  {
    slug: "invitation",
    name: "Invitation",
    subject: "Sei stato invitato su QuoteAI",
    fromEmailName: "QuoteAI",
    body: INVITATION_BODY,
  },
];

// ─── API Helpers ──────────────────────────────────────────────────────────────

async function clerkGet(slug: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${CLERK_API_BASE}/${slug}`, {
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` },
  });
  return res.json() as Promise<Record<string, unknown>>;
}

async function clerkPut(slug: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${CLERK_API_BASE}/${slug}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<Record<string, unknown>>;
}

async function applyTemplate(update: TemplateUpdate): Promise<void> {
  // Fetch current template to verify it exists and get its markup if we don't override it
  const current = await clerkGet(update.slug);

  if (!current["name"]) {
    console.log(`  SKIP  ${update.slug} — not available in this instance`);
    return;
  }

  const payload: Record<string, unknown> = {
    name: update.name,
    subject: update.subject,
    from_email_name: update.fromEmailName,
    body: update.body,
  };

  // Include markup if we have a custom one, otherwise preserve existing
  if (update.markup) {
    payload["markup"] = update.markup;
  } else if (current["markup"]) {
    payload["markup"] = current["markup"];
  }

  const result = await clerkPut(update.slug, payload);

  if (result["slug"]) {
    console.log(`  OK    ${update.slug}`);
    console.log(`        subject:   ${result["subject"]}`);
    console.log(`        from_name: ${result["from_email_name"]}`);
    console.log(`        is_custom: ${result["is_custom"]}`);
  } else {
    const errors = result["errors"] ?? result;
    console.error(`  ERR   ${update.slug}: ${JSON.stringify(errors)}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const keyPrefix = CLERK_SECRET_KEY!.slice(0, 10);
  const env = CLERK_SECRET_KEY!.startsWith("sk_live_") ? "PRODUCTION" : "development";
  console.log(`\nApplying QuoteAI email branding to Clerk ${env} instance (key: ${keyPrefix}...)\n`);

  for (const update of TEMPLATE_UPDATES) {
    await applyTemplate(update);
    console.log();
  }

  console.log("Done. Re-run with sk_live_* key to apply to production instance.");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
