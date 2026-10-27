process.env.NODE_ENV = 'test';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const { app } = await import('../src/app.js');
let server, base;
before(() => new Promise((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); }); }));
after(() => server.close());

const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const creds = { email: 'Ana@Example.com', name: 'Ana', password: 'supersecreta1' };

test('registro, login y verificación de sesión', async () => {
  const reg = await post('/auth/register', creds);
  assert.equal(reg.status, 201);
  const regBody = await reg.json();
  assert.ok(regBody.token);
  assert.equal(regBody.user.password_hash, undefined);

  assert.equal((await post('/auth/register', creds)).status, 409);

  const login = await post('/auth/login', { email: 'ana@example.com', password: creds.password });
  assert.equal(login.status, 200);
  const { token } = await login.json();

  const me = await fetch(base + '/auth/me', { headers: { authorization: `Bearer ${token}` } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.email, 'ana@example.com');
});

test('rechaza credenciales y tokens inválidos', async () => {
  assert.equal((await post('/auth/login', { email: 'ana@example.com', password: 'incorrecta12' })).status, 401);
  assert.equal((await post('/auth/login', { email: 'nadie@example.com', password: 'incorrecta12' })).status, 401);
  assert.equal((await fetch(base + '/auth/me')).status, 401);
  assert.equal((await fetch(base + '/auth/me', { headers: { authorization: 'Bearer basura' } })).status, 401);
});

test('valida entrada del registro', async () => {
  assert.equal((await post('/auth/register', { ...creds, email: 'x' })).status, 400);
  assert.equal((await post('/auth/register', { ...creds, email: 'b@e.com', password: 'corta' })).status, 400);
});
