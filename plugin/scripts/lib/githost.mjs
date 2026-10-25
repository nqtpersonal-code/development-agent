import { spawnSync } from 'node:child_process';

// owner/repo (GitHub) or group/sub/repo (GitLab) from any common remote form.
export function parseRemote(url) {
  const s = String(url).trim();
  let m = /^[a-z+]+:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+?)(?:\.git)?\/?$/i.exec(s);
  if (!m) m = /^(?:[^@\s]+@)?([^:\s/]+):(?!\/)(.+?)(?:\.git)?\/?$/.exec(s);
  if (!m || !m[2].includes('/')) return null;
  return { hostname: m[1].toLowerCase(), repo: m[2] };
}

// Is this hostname known to a logged-in CLI? (gh for GitHub Enterprise, glab for self-hosted GitLab)
function cliKnows(cli, hostname) {
  const r = spawnSync(cli, ['auth', 'status', '--hostname', hostname], { encoding: 'utf8', shell: false });
  return r.status === 0;
}

export function detectHost(remoteUrl, { probe = cliKnows } = {}) {
  const parsed = parseRemote(remoteUrl);
  if (!parsed) return { host: 'unknown', reason: 'cannot parse remote' };
  const { hostname, repo } = parsed;
  if (hostname === 'github.com') return { host: 'github', hostname, repo, detectedBy: 'hostname' };
  if (hostname === 'gitlab.com') return { host: 'gitlab', hostname, repo, detectedBy: 'hostname' };
  if (probe('glab', hostname)) return { host: 'gitlab', hostname, repo, detectedBy: 'glab auth' };
  if (probe('gh', hostname)) return { host: 'github', hostname, repo, detectedBy: 'gh auth' };
  return { host: 'unknown', hostname, repo, reason: 'self-hosted name not known to gh/glab; ask the owner' };
}

export function parseTicketRef(ref) {
  const s = String(ref).trim();
  const url = /\/(?:-\/)?issues\/(\d+)/.exec(s);
  if (url) return url[1];
  const n = /^#?(\d+)$/.exec(s);
  return n ? n[1] : null;
}

const failure = (cmd, r) => (r.error?.code === 'ENOENT'
  ? `${cmd} is not installed (install it and log in once: ${cmd} auth login)`
  : (r.stderr || r.error?.message || `${cmd} failed`).trim());

const defaultRun = (cmd, args, env) => spawnSync(cmd, args, { encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 1 << 24 });

function githubMarkdown(j) {
  const lines = [`# ${j.title}`, '', `Source: ${j.url}`];
  if (j.labels?.length) lines.push(`Labels: ${j.labels.map((l) => l.name).join(', ')}`);
  lines.push('', '## Description', '', j.body || '(empty)', '', '## Comments', '');
  for (const c of j.comments ?? []) lines.push(`- ${c.author?.login ?? 'unknown'}: ${c.body}`);
  if (!j.comments?.length) lines.push('(none)');
  return lines.join('\n');
}

// Fetches a ticket with the owner's own logged-in CLI. Never stores tokens.
export function fetchTicket(hostInfo, ref, { run = defaultRun } = {}) {
  const id = parseTicketRef(ref);
  if (!id) return { ok: false, reason: `ticket reference "${ref}" is not an issue number or issue URL` };
  if (hostInfo.host === 'github') {
    const env = hostInfo.hostname && hostInfo.hostname !== 'github.com' ? { GH_HOST: hostInfo.hostname } : {};
    const r = run('gh', ['issue', 'view', id, '--repo', hostInfo.repo, '--json', 'title,body,labels,comments,url'], env);
    if (r.status !== 0) return { ok: false, reason: failure('gh', r) };
    return { ok: true, id, markdown: githubMarkdown(JSON.parse(r.stdout)) };
  }
  if (hostInfo.host === 'gitlab') {
    const env = hostInfo.hostname ? { GITLAB_HOST: hostInfo.hostname } : {};
    const r = run('glab', ['issue', 'view', id, '--comments', '--repo', hostInfo.repo], env);
    if (r.status !== 0) return { ok: false, reason: failure('glab', r) };
    const url = `https://${hostInfo.hostname ?? 'gitlab.com'}/${hostInfo.repo}/-/issues/${id}`;
    return { ok: true, id, markdown: `Source: ${url}\n\n${r.stdout.trim()}` };
  }
  return { ok: false, reason: 'unknown ticket host: ask the owner to paste the ticket' };
}
