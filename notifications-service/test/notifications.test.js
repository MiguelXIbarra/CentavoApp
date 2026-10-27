process.env.NODE_ENV = 'test';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

// 1. Simulación de auth-service
const USERS = {
  'token-ana': { id: 1, email: 'ana@example.com' },
  'token-beto': { id: 2, email: 'beto@example.com' },
};

const fakeAuth = http.createServer((req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const user = USERS[token];
  res.setHeader('content-type', 'application/json');
  if (req.url !== '/auth/me' || !user) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'No autorizado' }));
  }
  res.end(JSON.stringify({ user }));
});

// 2. Simulación de budgets-service
const fakeBudgets = http.createServer((req, res) => {
  res.setHeader('content-type', 'application/json');
  const url = new URL(req.url, 'http://127.0.0.1');
  const cat = url.searchParams.get('category');

  // Supongamos presupuestos conocidos para Ana:
  // comida: 100.00
  // transporte: 50.00
  if (cat === 'comida') {
    return res.end(JSON.stringify({
      budgets: [{ id: 10, category: 'comida', limit: 100.0, limit_amount: 100.0, period: 'mensual' }],
    }));
  }
  if (cat === 'transporte') {
    return res.end(JSON.stringify({
      budgets: [{ id: 11, category: 'transporte', limit: 50.0, limit_amount: 50.0, period: 'mensual' }],
    }));
  }

  // Sin presupuesto configurado
  res.end(JSON.stringify({ budgets: [] }));
});

// 3. Simulación de transactions-service
const fakeTransactions = http.createServer((req, res) => {
  res.setHeader('content-type', 'application/json');
  const url = new URL(req.url, 'http://127.0.0.1');
  const cat = url.searchParams.get('category');

  // Transacciones previas de comida: 45.00
  if (cat === 'comida') {
    return res.end(JSON.stringify({
      transactions: [
        { id: 101, amount: 25.0, category: 'comida', date: '2026-10-05' },
        { id: 102, amount: 20.0, category: 'comida', date: '2026-10-10' },
      ],
    }));
  }

  res.end(JSON.stringify({ transactions: [] }));
});

await new Promise((r) => fakeAuth.listen(0, r));
await new Promise((r) => fakeBudgets.listen(0, r));
await new Promise((r) => fakeTransactions.listen(0, r));

process.env.AUTH_SERVICE_URL = `http://127.0.0.1:${fakeAuth.address().port}`;
process.env.BUDGETS_SERVICE_URL = `http://127.0.0.1:${fakeBudgets.address().port}`;
process.env.TRANSACTIONS_SERVICE_URL = `http://127.0.0.1:${fakeTransactions.address().port}`;

const { app } = await import('../src/app.js');

let server, base;
before(
  () =>
    new Promise((r) => {
      server = app.listen(0, () => {
        base = `http://127.0.0.1:${server.address().port}`;
        r();
      });
    })
);

after(() => {
  server.close();
  fakeAuth.close();
  fakeBudgets.close();
  fakeTransactions.close();
});

const postEvent = (body, token = 'token-ana') =>
  fetch(base + '/events/transaction', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token && { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  });

const listNotifications = (qs = '', token = 'token-ana') =>
  fetch(base + '/notifications' + qs, {
    headers: { authorization: `Bearer ${token}` },
  });

