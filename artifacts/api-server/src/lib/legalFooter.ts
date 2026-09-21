import { legalIdentityLines, LEGAL_ENTITY } from "@workspace/legal-entity";

// Phase 73: every email QuoteAI sends from quoteai.ca carries the registered
// entity's name, mailing address and tax numbers (CASL s.6(2) sender
// identification; Québec Law 25 / PIPEDA contact point). Applied at the
// Resend boundary (see emailUtils.brandedResend) so no template can forget it.
// Emails sent from a contractor's own connected Gmail are theirs, not ours,
// and are left alone.

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const MARKER = "data-quoteai-legal-footer";

function legalFooterHtml(): string {
  const en = legalIdentityLines("en");
  const fr = legalIdentityLines("fr");
  // Before O5 both languages collapse to the trade name; one line is enough.
  const lines = en.join(" · ") === fr.join(" · ") ? [en.join(" · ")] : [en.join(" · "), fr.join(" · ")];
  const contact = `${escapeHtml(LEGAL_ENTITY.website.replace(/^https?:\/\//, ""))} · ${escapeHtml(LEGAL_ENTITY.supportEmail)}`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ${MARKER}="1" style="margin-top:8px"><tr><td style="padding:12px 24px 20px;text-align:center;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.5;color:#9ca3af">${lines.map((l) => escapeHtml(l)).join("<br/>")}<br/>${contact}</td></tr></table>`;
}

/** Injects the legal footer just before `</body>` (or at the end of a bodiless fragment); idempotent. */
export function withLegalFooter(html: string): string {
  if (html.includes(MARKER)) return html;
  const footer = legalFooterHtml();
  const idx = html.lastIndexOf("</body>");
  if (idx === -1) return html + footer;
  return html.slice(0, idx) + footer + html.slice(idx);
}
