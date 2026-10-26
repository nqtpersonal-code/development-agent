import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { walkFiles } from './files.mjs';

const norm = (p) => String(p ?? '').replace(/\\/g, '/').toLowerCase();
const ABSOLUTE = /(^|[\s"'=])([A-Za-z]:[\\/]|\/(?!\/))/;
// The command line without its first token (the executable, often an absolute path itself).
const argsOf = (cmd) => String(cmd ?? '').trim().replace(/^("[^"]*"|\S+)/, '');
const WATCH =/--watch|\bwatch\b|vite|webpack(-dev)?-server|next dev|nodemon|ts-node-dev|tsx watch|ng serve|dotnet watch/i;

// Pure decision: is the process on the port this ticket folder's app, and is it
// running the current code? A watching dev server reloads by itself.
export function judgeApp({ port, owner, root, newestChange }) {
  if (!owner) return { port, status: 'free', advice: 'nothing listens on this port: start the app from this ticket folder' };
  const inRoot = norm(owner.commandLine).includes(norm(root)) || (owner.cwd ? norm(owner.cwd).startsWith(norm(root)) : false);
  // Without a cwd, a command line whose arguments hold no absolute path
  // ("node dist/main.js") cannot say which folder it runs from.
  const knowable = inRoot || owner.cwd || ABSOLUTE.test(argsOf(owner.commandLine));
  const watching = WATCH.test(owner.commandLine ?? '');
  const startedAt = owner.startedAt ? new Date(owner.startedAt) : null;
  const stale = !watching && startedAt && newestChange && newestChange > startedAt;
  const status = !knowable ? 'unknown' : !inRoot ? 'other-folder' : stale ? 'stale' : 'current';
  const advice = {
    unknown: 'cannot tell which folder this app runs from (started with relative paths): restart it from this ticket folder with absolute paths',
    'other-folder': 'the port belongs to an app started from another folder: stop it (after telling the owner) and start this ticket\'s app',
    stale: 'the app started before the latest code change and does not reload by itself: restart it',
    current: 'the app on this port runs this folder\'s current code',
  }[status];
  return { port, status, pid: owner.pid, watching, startedAt: owner.startedAt ?? null, commandLine: String(owner.commandLine ?? '').slice(0, 160), advice };
}

function ownerWindows(port) {
  const ps = `$c = Get-NetTCPConnection -LocalPort ${Number(port)} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($c) { $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($c.OwningProcess)"; [pscustomobject]@{ pid = $c.OwningProcess; commandLine = $p.CommandLine; startedAt = $p.CreationDate.ToString('o') } | ConvertTo-Json -Compress }`;
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8' });
  const out = (r.stdout ?? '').trim();
  return out ? JSON.parse(out) : null;
}

function ownerPosix(port) {
  const r = spawnSync('lsof', ['-nP', `-iTCP:${Number(port)}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' });
  const pid = (r.stdout ?? '').trim().split('\n')[0];
  if (!pid) return null;
  const ps = spawnSync('ps', ['-o', 'lstart=,args=', '-p', pid], { encoding: 'utf8' }).stdout.trim();
  const cwd = spawnSync('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'], { encoding: 'utf8' }).stdout.split('\n').find((l) => l.startsWith('n'))?.slice(1);
  const m = /^(\w{3} \w{3}\s+\d+ [\d:]+ \d{4})\s+(.*)$/.exec(ps);
  return { pid: Number(pid), commandLine: m?.[2] ?? ps, startedAt: m ? new Date(m[1]).toISOString() : null, cwd };
}

export function newestChange(root) {
  let newest = 0;
  for (const p of walkFiles(root)) {
    try {
      newest = Math.max(newest, statSync(p).mtimeMs);
    } catch { /* file vanished */ }
  }
  return newest ? new Date(newest) : null;
}

export function appCheck({ port, root }) {
  const owner = process.platform === 'win32' ? ownerWindows(port) : ownerPosix(port);
  return judgeApp({ port, owner, root, newestChange: owner ? newestChange(root) : null });
}