const markRead = (id, token = 'token-ana') =>
  fetch(`${base}/notifications/${id}/read`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}` },
  });

test('no genera alerta si el consumo se mantiene por debajo del 80%', async () => {
  // Comida tiene previo 45.00, nuevo gasto 20.00 -> total 65.00 / 100.00 (65%)
  const res = await postEvent({
    category: 'comida',
    amount: 20.0,
    date: '2026-10-15',
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.alert_generated, false);
  assert.equal(data.alert, null);
  assert.equal(data.evaluation.spent, 65.0);
  assert.equal(data.evaluation.limit, 100.0);
  assert.equal(data.evaluation.percentage, 65.0);
  assert.equal(data.evaluation.status, 'ok');
});

test('genera alerta BUDGET_WARNING cuando el consumo alcanza el 80%', async () => {
  // Comida tiene previo 45.00, nuevo gasto 40.00 -> total 85.00 / 100.00 (85%)
  const res = await postEvent({
    category: 'comida',
    amount: 40.0,
    date: '2026-10-16',
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.alert_generated, true);
  assert.ok(data.alert);
  assert.equal(data.alert.type, 'BUDGET_WARNING');
  assert.equal(data.alert.severity, 'warning');
  assert.equal(data.alert.spent, 85.0);
  assert.equal(data.alert.limit, 100.0);
  assert.equal(data.alert.percentage, 85.0);
  assert.equal(data.evaluation.status, 'warning');
});

test('genera alerta crítica OVERSPEND_ALERT cuando el consumo alcanza o supera el 100%', async () => {
  // Comida tiene previo 45.00, nuevo gasto 60.00 -> total 105.00 / 100.00 (105%)
  const res = await postEvent({
    categoria: 'Comida',
    monto: 60.0,
    fecha: '2026-10-20',
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.alert_generated, true);
  assert.ok(data.alert);
  assert.equal(data.alert.type, 'OVERSPEND_ALERT');
  assert.equal(data.alert.severity, 'critical');
  assert.equal(data.alert.spent, 105.0);
  assert.equal(data.alert.limit, 100.0);
  assert.equal(data.alert.percentage, 105.0);
  assert.equal(data.evaluation.status, 'exceeded');
});

test('devuelve no_budget_configured si la categoría no tiene presupuesto definido', async () => {
  const res = await postEvent({
    category: 'viajes',
    amount: 500.0,
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.alert_generated, false);
  assert.equal(data.reason, 'no_budget_configured');
});

test('soporta presupuesto y gasto acumulado pasados directamente en el payload', async () => {
  const res = await postEvent({
    category: 'entretenimiento',
    amount: 30.0,
    budget: { limit: 50.0, period: 'mensual' },
    current_spent: 55.0,
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.alert_generated, true);
  assert.equal(data.alert.type, 'OVERSPEND_ALERT');
  assert.equal(data.alert.limit, 50.0);
  assert.equal(data.alert.spent, 55.0);
});

test('lista y filtra notificaciones del usuario y marca como leída', async () => {
  const listRes = await listNotifications();
  assert.equal(listRes.status, 200);
  const { notifications } = await listRes.json();
  assert.ok(notifications.length >= 2);

  const notifId = notifications[0].id;
  assert.equal(notifications[0].read, false);

  // Marcar como leída
  const patchRes = await markRead(notifId);
  assert.equal(patchRes.status, 200);
  const patched = (await patchRes.json()).notification;
  assert.equal(patched.read, true);

  // Filtrar por leídas
  const readOnly = await (await listNotifications('?read=true')).json();
  assert.ok(readOnly.notifications.some((n) => n.id === notifId && n.read === true));

  // Filtrar por no leídas
  const unreadOnly = await (await listNotifications('?read=false')).json();
  assert.ok(unreadOnly.notifications.every((n) => n.read === false));
});

test('aísla alertas entre usuarios', async () => {
  // Beto aún no tiene notificaciones
  const betoList = await (await listNotifications('', 'token-beto')).json();
  assert.equal(betoList.notifications.length, 0);

  // Disparamos alerta para Beto con presupuesto manual
  await postEvent(
    {
      category: 'ocio',
      amount: 150.0,
      budget: { limit: 100.0 },
      current_spent: 150.0,
    },
    'token-beto'
  );

  const betoAfter = await (await listNotifications('', 'token-beto')).json();
  assert.equal(betoAfter.notifications.length, 1);
  assert.equal(betoAfter.notifications[0].category, 'ocio');

  // Ana no ve la notificación de ocio de Beto
  const anaList = await (await listNotifications('?category=ocio', 'token-ana')).json();
  assert.equal(anaList.notifications.length, 0);
});

test('valida errores de entrada y rechaza peticiones sin sesión ni user_id', async () => {
  // Sin auth
  const unauth = await postEvent({ category: 'comida', amount: 10 }, null);
  assert.equal(unauth.status, 401);

  // Monto negativo o no numérico
  const badAmount = await postEvent({ category: 'comida', amount: -5 });
  assert.equal(badAmount.status, 400);

  // Categoría vacía
  const badCat = await postEvent({ category: '', amount: 10 });
  assert.equal(badCat.status, 400);

  // Fecha inválida
  const badDate = await postEvent({ category: 'comida', amount: 10, date: '2026-02-31' });
  assert.equal(badDate.status, 400);
});
