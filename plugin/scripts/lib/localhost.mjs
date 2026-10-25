const LOCAL = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0', 'host.docker.internal']);

export function isLocalHost(host, confirmedLocalHosts = []) {
  const h = String(host || '').trim().toLowerCase();
  return LOCAL.has(h) || confirmedLocalHosts.map((x) => String(x).toLowerCase()).includes(h);
}

const ENGINES = {
  postgres: 'postgres', postgresql: 'postgres',
  mysql: 'mysql', mariadb: 'mysql',
  sqlserver: 'sqlserver', mssql: 'sqlserver',
  sqlite: 'sqlite', file: 'sqlite',
};

// Parses a DB connection URL into its parts. The password is never returned.
export function parseDbUrl(url) {
  const m = /^([a-z0-9+]+):\/\/(?:([^:@/]*)(?::[^@/]*)?@)?([^:/?]*)(?::(\d+))?(?:\/([^?]*))?/i.exec(String(url).trim());
  if (!m) return { engine: 'unknown', host: '', port: null, database: '', user: '' };
  const scheme = m[1].toLowerCase().split('+')[0];
  return {
    engine: ENGINES[scheme] ?? 'unknown',
    host: m[3] || '',
    port: m[4] ? Number(m[4]) : null,
    database: decodeURIComponent(m[5] || ''),
    user: decodeURIComponent(m[2] || ''),
  };
}
