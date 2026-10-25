import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { walkFiles, readText } from './files.mjs';

// Each assumption names something a tracer adapter relies on; if it is gone the
// adapter is stale and impact results cannot be trusted.
export function checkAssumptions(adapter, projectRoot) {
  return (adapter?.assumptions ?? []).map((a) => {
    let ok = true;
    if (a.check?.fileExists) ok = existsSync(join(projectRoot, a.check.fileExists));
    if (ok && a.check?.pattern) {
      const re = new RegExp(a.check.pattern);
      ok = false;
      for (const f of walkFiles(join(projectRoot, a.check.inRoot ?? '.'))) {
        if (re.test(readText(f) ?? '')) {
          ok = true;
          break;
        }
      }
    }
    return { id: a.id, ok, description: a.description };
  });
}
