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

const post = (body, token = 'token-ana') => fetch(base + '/budgets', {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
  body: JSON.stringify(body),
});
const list = (qs = '', token = 'token-ana') => fetch(base + '/budgets' + qs, { headers: { authorization: `Bearer ${token}` } });

test('crea y lista presupuestos del usuario', async () => {
  const r = await post({ category: ' Comida ', limit: 250.5, period: ' Mensual ' });
  assert.equal(r.status, 201);
  const { budget } = await r.json();
  assert.equal(budget.category, 'comida');
  assert.equal(budget.limit, 250.5);
  assert.equal(budget.limit_amount, 250.5);
  assert.equal(budget.period, 'mensual');
  assert.ok(budget.id > 0);
  assert.ok(budget.created_at);

  await post({ category: 'transporte', limit: 80, period: 'mensual' });
  await post({ category: 'comida', limit: 60, period: 'semanal' });

  const all = (await (await list()).json()).budgets;
  assert.equal(all.length, 3);
  assert.equal(all[0].category, 'comida');
  assert.equal(all[0].period, 'semanal'); // más reciente primero

  const filterComida = (await (await list('?category=Comida')).json()).budgets;
  assert.equal(filterComida.length, 2);

  const filterSemanal = (await (await list('?period=semanal')).json()).budgets;
  assert.equal(filterSemanal.length, 1);
  assert.equal(filterSemanal[0].limit, 60);

  const filterBoth = (await (await list('?category=comida&period=mensual')).json()).budgets;
  assert.equal(filterBoth.length, 1);
  assert.equal(filterBoth[0].limit, 250.5);
});

test('soporta nombres de campos alternativos en español', async () => {
  const r = await post({ categoria: 'Servicios', monto_limite: 150.75, periodo: 'mensual' });
  assert.equal(r.status, 201);
  const { budget } = await r.json();
  assert.equal(budget.category, 'servicios');
  assert.equal(budget.limit, 150.75);
  assert.equal(budget.period, 'mensual');

  const filtered = (await (await list('?categoria=servicios&periodo=mensual')).json()).budgets;
  assert.equal(filtered.length, 1);
});

test('aísla presupuestos por usuario', async () => {
  assert.equal((await (await list('', 'token-beto')).json()).budgets.length, 0);

  await post({ category: 'ocio', limit: 100, period: 'mensual' }, 'token-beto');
  const betoBudgets = (await (await list('', 'token-beto')).json()).budgets;
  assert.equal(betoBudgets.length, 1);
  assert.equal(betoBudgets[0].category, 'ocio');

  // Ana no ve el de Beto
  const anaBudgets = (await (await list('?category=ocio', 'token-ana')).json()).budgets;
  assert.equal(anaBudgets.length, 0);
});

test('exige sesión válida', async () => {
  assert.equal((await post({ category: 'x', limit: 10, period: 'mensual' }, null)).status, 401);
  assert.equal((await post({ category: 'x', limit: 10, period: 'mensual' }, 'basura')).status, 401);
  assert.equal((await list('', 'basura')).status, 401);
  assert.equal((await list('', null)).status, 401);
});

test('valida entrada en la creación', async () => {
  const ok = { category: 'salud', limit: 50, period: 'mensual' };
  for (const bad of [
    { ...ok, limit: -10 },
    { ...ok, limit: '50' },
    { ...ok, limit: 1.234 },
    { ...ok, limit: 0 },
    { ...ok, category: '' },
    { ...ok, category: '   ' },
    { ...ok, category: 'a'.repeat(51) },
    { ...ok, period: '' },
    { ...ok, period: '   ' },
    { ...ok, period: 'p'.repeat(51) },
  ]) {
    const res = await post(bad);
    assert.equal(res.status, 400, `Debería fallar con ${JSON.stringify(bad)}`);
  }
});
