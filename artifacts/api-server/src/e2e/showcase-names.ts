// Sample-company names shared by store:shots and pocket:seed: the e2e fixture's test names
// swapped for people a Canadian contractor would really have as clients and crew.

// The fixture's test names → people a contractor would have as clients and crew.
export const NAMES: Record<"en" | "fr", Array<[string, string]>> = {
  en: [
    ["Jordan Client", "Sarah Chen"], ["Casey Pending", "Mike Thompson"], ["Morgan Longlist", "Priya Patel"],
    ["Alex Morin", "David Wilson"], ["Pat Worker", "Luis Martinez"], ["Pay Client", "Emily Roberts"], ["Client Ave", "Maple Ave"], ["Longlist Rd", "Birchwood Rd"],
    ["client@e2e-test.invalid", "sarah.chen@example.com"], ["pending@e2e-test.invalid", "mike.thompson@example.com"],
    ["longlist@e2e-test.invalid", "priya.patel@example.com"], ["alex@e2e-test.invalid", "d.wilson@example.com"],
    ["e2e-test.invalid", "example.com"], ["example.invalid", "example.com"],
  ],
  fr: [
    ["Jordan Client", "Isabelle Gagnon"], ["Casey Pending", "Marc Pelletier"], ["Robin Tremblay", "Sophie Bélanger"], ["Morgan Longlist", "Julie Lavoie"],
    ["Alex Morin", "Alexandre Roy"], ["Pat Worker", "Kevin Bouchard"], ["Pay Client", "Nathalie Bergeron"], ["Client Ave", "rue des Érables"], ["Kitchen renovation", "Rénovation de cuisine"], ["K1A 0B1", "H2V 1B7"], ["Longlist Rd", "boul. des Laurentides"],
    ["client@e2e-test.invalid", "isabelle.gagnon@example.com"], ["pending@e2e-test.invalid", "marc.pelletier@example.com"],
    ["longlist@e2e-test.invalid", "julie.lavoie@example.com"], ["alex@e2e-test.invalid", "alexandre.roy@example.com"],
    ["e2e-test.invalid", "example.com"], ["example.invalid", "example.com"],
  ],
};
export const COMPANY = { en: "Northside Renovations Ltd.", fr: "Rénovations Tremblay inc." };
// Each sample quote its own job, as a real list would have (was the generic default title on all of them).
export const JOBS: Record<"en" | "fr", Record<string, string>> = {
  en: { "Sarah Chen": "Kitchen renovation", "Mike Thompson": "Basement finishing", "Priya Patel": "Bathroom remodel", "David Wilson": "Deck and fence" },
  fr: { "Isabelle Gagnon": "Rénovation de cuisine", "Marc Pelletier": "Finition du sous-sol", "Julie Lavoie": "Rénovation de salle de bain", "Alexandre Roy": "Terrasse et clôture" },
};
export const OWNER = { en: "Alex Martin", fr: "Mathieu Côté" };

/** Swap the fixture's test names in every row this account owns (text and JSON columns). */
export async function realNames(userId: string, lang: "en" | "fr") {
  const { db } = await import("@workspace/db");
  const { sql } = await import("drizzle-orm");
  const cols = (await db.execute<{ table_name: string; column_name: string; data_type: string }>(sql`
    select c.table_name, c.column_name, c.data_type from information_schema.columns c
    where c.table_schema = 'public' and c.data_type in ('text', 'character varying', 'jsonb', 'json')
      and exists (select 1 from information_schema.columns u where u.table_schema = 'public' and u.table_name = c.table_name and u.column_name = 'user_id')
      and c.column_name <> 'user_id'`)).rows;
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  for (const [from, to] of NAMES[lang]) {
    for (const c of cols) {
      const cast = c.data_type === "jsonb" ? "::jsonb" : c.data_type === "json" ? "::json" : "";
      // JSON strings escape nothing in these values, so a plain text replace keeps the JSON valid.
      await db.execute(sql.raw(`update ${q(c.table_name)} set ${q(c.column_name)} = replace(${q(c.column_name)}::text, '${from.replace(/'/g, "''")}', '${to.replace(/'/g, "''")}')${cast} where user_id = '${userId.replace(/'/g, "''")}' and ${q(c.column_name)}::text like '%${from.replace(/'/g, "''")}%'`));
    }
  }
  await db.execute(sql`update auth_user set name = ${OWNER[lang]} where id = ${userId}`);
  for (const [client, job] of Object.entries(JOBS[lang])) {
    await db.execute(sql`update quotes set titolo_preventivo_riga1 = ${job}, descrizione_generale = ${job} where user_id = ${userId} and client_data->>'nome' = ${client}`);
  }
  // The crew's shift today: a normal working day (the fixture seeds it around the current time), and
  // nothing else booked over it for the same person (the board would flag a double booking).
  const moved = (await db.execute<{ id: string }>(sql`update schedule_blocks set starts_at = (date_trunc('day', now() at time zone 'America/Toronto') + interval '7 hours 30 minutes') at time zone 'America/Toronto', ends_at = (date_trunc('day', now() at time zone 'America/Toronto') + interval '16 hours') at time zone 'America/Toronto' where user_id = ${userId} and starts_at < now() and ends_at > now() returning id`)).rows;
  for (const m of moved) {
    await db.execute(sql`delete from schedule_blocks b using schedule_blocks m where m.id = ${m.id} and b.user_id = m.user_id and b.id <> m.id and b.collaborator_id = m.collaborator_id and b.starts_at < m.ends_at and b.ends_at > m.starts_at`);
  }
}

