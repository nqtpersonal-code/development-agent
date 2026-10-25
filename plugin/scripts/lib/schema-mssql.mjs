import { runtimeRequire } from './runtime.mjs';

// Read-only catalog queries for SQL Server, including stored procedure, view
// and trigger definitions (business logic often lives there in .NET shops).
export async function readMssql(url, dataDir) {
  const sql = runtimeRequire(dataDir, 'mssql');
  const u = new URL(url);
  const pool = await new sql.ConnectionPool({
    server: u.hostname,
    port: u.port ? Number(u.port) : 1433,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.replace(/^\//, '')),
    options: { encrypt: false, trustServerCertificate: true },
    connectionTimeout: 5000,
  }).connect();
  try {
    const q = async (text) => (await pool.request().query(text)).recordset;
    const columns = await q(`
      SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name, DATA_TYPE AS data_type, IS_NULLABLE AS is_nullable
      FROM INFORMATION_SCHEMA.COLUMNS c
      WHERE EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES t WHERE t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_TYPE = 'BASE TABLE')
      ORDER BY TABLE_NAME, ORDINAL_POSITION`);
    const fks = await q(`
      SELECT tp.name AS from_table, cp.name AS from_column, tr.name AS to_table, cr.name AS to_column
      FROM sys.foreign_key_columns fkc
      JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
      JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
      JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
      JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id`);
    const views = await q('SELECT name, OBJECT_DEFINITION(object_id) AS sql FROM sys.views');
    const triggers = await q('SELECT t.name, OBJECT_NAME(t.parent_id) AS [table], OBJECT_DEFINITION(t.object_id) AS sql FROM sys.triggers t');
    const procedures = await q('SELECT name, OBJECT_DEFINITION(object_id) AS sql FROM sys.procedures');
    return { engine: 'sqlserver', columns, fks, views, triggers, procedures };
  } finally {
    await pool.close();
  }
}
