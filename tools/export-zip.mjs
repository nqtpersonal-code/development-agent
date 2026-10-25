// Builds dist/nqt-plugin-<version>.zip containing only the installable plugin,
// the marketplace manifest and the README. Blocks on any leak finding.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { exportZip } from '../plugin/scripts/lib/zip.mjs';
import { projectNamesFrom } from '../plugin/scripts/lib/leaks.mjs';
import { getDataDir } from '../plugin/scripts/lib/config.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(repoRoot, 'plugin', '.claude-plugin', 'plugin.json'), 'utf8'));
try {
  const out = exportZip({ repoRoot, outDir: join(repoRoot, 'dist'), version, projectNames: projectNamesFrom(getDataDir()) });
  console.log(`zip: ${out}`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
