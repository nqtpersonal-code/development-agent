import { runtimeRequire } from './runtime.mjs';

// Read-only catalog queries for PostgreSQL (all non-system schemas).
export async function readPg(url, dataDir) {
  const { Client } = runtimeRequire(dataDir, 'pg');
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    const cols = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_name, ordinal_position`);
    const fks = await client.query(`
      SELECT tc.table_name AS from_table, kcu.column_name AS from_column,
             ccu.table_name AS to_table, ccu.column_name AS to_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'`);
    const views = await client.query(`
      SELECT table_name AS name, view_definition AS sql FROM information_schema.views
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')`);
    const triggers = await client.query(`
      SELECT trigger_name AS name, event_object_table AS table, action_statement AS sql
      FROM information_schema.triggers`);
    return {
      engine: 'postgres',
      columns: cols.rows,
      fks: fks.rows,
      views: views.rows,
      triggers: triggers.rows,
    };
  } finally {
    await client.end();
  }
}
