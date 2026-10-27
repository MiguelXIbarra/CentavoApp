import express from 'express';
import { budgets } from './db.js';
import { requireSession } from './session.js';

const MAX_CATEGORY = 50;
const MAX_PERIOD = 50;

export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));

const publicBudget = (b) => ({
  id: b.id,
  category: b.category,
  limit: b.limit_cents / 100,
  limit_amount: b.limit_cents / 100,
  period: b.period,
  created_at: b.created_at,
});

app.post('/budgets', requireSession, (req, res) => {
  const { category, categoria, limit, limit_amount, monto_limite, montoLimite, amount, period, periodo } = req.body ?? {};

  const effectiveCategory = category ?? categoria;
  const effectiveLimit = limit ?? limit_amount ?? monto_limite ?? montoLimite ?? amount;
  const effectivePeriod = period ?? periodo;

  if (typeof effectiveLimit !== 'number' || !Number.isFinite(effectiveLimit) || effectiveLimit <= 0 || effectiveLimit > 1e9) {
    return res.status(400).json({ error: 'Monto límite inválido: debe ser un número positivo' });
  }

  const cents = Math.round(effectiveLimit * 100);
  if (Math.abs(cents / 100 - effectiveLimit) > 1e-9) {
    return res.status(400).json({ error: 'Monto límite inválido: máximo 2 decimales' });
  }

  if (typeof effectiveCategory !== 'string' || !effectiveCategory.trim() || effectiveCategory.trim().length > MAX_CATEGORY) {
    return res.status(400).json({ error: `Categoría requerida (máx. ${MAX_CATEGORY} caracteres)` });
  }

  if (typeof effectivePeriod !== 'string' || !effectivePeriod.trim() || effectivePeriod.trim().length > MAX_PERIOD) {
    return res.status(400).json({ error: `Periodo requerido (máx. ${MAX_PERIOD} caracteres)` });
  }

  const id = budgets.create({
    userId: Number(req.user.id),
    category: effectiveCategory.trim().toLowerCase(),
    limitCents: cents,
    period: effectivePeriod.trim().toLowerCase(),
  });

  res.status(201).json({ budget: publicBudget(budgets.findById(id)) });
});

app.get('/budgets', requireSession, (req, res) => {
  const { category, categoria, period, periodo } = req.query;
  const filterCategory = category ?? categoria;
  const filterPeriod = period ?? periodo;

  if (filterCategory !== undefined && typeof filterCategory !== 'string') {
    return res.status(400).json({ error: 'Parámetro category inválido' });
  }
  if (filterPeriod !== undefined && typeof filterPeriod !== 'string') {
    return res.status(400).json({ error: 'Parámetro period inválido' });
  }

  const rows = budgets.listByUser(Number(req.user.id), {
    category: filterCategory?.trim().toLowerCase(),
    period: filterPeriod?.trim().toLowerCase(),
  });

  res.json({ budgets: rows.map(publicBudget) });
});

app.use((err, _req, res, _next) => {
  // Nunca se registra el body ni cabeceras: solo el mensaje del error.
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  console.error('Error interno:', err.message);
  res.status(500).json({ error: 'Error interno' });
});
