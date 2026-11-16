import { setupDetect } from './setup.mjs';
import { resolveDbUrl } from './adapter.mjs';
import { parseDbUrl } from './localhost.mjs';
import { ENGINE_PACKAGE } from './runtime.mjs';

// The DB driver packages this project needs: the engine of its configured
// database, else of the local database settings found in its files. A project on
// SQL Server only needs `mssql`; nothing else is installed for it.
export function neededDbPackages(root, fm = {}) {
  const engines = new Set();
  let url = null;
  try {
    url = resolveDbUrl(root, fm);
  } catch {
    url = null;
  }
  if (url) engines.add(parseDbUrl(url).engine);
  else {
    const found = setupDetect(root).db;
    const local = found.filter((d) => d.local);
    for (const d of local.length ? local : found) engines.add(d.engine);
  }
  return [...engines].map((e) => ENGINE_PACKAGE[e]).filter(Boolean);
}
