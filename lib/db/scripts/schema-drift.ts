// Phase 63 (docs/QA-VERIFICATION-PLAN.md): schema-vs-database drift check.
//
// Compares what `src/schema/*.ts` declares against what a real Postgres
// database actually has: tables, columns (type / nullability / default),
// enums, primary keys, foreign keys, unique constraints and indexes.
//
// Two input modes:
//   DATABASE_URL=postgres://...  node --experimental-strip-types scripts/schema-drift.ts
//     — introspects the live database directly.
//   node --experimental-strip-types scripts/schema-drift.ts --from-dump <dir>
//     — reads db-columns.json / db-enums.json / db-constraints.json /
//       db-indexes.json produced by `supabase db query --linked` (the JSON
//       envelope it prints, with the queries in the header of each function
//       below). Used when a raw connection string is not available locally.
//
// Exit code 1 when anything in the schema is missing from the database
// (that is the dangerous direction: code will write to a column that isn't
// there). Extra columns/tables/indexes in the DB are reported but do not
// fail — they are leftovers, not breakage.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getTableConfig, isPgEnum, PgEnumColumn, PgTable } from "drizzle-orm/pg-core";
import { is } from "drizzle-orm";
import * as schema from "../src/schema/index.ts";

type DbColumn = {
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: "YES" | "NO";
  column_default: string | null;
};
type DbEnum = { enum_name: string; labels: string };
type DbConstraint = {
  table_name: string;
  constraint_type: "PRIMARY KEY" | "FOREIGN KEY" | "UNIQUE";
  column_name: string;
  ref_table: string | null;
  ref_column: string | null;
};
type DbIndex = { tablename: string; indexname: string; indexdef: string };

type Db = { columns: DbColumn[]; enums: DbEnum[]; constraints: DbConstraint[]; indexes: DbIndex[] };

const SQL = {
  columns:
    "select table_name, column_name, data_type, udt_name, is_nullable, column_default from information_schema.columns where table_schema='public' order by table_name, ordinal_position",
  enums:
    "select t.typname as enum_name, string_agg(e.enumlabel, ',' order by e.enumsortorder) as labels from pg_type t join pg_enum e on e.enumtypid=t.oid join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' group by t.typname",
  constraints:
    "select tc.table_name, tc.constraint_type, kcu.column_name, ccu.table_name as ref_table, ccu.column_name as ref_column from information_schema.table_constraints tc join information_schema.key_column_usage kcu on kcu.constraint_name=tc.constraint_name and kcu.table_schema=tc.table_schema left join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name and tc.constraint_type='FOREIGN KEY' where tc.table_schema='public' and tc.constraint_type in ('PRIMARY KEY','FOREIGN KEY','UNIQUE') order by 1,2,3",
  indexes: "select tablename, indexname, indexdef from pg_indexes where schemaname='public' order by 1,2",
};

function readDump<T>(dir: string, name: string): T[] {
  // `supabase db query` prints a "Initialising login role..." line before
  // the JSON envelope; strip anything before the first "{".
  const raw = readFileSync(join(dir, name), "utf8");
  const json = raw.slice(raw.indexOf("{"));
  return JSON.parse(json).rows as T[];
}

async function loadDb(): Promise<Db> {
  const fromDump = process.argv.indexOf("--from-dump");
  if (fromDump !== -1) {
    const dir = process.argv[fromDump + 1];
    if (!dir) throw new Error("--from-dump needs a directory");
    return {
      columns: readDump(dir, "db-columns.json"),
      enums: readDump(dir, "db-enums.json"),
      constraints: readDump(dir, "db-constraints.json"),
      indexes: readDump(dir, "db-indexes.json"),
    };
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL or --from-dump <dir> required");
  const { Client } = await import("pg");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const q = async <T,>(sql: string) => (await client.query<T>(sql)).rows;
    return {
      columns: await q<DbColumn>(SQL.columns),
      enums: await q<DbEnum>(SQL.enums),
      constraints: await q<DbConstraint>(SQL.constraints),
      indexes: await q<DbIndex>(SQL.indexes),
    };
  } finally {
    await client.end();
  }
}

// Map a drizzle column's SQL type to what information_schema reports.
function normalizeSchemaType(sqlType: string): string {
  const t = sqlType.toLowerCase();
  if (t.startsWith("varchar")) return "character varying";
  if (t.startsWith("timestamp")) return t.includes("with time zone") ? "timestamp with time zone" : "timestamp without time zone";
  if (t === "serial") return "integer";
  if (t === "bigserial") return "bigint";
  if (t.startsWith("numeric")) return "numeric";
  if (t.endsWith("[]")) return "ARRAY";
  if (t === "real") return "real";
  if (t === "double precision") return "double precision";
  return t;
}

function normalizeDbType(c: DbColumn): string {
  if (c.data_type === "USER-DEFINED") return c.udt_name; // enum name
  return c.data_type;
}

