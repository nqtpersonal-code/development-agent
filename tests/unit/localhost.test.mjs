// nqt-leak-scan: ignore-file
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLocalHost, parseDbUrl } from '../../plugin/scripts/lib/localhost.mjs';

test('local hosts are recognised', () => {
  for (const h of ['localhost', '127.0.0.1', '::1', '0.0.0.0', 'host.docker.internal', 'LOCALHOST']) {
    assert.equal(isLocalHost(h), true, h);
  }
});

test('remote hosts are not local unless confirmed', () => {
  assert.equal(isLocalHost('db.prod.internal'), false);
  assert.equal(isLocalHost('10.0.0.5'), false);
  assert.equal(isLocalHost('mydb', ['mydb']), true);
});

test('parseDbUrl reads postgres and mysql urls', () => {
  const pg = parseDbUrl('postgresql://u:p@localhost:5432/school');
  assert.deepEqual(
    { engine: pg.engine, host: pg.host, port: pg.port, database: pg.database, user: pg.user },
    { engine: 'postgres', host: 'localhost', port: 5432, database: 'school', user: 'u' },
  );
  const my = parseDbUrl('mysql://u@127.0.0.1:3307/s');
  assert.equal(my.engine, 'mysql');
  assert.equal(my.port, 3307);
  assert.equal(my.database, 's');
});

test('parseDbUrl never exposes the password and flags unknown engines', () => {
  const pg = parseDbUrl('postgres://u:secret@localhost/x?schema=public');
  assert.equal(JSON.stringify(pg).includes('secret'), false);
  assert.equal(pg.database, 'x');
  assert.equal(parseDbUrl('oracle://h/x').engine, 'unknown');
});
