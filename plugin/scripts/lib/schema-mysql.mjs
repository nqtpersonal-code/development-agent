import { runtimeRequire } from './runtime.mjs';

// Read-only information_schema queries for MySQL/MariaDB (current database).
export async function readMysql(url, dataDir) {
  const mysql = runtimeRequire(dataDir, 'mysql2/promise');
  const conn = await mysql.createConnection({ uri: url, connectTimeout: 5000 });
  try {
    const [cols] = await conn.query(`
      SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name, DATA_TYPE AS data_type, IS_NULLABLE AS is_nullable
      FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME, ORDINAL_POSITION`);
    const [fks] = await conn.query(`
      SELECT TABLE_NAME AS from_table, COLUMN_NAME AS from_column,
             REFERENCED_TABLE_NAME AS to_table, REFERENCED_COLUMN_NAME AS to_column
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL`);
    const [views] = await conn.query(`
      SELECT TABLE_NAME AS name, VIEW_DEFINITION AS \`sql\` FROM information_schema.VIEWS WHERE TABLE_SCHEMA = DATABASE()`);
    const [triggers] = await conn.query(`
      SELECT TRIGGER_NAME AS name, EVENT_OBJECT_TABLE AS \`table\`, ACTION_STATEMENT AS \`sql\`
      FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE()`);
    return { engine: 'mysql', columns: cols, fks, views, triggers };
  } finally {
    await conn.end();
  }
}