function main(db: Db) {
  const missing: string[] = []; // fatal
  const extra: string[] = []; // informational
  const mismatch: string[] = []; // fatal

  const dbTables = new Map<string, DbColumn[]>();
  for (const c of db.columns) {
    if (!dbTables.has(c.table_name)) dbTables.set(c.table_name, []);
    dbTables.get(c.table_name)!.push(c);
  }
  const dbEnums = new Map(db.enums.map((e) => [e.enum_name, e.labels.split(",")]));
  const dbIndexNames = new Set(db.indexes.map((i) => i.indexname));
  const dbPk = new Set(db.constraints.filter((c) => c.constraint_type === "PRIMARY KEY").map((c) => `${c.table_name}.${c.column_name}`));
  const dbFk = new Set(
    db.constraints
      .filter((c) => c.constraint_type === "FOREIGN KEY")
      .map((c) => `${c.table_name}.${c.column_name} -> ${c.ref_table}.${c.ref_column}`),
  );
  const dbUnique = new Set(db.constraints.filter((c) => c.constraint_type === "UNIQUE").map((c) => `${c.table_name}.${c.column_name}`));

  const schemaTables = new Set<string>();
  const schemaEnums = new Map<string, readonly string[]>();
  const schemaIndexNames = new Set<string>();

  for (const [exportName, value] of Object.entries(schema)) {
    if (isPgEnum(value)) {
      schemaEnums.set(value.enumName, value.enumValues);
      continue;
    }
    if (!is(value, PgTable)) continue;
    let cfg: ReturnType<typeof getTableConfig>;
    try {
      cfg = getTableConfig(value);
    } catch {
      continue;
    }
    schemaTables.add(cfg.name);
    const dbCols = dbTables.get(cfg.name);
    if (!dbCols) {
      missing.push(`table ${cfg.name} (export ${exportName})`);
      continue;
    }
    const dbByName = new Map(dbCols.map((c) => [c.column_name, c]));

    for (const col of cfg.columns) {
      const dbc = dbByName.get(col.name);
      if (!dbc) {
        missing.push(`column ${cfg.name}.${col.name} (${col.getSQLType()})`);
        continue;
      }
      const want = is(col, PgEnumColumn) ? (col as unknown as { enum: { enumName: string } }).enum.enumName : normalizeSchemaType(col.getSQLType());
      const have = normalizeDbType(dbc);
      if (want !== have) mismatch.push(`type ${cfg.name}.${col.name}: schema=${want} db=${have}`);
      const wantNullable = !col.notNull && !col.primary;
      const haveNullable = dbc.is_nullable === "YES";
      if (wantNullable !== haveNullable)
        mismatch.push(`nullability ${cfg.name}.${col.name}: schema=${wantNullable ? "null" : "not null"} db=${haveNullable ? "null" : "not null"}`);
      const wantsDefault = col.hasDefault && col.default !== undefined;
      if (wantsDefault && dbc.column_default === null && !col.primary)
        mismatch.push(`default ${cfg.name}.${col.name}: schema has a default, db has none`);
      if (col.primary && !dbPk.has(`${cfg.name}.${col.name}`)) missing.push(`primary key ${cfg.name}.${col.name}`);
    }
    for (const c of dbCols) {
      if (!cfg.columns.some((col) => col.name === c.column_name)) extra.push(`column ${cfg.name}.${c.column_name}`);
    }

    for (const pk of cfg.primaryKeys) {
      for (const col of pk.columns) if (!dbPk.has(`${cfg.name}.${col.name}`)) missing.push(`primary key ${cfg.name}.${col.name}`);
    }
    for (const fk of cfg.foreignKeys) {
      const ref = fk.reference();
      ref.columns.forEach((col, i) => {
        const key = `${cfg.name}.${col.name} -> ${getTableConfig(ref.foreignTable).name}.${ref.foreignColumns[i]!.name}`;
        if (!dbFk.has(key)) missing.push(`foreign key ${key}`);
      });
    }
    for (const col of cfg.columns) {
      if (col.isUnique && !dbUnique.has(`${cfg.name}.${col.name}`) && !col.primary) {
        // drizzle `.unique()` becomes a UNIQUE constraint; accept a unique index too.
        const hasIdx = db.indexes.some((i) => i.tablename === cfg.name && /UNIQUE/.test(i.indexdef) && i.indexdef.includes(`(${col.name})`));
        if (!hasIdx) missing.push(`unique ${cfg.name}.${col.name}`);
      }
    }
    for (const u of cfg.uniqueConstraints) {
      const name = u.getName();
      if (name && !dbIndexNames.has(name)) missing.push(`unique constraint ${cfg.name}.${name}`);
    }
    for (const idx of cfg.indexes) {
      const name = idx.config.name;
      if (!name) continue;
      schemaIndexNames.add(name);
      if (!dbIndexNames.has(name)) missing.push(`index ${name} on ${cfg.name}`);
    }
  }

  for (const [name, labels] of schemaEnums) {
    const have = dbEnums.get(name);
    if (!have) {
      missing.push(`enum ${name}`);
      continue;
    }
    for (const l of labels) if (!have.includes(l)) missing.push(`enum value ${name}.${l}`);
    for (const l of have) if (!labels.includes(l)) extra.push(`enum value ${name}.${l}`);
  }
  for (const name of dbEnums.keys()) if (!schemaEnums.has(name)) extra.push(`enum ${name}`);
  for (const name of dbTables.keys()) if (!schemaTables.has(name)) extra.push(`table ${name}`);
  for (const i of db.indexes) {
    if (!schemaTables.has(i.tablename)) continue;
    if (i.indexname.endsWith("_pkey") || i.indexname.endsWith("_key") || i.indexname.endsWith("_unique")) continue;
    if (!schemaIndexNames.has(i.indexname)) extra.push(`index ${i.indexname} on ${i.tablename}`);
  }

  const print = (title: string, list: string[]) => {
    console.log(`\n${title} (${list.length})`);
    for (const l of list.sort()) console.log(`  ${l}`);
  };
  console.log(`schema: ${schemaTables.size} tables, ${schemaEnums.size} enums · db: ${dbTables.size} tables, ${dbEnums.size} enums`);
  print("MISSING IN DB — fatal", missing);
  print("MISMATCH — fatal", mismatch);
  print("EXTRA IN DB — informational", extra);
  if (missing.length || mismatch.length) process.exit(1);
}

main(await loadDb());
