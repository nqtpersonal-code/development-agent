import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const tmp = (prefix = 'nqt-') => mkdtempSync(join(tmpdir(), prefix));
export const pluginRoot = new URL('../../plugin/', import.meta.url);
