import { parseDbUrl, assertLocalDb } from './localhost.mjs';
import { readPg } from './schema-pg.mjs';
import { readMysql } from './schema-mysql.mjs';
import { singular } from './names.mjs';

const rel = (fromTable, fromColumn, toTable, toColumn, source, evidence) => ({
  from: { table: fromTable, column: fromColumn },
  to: { table: toTable, column: toColumn },
  source,
  ...(evidence ? { evidence } : {}),
});

export async function readSchema(url, dataDir, { confirmedLocalHosts = [] } = {}) {
  assertLocalDb(url, confirmedLocalHosts);
  const { engine } = parseDbUrl(url);
  const raw = engine === 'postgres' ? await readPg(url, dataDir)
    : engine === 'mysql' ? await readMysql(url, dataDir)
    : null;
  if (!raw) throw new Error(`unsupported DB engine for schema reading: ${engine} (text search still works)`);
  const tables = new Map();
  for (const c of raw.columns) {
    if (!tables.has(c.table_name)) tables.set(c.table_name, { name: c.table_name, columns: [] });
    tables.get(c.table_name).columns.push({ name: c.column_name, type: c.data_type, nullable: c.is_nullable === 'YES' });
  }
  const schema = {
    engine: raw.engine,
    tables: [...tables.values()],
    fks: raw.fks.map((f) => rel(f.from_table, f.from_column, f.to_table, f.to_column, 'fk')),
    views: raw.views,
    triggers: raw.triggers,
  };
  schema.implicit = implicitRelations(schema);
  return schema;
}

// Columns named <x>_id / <x>Id / <x>_ref pointing at an existing table <x> or
// its plural, when no FK already covers them.
export function implicitRelations(schema, codeJoins = []) {
  const names = new Set(schema.tables.map((t) => t.name));
  const bySingular = new Map(schema.tables.map((t) => [singular(t.name.toLowerCase()), t.name]));
  const covered = new Set(schema.fks.map((f) => `${f.from.table}.${f.from.column}`));
  const out = [];
  for (const t of schema.tables) {
    for (const c of t.columns) {
      if (covered.has(`${t.name}.${c.name}`)) continue;
      const m = /^(.+?)(?:_id|Id|_ref|Ref)$/.exec(c.name);
      if (!m) continue;
      const base = m[1].toLowerCase();
      const target = names.has(base) ? base : bySingular.get(singular(base));
      if (!target || target === t.name && base === t.name) continue;
      out.push(rel(t.name, c.name, target, 'id', 'naming'));
    }
  }
  for (const j of codeJoins) if (!covered.has(`${j.from.table}.${j.from.column}`)) out.push({ ...j, source: 'sql-join' });
  return out;
}

// Breadth-first walk over FK + implicit relations in both directions.
export function relatedTables(schema, table, maxDepth = 4) {
  const rels = [...schema.fks, ...(schema.implicit ?? [])];
  const seen = new Map([[table, []]]);
  let frontier = [table];
  for (let depth = 0; depth < maxDepth && frontier.length; depth++) {
    const next = [];
    for (const cur of frontier) {
      for (const r of rels) {
        const other = r.from.table === cur ? r.to.table : r.to.table === cur ? r.from.table : null;
        if (!other || seen.has(other)) continue;
        seen.set(other, [...seen.get(cur), r]);
        next.push(other);
      }
    }
    frontier = next;
  }
  seen.delete(table);
  return [...seen.entries()].map(([t, path]) => ({ table: t, path }));
}
