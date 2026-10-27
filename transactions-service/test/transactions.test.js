process.env.NODE_ENV = 'test';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

// auth-service simulado: tokens "token-ana" y "token-beto".
const USERS = { 'token-ana': { id: 1, email: 'ana@example.com' }, 'token-beto': { id: 2, email: 'beto@example.com' } };
const fakeAuth = http.createServer((req, res) => {
  const user = USERS[(req.headers.authorization || '').replace('Bearer ', '')];
  res.setHeader('content-type', 'application/json');
  if (req.url !== '/auth/me' || !user) { res.statusCode = 401; return res.end('{}'); }
  res.end(JSON.stringify({ user }));
});
await new Promise((r) => fakeAuth.listen(0, r));
process.env.AUTH_SERVICE_URL = `http://127.0.0.1:${fakeAuth.address().port}`;

const { app } = await import('../src/app.js');
let server, base;
before(() => new Promise((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); }); }));
after(() => { server.close(); fakeAuth.close(); });

const post = (body, token = 'token-ana') => fetch(base + '/transactions', {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
  body: JSON.stringify(body),
});
const list = (qs = '', token = 'token-ana') => fetch(base + '/transactions' + qs, { headers: { authorization: `Bearer ${token}` } });

test('crea y lista transacciones del usuario', async () => {
  const r = await post({ amount: 12.5, category: ' Comida ', date: '2026-10-01' });
  assert.equal(r.status, 201);
  const { transaction } = await r.json();
  assert.equal(transaction.amount, 12.5);
  assert.equal(transaction.category, 'comida');

  await post({ amount: 30, category: 'transporte', date: '2026-10-05' });
  const all = (await (await list()).json()).transactions;
  assert.equal(all.length, 2);
  assert.equal(all[0].category, 'transporte'); // más reciente primero

  assert.equal((await (await list('?category=Comida')).json()).transactions.length, 1);
  assert.equal((await (await list('?from=2026-10-02')).json()).transactions.length, 1);
});

test('aísla transacciones por usuario', async () => {
  assert.equal((await (await list('', 'token-beto')).json()).transactions.length, 0);
});

test('exige sesión válida', async () => {
  assert.equal((await post({ amount: 1, category: 'x', date: '2026-10-01' }, null)).status, 401);
  assert.equal((await post({ amount: 1, category: 'x', date: '2026-10-01' }, 'basura')).status, 401);
  assert.equal((await list('', 'basura')).status, 401);
});

test('valida entrada', async () => {
  const ok = { amount: 5, category: 'x', date: '2026-10-01' };
  for (const bad of [
    { ...ok, amount: -1 }, { ...ok, amount: '5' }, { ...ok, amount: 1.234 },
    { ...ok, category: '' }, { ...ok, date: '2026-02-30' }, { ...ok, date: 'hoy' },
  ]) assert.equal((await post(bad)).status, 400, JSON.stringify(bad));
  assert.equal((await list('?from=mal')).status, 400);
});
