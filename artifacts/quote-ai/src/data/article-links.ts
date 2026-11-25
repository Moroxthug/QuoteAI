// SEO-RECOVERY-PLAN S4.4: every indexed blog article links one free calculator
// and one feature page, shown in a "Tools for this job" block under the body.
// generate-sitemap.ts fails the build if an indexed article has no entry here.
// Labels live here (not in tool-pages / feature-pages) so the article chunk
// doesn't pull in those pages' copy.
import { toolPath, featurePath, type ToolId, type FeatureId } from "./seo-slugs";

export const TOOL_LINK_LABELS: Record<ToolId, { name: string; desc: string }> = {
  salesTax: { name: "GST/HST, PST and QST calculator", desc: "Add or back out the right sales tax for any province." },
  holdback: { name: "Holdback calculator", desc: "The 10 % holdback on a progress bill and the tax when it is released." },
  markup: { name: "Markup and margin calculator", desc: "Turn a cost into a price, or check the margin a price leaves you." },
  labourRate: { name: "Labour rate calculator", desc: "The hourly rate that covers wages, burden, overhead and profit." },
};

export const FEATURE_LINK_LABELS: Record<FeatureId, { name: string; desc: string }> = {
  estimating: { name: "Estimating software", desc: "An itemized quote with the province's taxes, sent as a PDF." },
  invoicing: { name: "Invoicing software", desc: "Deposit, progress and final invoices from the accepted quote." },
  crm: { name: "Contractor CRM", desc: "Every lead in one pipeline, with follow-ups until it signs." },
  "job-costing": { name: "Job costing software", desc: "Budget against actual costs on every job, as it runs." },
  contracts: { name: "Contracts and e-signature", desc: "The contract built from the quote, signed online." },
};

export const ARTICLE_LINKS: Record<string, { tool: ToolId; feature: FeatureId }> = {
  "how-to-write-a-professional-quote-that-wins-jobs": { tool: "salesTax", feature: "estimating" },
  "how-to-price-a-job-labour-materials-markup": { tool: "markup", feature: "estimating" },
  "canada-greener-homes-grant-rebates-contractors-guide-2026": { tool: "salesTax", feature: "estimating" },
  "google-business-profile-guide-for-tradespeople": { tool: "markup", feature: "crm" },
  "how-to-get-more-reviews-as-a-contractor": { tool: "markup", feature: "crm" },
  "free-quote-template-for-contractors-canada": { tool: "salesTax", feature: "estimating" },
  "how-to-collect-payment-from-clients-contractor-canada": { tool: "holdback", feature: "invoicing" },
  "contractor-insurance-canada-what-you-need": { tool: "labourRate", feature: "job-costing" },
  "how-to-write-a-contractor-contract-canada": { tool: "holdback", feature: "contracts" },
  "how-to-handle-change-orders-contractors": { tool: "markup", feature: "contracts" },
  "how-to-hire-and-pay-subcontractors-canada": { tool: "holdback", feature: "job-costing" },
  "how-to-scale-a-contracting-business-canada": { tool: "labourRate", feature: "crm" },
  "how-to-track-job-costs-contractors": { tool: "markup", feature: "job-costing" },
  "construction-project-management-small-contractors": { tool: "labourRate", feature: "job-costing" },
  "contractor-cash-flow-management-canada": { tool: "holdback", feature: "invoicing" },
  "how-to-quote-a-painting-job": { tool: "labourRate", feature: "estimating" },
  "how-to-quote-a-roofing-job": { tool: "markup", feature: "estimating" },
  "how-to-quote-an-electrical-job": { tool: "labourRate", feature: "estimating" },
  "how-to-quote-a-plumbing-job": { tool: "labourRate", feature: "estimating" },
  "quote-vs-estimate-vs-invoice-difference": { tool: "salesTax", feature: "invoicing" },
  "how-to-quote-a-landscaping-job": { tool: "markup", feature: "estimating" },
  "how-to-quote-an-hvac-job": { tool: "salesTax", feature: "estimating" },
  "how-to-quote-a-tiling-job": { tool: "markup", feature: "estimating" },
  "how-to-raise-your-prices-contractors-without-losing-clients": { tool: "markup", feature: "estimating" },
  "how-to-hire-your-first-employee-contractor-canada": { tool: "labourRate", feature: "job-costing" },
  "how-to-follow-up-on-quotes-contractors": { tool: "markup", feature: "crm" },
  "how-to-quote-a-carpentry-job": { tool: "labourRate", feature: "estimating" },
  "how-to-quote-a-welding-or-metal-fabrication-job": { tool: "markup", feature: "estimating" },
  "how-to-quote-a-masonry-job": { tool: "labourRate", feature: "estimating" },
  "how-to-quote-a-window-or-door-installation-job": { tool: "salesTax", feature: "contracts" },
  "how-to-get-more-jobs-as-a-contractor-canada": { tool: "labourRate", feature: "crm" },
  "hst-on-renovation-quotes-ontario": { tool: "salesTax", feature: "invoicing" },
  "holdback-rules-by-province-canada": { tool: "holdback", feature: "invoicing" },
};

export function articleToolLinks(slug: string) {
  const l = ARTICLE_LINKS[slug];
  if (!l) return null;
  return {
    tool: { href: toolPath("en", l.tool), ...TOOL_LINK_LABELS[l.tool] },
    feature: { href: featurePath("en", l.feature), ...FEATURE_LINK_LABELS[l.feature] },
  };
}
