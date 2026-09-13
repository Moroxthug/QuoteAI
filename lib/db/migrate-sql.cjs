// One-off runner: applies a .sql migration file to the database in DATABASE_URL
// inside a transaction. Usage: node migrate-sql.cjs <env-file> <sql-file>
const fs = require("fs");
const pg = require("pg");

const env = fs.readFileSync(process.argv[2], "utf8");
const m = env.match(/^DATABASE_URL="?([^"\r\n]+)"?/m);
if (!m) {
  console.error("no DATABASE_URL in env file");
  process.exit(1);
}
const sql = fs.readFileSync(process.argv[3], "utf8");
const client = new pg.Client({ connectionString: m[1], ssl: { rejectUnauthorized: false } });

(async () => {
  await client.connect();
  console.log("connected to", new URL(m[1]).host);
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("COMMIT");
    console.log("migration applied");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("FAILED, rolled back:", e.message);
    process.exit(1);
  }
  const t = await client.query("select table_name from information_schema.tables where table_name in ('milestones','cost_budget_lines','change_orders') order by 1");
  console.log("tables:", t.rows.map((x) => x.table_name).join(", "));
  const c = await client.query("select column_name from information_schema.columns where table_name='contracts' and column_name in ('kind','parent_contract_id','change_order_id') order by 1");
  console.log("contracts columns:", c.rows.map((x) => x.column_name).join(", "));
  const p = await client.query("select count(*)::int as n from projects");
  console.log("projects rows:", p.rows[0].n);
  await client.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
