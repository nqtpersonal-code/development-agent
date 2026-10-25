import { walkFiles, readText } from './files.mjs';

const add = (map, key, value) => {
  if (!map[key]) map[key] = [];
  if (!map[key].includes(value)) map[key].push(value);
};

// EF Core naming: which entity/DbSet names stand for a table, and which
// property names stand for a column (ToTable, [Table], HasColumnName, [Column]).
// Unmapped DbSets keep EF's default table name (the DbSet property name).
export function efMappings(roots) {
  const files = roots.flatMap((r) => [...walkFiles(r)].filter((p) => p.endsWith('.cs'))).map((p) => readText(p) ?? '');
  const sets = {}; // entity -> DbSet names
  const tableOf = {}; // entity -> table
  for (const t of files) {
    for (const m of t.matchAll(/DbSet<(\w+)>\s+(\w+)/g)) add(sets, m[1], m[2]);
    for (const m of t.matchAll(/Entity<(\w+)>\(\)\s*\.ToTable\(\s*"([^"]+)"/g)) tableOf[m[1]] = m[2];
    for (const m of t.matchAll(/\[Table\(\s*"([^"]+)"[^\]]*\]\s*(?:\[[^\]]*\]\s*)*(?:public|internal)?\s*(?:sealed\s+|partial\s+)*class\s+(\w+)/g)) tableOf[m[2]] = m[1];
  }
  const tables = {};
  for (const [entity, names] of Object.entries(sets)) {
    const table = tableOf[entity] ?? names[0];
    add(tables, table, entity);
    for (const n of names) add(tables, table, n);
  }
  for (const [entity, table] of Object.entries(tableOf)) add(tables, table, entity);
  const columns = {};
  for (const t of files) {
    for (const m of t.matchAll(/Entity<(\w+)>\(\)\s*\.Property\(\s*\w+\s*=>\s*\w+\.(\w+)\s*\)\s*\.HasColumnName\(\s*"([^"]+)"/g)) {
      add(columns, `${tableOf[m[1]] ?? sets[m[1]]?.[0] ?? m[1]}.${m[3]}`, m[2]);
    }
    let currentClass = null;
    let pendingColumn = null;
    for (const line of t.split(/\r?\n/)) {
      const cls = /\bclass\s+(\w+)/.exec(line);
      if (cls) currentClass = cls[1];
      const col = /\[Column\(\s*"([^"]+)"/.exec(line);
      if (col) pendingColumn = col[1];
      const prop = /\bpublic\s+[\w<>?,\[\]. ]+\s+(\w+)\s*\{\s*get/.exec(line);
      if (prop && pendingColumn && currentClass) {
        add(columns, `${tableOf[currentClass] ?? sets[currentClass]?.[0] ?? currentClass}.${pendingColumn}`, prop[1]);
        pendingColumn = null;
      }
    }
  }
  return { tables, columns };
}

// Case-insensitive lookup helpers for analysis.
export function efNamesForTable(ef, table) {
  const k = Object.keys(ef.tables).find((t) => t.toLowerCase() === String(table).toLowerCase());
  return k ? ef.tables[k] : [];
}

export function efNamesForColumn(ef, table, column) {
  const want = `${table}.${column}`.toLowerCase();
  const k = Object.keys(ef.columns).find((c) => c.toLowerCase() === want);
  return k ? ef.columns[k] : [];
}
