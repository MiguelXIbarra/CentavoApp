import express from 'express';
import { notifications } from './db.js';
import { requireSession, verifySession } from './session.js';
import { evaluateTransactionEvent } from './evaluator.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CATEGORY = 50;

const isValidDate = (s) => {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));

export const publicNotification = (n) => ({
  id: n.id,
  user_id: n.user_id,
  type: n.type,
  category: n.category,
  message: n.message,
  severity: n.severity,
  spent: n.spent_cents / 100,
  spent_amount: n.spent_cents / 100,
  limit: n.limit_cents / 100,
  limit_amount: n.limit_cents / 100,
  percentage: Number(n.percentage.toFixed(2)),
  read: Boolean(n.read),
  transaction_id: n.transaction_id ?? null,
  created_at: n.created_at,
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'notifications-service' });
});

// Handler común para recibir eventos de nueva transacción
const handleTransactionEvent = async (req, res) => {
  const authHeader = req.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  let userId = null;
  if (token) {
    try {
      const user = await verifySession(token);
      if (!user) return res.status(401).json({ error: 'Sesión inválida o expirada' });
      userId = Number(user.id);
    } catch (err) {
      console.error('Error validando sesión:', err.message);
      return res.status(503).json({ error: 'Servicio de autenticación no disponible' });
    }
  } else if (req.body?.user_id || req.body?.userId) {
    userId = Number(req.body.user_id ?? req.body.userId);
  }

  if (!userId || Number.isNaN(userId) || userId <= 0) {
    return res.status(401).json({ error: 'Se requiere sesión válida o user_id' });
  }

  const {
    amount,
    monto,
    amount_cents,
    amountCents,
    category,
    categoria,
    date,
    fecha,
    transaction_id,
    transactionId,
    budget,
    presupuesto,
    spent,
    current_spent,
    current_spent_cents,
  } = req.body ?? {};

  const effectiveAmount = amount ?? monto;
  let effectiveCents = amount_cents ?? amountCents;

  if (effectiveCents === undefined || effectiveCents === null) {
    if (typeof effectiveAmount !== 'number' || !Number.isFinite(effectiveAmount) || effectiveAmount <= 0 || effectiveAmount > 1e9) {
      return res.status(400).json({ error: 'Monto inválido: debe ser un número positivo' });
    }
    const cents = Math.round(effectiveAmount * 100);
    if (Math.abs(cents / 100 - effectiveAmount) > 1e-9) {
      return res.status(400).json({ error: 'Monto inválido: máximo 2 decimales' });
    }
    effectiveCents = cents;
  } else {
    if (typeof effectiveCents !== 'number' || !Number.isInteger(effectiveCents) || effectiveCents <= 0) {
      return res.status(400).json({ error: 'amount_cents debe ser un entero positivo' });
    }
  }

  const effectiveCategory = category ?? categoria;
  if (typeof effectiveCategory !== 'string' || !effectiveCategory.trim() || effectiveCategory.trim().length > MAX_CATEGORY) {
    return res.status(400).json({ error: `Categoría requerida (máx. ${MAX_CATEGORY} caracteres)` });
  }

  const effectiveDate = date ?? fecha ?? new Date().toISOString().slice(0, 10);
  if (!isValidDate(effectiveDate)) {
    return res.status(400).json({ error: 'Fecha inválida: usa el formato YYYY-MM-DD' });
  }

  const effectiveTxId = transaction_id ?? transactionId ? Number(transaction_id ?? transactionId) : null;
  const effectiveBudget = budget ?? presupuesto ?? null;

  let spentCentsOverride = null;
  if (current_spent_cents !== undefined) {
    spentCentsOverride = Number(current_spent_cents);
  } else if (current_spent !== undefined || spent !== undefined) {
    spentCentsOverride = Math.round(Number(current_spent ?? spent) * 100);
  }

  try {
    const result = await evaluateTransactionEvent({
      userId,
      amountCents: effectiveCents,
      category: effectiveCategory,
      date: effectiveDate,
      transactionId: effectiveTxId,
      budgetOverride: effectiveBudget,
      spentCentsOverride,
      authToken: token,
    });

    res.status(result.alert_generated ? 201 : 200).json(result);
  } catch (err) {
    console.error('Error evaluando evento de transacción:', err.message);
    res.status(500).json({ error: 'Error interno evaluando evento de transacción' });
  }
};

// Endpoint principal para eventos de transacción
app.post('/events/transaction', handleTransactionEvent);
// Rutas alternativas / alias convenientes
app.post('/events/new-transaction', handleTransactionEvent);
app.post('/notifications/events/transaction', handleTransactionEvent);

// Listar notificaciones del usuario
app.get('/notifications', requireSession, (req, res) => {
  const { category, categoria, read } = req.query;
  const filterCategory = category ?? categoria;

  if (filterCategory !== undefined && typeof filterCategory !== 'string') {
    return res.status(400).json({ error: 'Parámetro category inválido' });
  }

  let filterRead = undefined;
  if (read !== undefined) {
    if (read === 'true' || read === '1') filterRead = true;
    else if (read === 'false' || read === '0') filterRead = false;
    else return res.status(400).json({ error: 'Parámetro read debe ser booleano' });
  }

  const rows = notifications.listByUser(Number(req.user.id), {
    category: filterCategory?.trim().toLowerCase(),
    read: filterRead,
  });

  res.json({ notifications: rows.map(publicNotification) });
});

// Marcar notificación como leída
app.patch('/notifications/:id/read', requireSession, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de notificación inválido' });
  }

  const updated = notifications.markAsRead(id, Number(req.user.id));
  if (!updated) {
    return res.status(404).json({ error: 'Notificación no encontrada' });
  }

  const notif = notifications.findById(id);
  res.json({ notification: publicNotification(notif) });
});

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  console.error('Error interno:', err.message);
  res.status(500).json({ error: 'Error interno' });
});
