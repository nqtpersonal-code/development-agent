import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateRawSync, crc32 } from 'node:zlib';
import { scanLeaks } from './leaks.mjs';
import { walkFiles, readText, rel } from './files.mjs';

const INCLUDE = ['plugin', '.claude-plugin', 'README.md', 'LICENSE'];
const UTF8_FLAG = 0x0800;

function collect(repoRoot) {
  const out = [];
  for (const item of INCLUDE) {
    const src = join(repoRoot, item);
    if (!existsSync(src)) continue;
    if (statSync(src).isFile()) out.push({ abs: src, name: item });
    else for (const p of walkFiles(src, ['node_modules', '.git'])) out.push({ abs: p, name: rel(repoRoot, p) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// Minimal zip writer (deflate, UTF-8 names). Built-in tools are not reliable:
// Windows bsdtar crashes on non-ASCII file names.
function writeZip(out, entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const comp = deflateRawSync(data);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(UTF8_FLAG, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, comp);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(UTF8_FLAG, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cdSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cdSize, 12);
  end.writeUInt32LE(offset, 16);
  writeFileSync(out, Buffer.concat([...locals, ...centrals, end]));
}

export function exportZip({ repoRoot, outDir, version, projectNames = [] }) {
  const files = collect(repoRoot);
  const findings = scanLeaks({
    files: files.map((f) => ({ path: f.name, content: readText(f.abs) ?? '' })),
    projectNames,
  });
  if (findings.length) {
    const list = findings.slice(0, 10).map((f) => `${f.path}:${f.line} [${f.kind}]`).join('; ');
    throw new Error(`export blocked by leak scan: ${list}`);
  }
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, `nqt-plugin-${version}.zip`);
  rmSync(out, { force: true });
  writeZip(out, files.map((f) => ({ name: f.name, data: readFileSync(f.abs) })));
  return out;
}

export function listZip(zipPath) {
  const buf = readFileSync(zipPath);
  const endAt = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(endAt + 10);
  let p = buf.readUInt32LE(endAt + 16);
  const names = [];
  for (let i = 0; i < count; i++) {
    const nameLen = buf.readUInt16LE(p + 28);
    const extra = buf.readUInt16LE(p + 30);
    const comment = buf.readUInt16LE(p + 32);
    names.push(buf.toString('utf8', p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extra + comment;
  }
  return names;
}
