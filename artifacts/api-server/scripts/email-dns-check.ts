// Phase 65 — email deliverability: SPF / DKIM / DMARC for the sending domain.
//
//   node scripts/email-dns-check.ts [domain]        (default: quoteai.ca)
//
// Every transactional email is sent by Resend from `no-reply@<domain>`
// (src/lib/email*.ts). Resend verifies a domain with three records:
//   • MX + TXT on `send.<domain>`        (bounce/return-path, SPF: amazonses.com)
//   • TXT on `resend._domainkey.<domain>` (DKIM public key)
// and recommends a `_dmarc.<domain>` policy. Nothing here can be fixed in
// code — it is read-only and prints a pass/fail table for the DNS owner.

import { promises as dns } from "node:dns";

const domain = process.argv[2] ?? "quoteai.ca";

async function txt(name: string): Promise<string[]> {
  try {
    return (await dns.resolveTxt(name)).map((chunks) => chunks.join(""));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOTFOUND" || code === "ENODATA") return [];
    throw err;
  }
}
async function mx(name: string): Promise<string[]> {
  try {
    return (await dns.resolveMx(name)).sort((a, b) => a.priority - b.priority).map((m) => `${m.priority} ${m.exchange}`);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOTFOUND" || code === "ENODATA") return [];
    throw err;
  }
}

type Row = { check: string; ok: boolean; detail: string };
const rows: Row[] = [];

const apexSpf = (await txt(domain)).filter((t) => t.toLowerCase().startsWith("v=spf1"));
rows.push({ check: `SPF on ${domain}`, ok: apexSpf.length === 1, detail: apexSpf.join(" || ") || "missing (any receiver applying SPF to the From domain will soft-fail)" });
if (apexSpf.length > 1) rows[rows.length - 1]!.detail += " — MORE THAN ONE SPF RECORD (permerror)";

const sendSpf = (await txt(`send.${domain}`)).filter((t) => t.toLowerCase().startsWith("v=spf1"));
rows.push({ check: `SPF on send.${domain} (Resend return-path)`, ok: sendSpf.some((t) => /include:amazonses\.com/i.test(t)), detail: sendSpf.join(" || ") || "missing" });

const sendMx = await mx(`send.${domain}`);
rows.push({ check: `MX on send.${domain}`, ok: sendMx.some((m) => /amazonses\.com/i.test(m)), detail: sendMx.join(", ") || "missing" });

const dkim = await txt(`resend._domainkey.${domain}`);
rows.push({ check: `DKIM resend._domainkey.${domain}`, ok: dkim.some((t) => /p=[A-Za-z0-9+/=]{100,}/.test(t)), detail: dkim.length ? `${dkim[0]!.slice(0, 60)}…` : "missing" });

const dmarc = (await txt(`_dmarc.${domain}`)).filter((t) => t.toLowerCase().startsWith("v=dmarc1"));
const policy = /p=(none|quarantine|reject)/i.exec(dmarc[0] ?? "")?.[1]?.toLowerCase();
rows.push({ check: `DMARC _dmarc.${domain}`, ok: !!policy, detail: dmarc[0] ?? "missing (Gmail/Yahoo bulk-sender rules require a DMARC record since Feb 2024)" });
if (policy === "none") rows.push({ check: "DMARC policy strength", ok: true, detail: "p=none — monitoring only; move to quarantine/reject once reports are clean" });

const apexMx = await mx(domain);
rows.push({ check: `MX on ${domain} (replies to reply-to addresses land somewhere)`, ok: apexMx.length > 0, detail: apexMx.join(", ") || "none — replies to no-reply@ bounce, fine; contractor Reply-To is their own domain" });

const width = Math.max(...rows.map((r) => r.check.length));
for (const r of rows) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.check.padEnd(width)}  ${r.detail}`);
const failed = rows.filter((r) => !r.ok);
console.log(`\n${rows.length - failed.length}/${rows.length} checks passed for ${domain}`);
process.exitCode = failed.length ? 1 : 0;
