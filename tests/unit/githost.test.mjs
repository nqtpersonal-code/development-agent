// nqt-leak-scan: ignore-file  (fictional remotes and ticket refs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRemote, detectHost, parseTicketRef, fetchTicket } from '../../plugin/scripts/lib/githost.mjs';

test('parseRemote reads https, scp-style ssh and ssh:// remotes, with subgroups', () => {
  assert.deepEqual(parseRemote('https://github.com/acme/shop.git'), { hostname: 'github.com', repo: 'acme/shop' });
  assert.deepEqual(parseRemote('git@github.com:acme/shop.git'), { hostname: 'github.com', repo: 'acme/shop' });
  assert.deepEqual(parseRemote('ssh://git@git.example.org:2222/team/sub/app.git'), { hostname: 'git.example.org', repo: 'team/sub/app' });
  assert.deepEqual(parseRemote('https://user@gitlab.com/group/sub/repo'), { hostname: 'gitlab.com', repo: 'group/sub/repo' });
  assert.equal(parseRemote('not a remote'), null);
});

test('detectHost knows the public hosts without probing', () => {
  const never = () => { throw new Error('should not probe'); };
  assert.equal(detectHost('git@github.com:a/b.git', { probe: never }).host, 'github');
  assert.equal(detectHost('https://gitlab.com/a/b.git', { probe: never }).host, 'gitlab');
});

test('detectHost asks the logged-in CLIs about a self-hosted name, else reports unknown', () => {
  const glabKnows = (cli, hostname) => cli === 'glab' && hostname === 'git.example.org';
  const r = detectHost('ssh://git@git.example.org:2222/team/app.git', { probe: glabKnows });
  assert.deepEqual([r.host, r.hostname, r.repo, r.detectedBy], ['gitlab', 'git.example.org', 'team/app', 'glab auth']);
  const ghe = detectHost('https://code.example.org/org/app.git', { probe: (cli) => cli === 'gh' });
  assert.equal(ghe.host, 'github');
  const unknown = detectHost('https://code.example.org/org/app.git', { probe: () => false });
  assert.equal(unknown.host, 'unknown');
});

test('parseTicketRef accepts numbers, #numbers and issue URLs', () => {
  assert.equal(parseTicketRef('123'), '123');
  assert.equal(parseTicketRef('#45'), '45');
  assert.equal(parseTicketRef('https://github.com/a/b/issues/77'), '77');
  assert.equal(parseTicketRef('https://gitlab.example.org/g/r/-/issues/88'), '88');
  assert.equal(parseTicketRef('ABC-12'), null);
});

test('fetchTicket builds the right CLI call per host and formats markdown', () => {
  const calls = [];
  const run = (cmd, args, env) => {
    calls.push({ cmd, args, env });
    if (cmd === 'gh') {
      return { status: 0, stdout: JSON.stringify({
        title: 'Hiển thị số điện thoại', body: 'Thêm cột', url: 'https://github.com/a/b/issues/7',
        labels: [{ name: 'feature' }], comments: [{ author: { login: 'mai' }, body: 'Học sinh chưa có số thì để trống' }],
      }) };
    }
    return { status: 0, stdout: 'title:\tSửa học phí\nstate:\topen\n--\nMô tả ticket\n' };
  };
  const gh = fetchTicket({ host: 'github', hostname: 'github.com', repo: 'a/b' }, '#7', { run });
  assert.equal(calls[0].cmd, 'gh');
  assert.deepEqual(calls[0].args.slice(0, 4), ['issue', 'view', '7', '--repo']);
  assert.match(gh.markdown, /^# Hiển thị số điện thoại/);
  assert.match(gh.markdown, /mai: Học sinh chưa có số thì để trống/);
  assert.match(gh.markdown, /https:\/\/github\.com\/a\/b\/issues\/7/);
  const gl = fetchTicket({ host: 'gitlab', hostname: 'git.example.org', repo: 'g/r' }, '9', { run });
  assert.equal(calls[1].cmd, 'glab');
  assert.ok(calls[1].args.includes('--comments'));
  assert.equal(calls[1].env.GITLAB_HOST, 'git.example.org');
  assert.match(gl.markdown, /Mô tả ticket/);
});

test('fetchTicket says paste is needed when the CLI is missing or not logged in', () => {
  const r = fetchTicket({ host: 'github', hostname: 'github.com', repo: 'a/b' }, '7', { run: () => ({ status: 1, stderr: 'gh: not logged in' }) });
  assert.equal(r.ok, false);
  assert.match(r.reason, /not logged in/);
  assert.equal(fetchTicket({ host: 'unknown' }, '7').ok, false);
  const missing = fetchTicket({ host: 'gitlab', hostname: 'gitlab.com', repo: 'g/r' }, '7', { run: () => ({ status: null, error: Object.assign(new Error('spawnSync glab ENOENT'), { code: 'ENOENT' }) }) });
  assert.match(missing.reason, /glab is not installed/);
});
