import { runtimeRequire } from './runtime.mjs';
import { parseDbUrl, assertLocalDb } from './localhost.mjs';

const READ = /^(select|with|show|explain|describe|desc|values|table)\b/i;

// 'read' only when every statement is a read; a CTE that writes counts as write.
export function classifySql(query) {
  const statements = String(query).replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').split(';').map((s) => s.trim()).filter(Boolean);
  const writes = /\b(insert|update|delete|merge|drop|alter|create|truncate|grant|revoke|exec|execute|call)\b/i;
  return statements.length && statements.every((s) => READ.test(s) && !writes.test(s)) ? 'read' : 'write';
}

// Runs one query on the local DB taken from project settings, so agents never
// put a connection string (or its password) on a command line.
export async function runSql({ url, query, params = [], write = false, dataDir, confirmedLocalHosts = [], maxRows = 50 }) {
  assertLocalDb(url, confirmedLocalHosts);
  if (classifySql(query) === 'write' && !write) throw new Error('this query changes data; pass --write after the owner or the flow allows it');
  const { engine } = parseDbUrl(url);
  let rows, affected;
  if (engine === 'postgres') {
    const { Client } = runtimeRequire(dataDir, 'pg');
    const c = new Client({ connectionString: url, connectionTimeoutMillis: 5000 });
    await c.connect();
    try {
      const r = await c.query(query, params);
      [rows, affected] = [r.rows ?? [], r.rowCount];
    } finally {
      await c.end();
    }
  } else if (engine === 'mysql') {
    const mysql = runtimeRequire(dataDir, 'mysql2/promise');
    const c = await mysql.createConnection({ uri: url, connectTimeout: 5000, multipleStatements: false });
    try {
      const [r] = await c.query(query, params);
      [rows, affected] = Array.isArray(r) ? [r, r.length] : [[], r.affectedRows];
    } finally {
      await c.end();
    }
  } else if (engine === 'sqlserver') {
    const sql = runtimeRequire(dataDir, 'mssql');
    const u = new URL(url);
    const pool = await new sql.ConnectionPool({
      server: u.hostname, port: u.port ? Number(u.port) : 1433,
      user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
      database: decodeURIComponent(u.pathname.replace(/^\//, '')),
      options: { encrypt: false, trustServerCertificate: true }, connectionTimeout: 5000,
    }).connect();
    try {
      const req = pool.request();
      params.forEach((v, i) => req.input(`p${i + 1}`, v));
      const r = await req.query(query);
      [rows, affected] = [r.recordset ?? [], r.rowsAffected?.reduce((a, b) => a + b, 0)];
    } finally {
      await pool.close();
    }
  } else {
    throw new Error(`unsupported DB engine: ${engine}`);
  }
  return { rows: rows.slice(0, maxRows), total: rows.length, truncated: rows.length > maxRows, affected };
}
