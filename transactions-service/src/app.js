import express from 'express';
import { transactions } from './db.js';
import { requireSession } from './session.js';

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

const publicTx = (t) => ({
  id: t.id,
  amount: t.amount_cents / 100,
  category: t.category,
  date: t.date,
  created_at: t.created_at,
});

app.post('/transactions', requireSession, (req, res) => {
  const { amount, category, date } = req.body ?? {};
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > 1e9)
    return res.status(400).json({ error: 'Monto inválido: debe ser un número positivo' });
  const cents = Math.round(amount * 100);
  if (Math.abs(cents / 100 - amount) > 1e-9)
    return res.status(400).json({ error: 'Monto inválido: máximo 2 decimales' });
  if (typeof category !== 'string' || !category.trim() || category.trim().length > MAX_CATEGORY)
    return res.status(400).json({ error: `Categoría requerida (máx. ${MAX_CATEGORY} caracteres)` });
  if (!isValidDate(date))
    return res.status(400).json({ error: 'Fecha inválida: usa el formato YYYY-MM-DD' });

  const id = transactions.create({
    userId: Number(req.user.id),
    amountCents: cents,
    category: category.trim().toLowerCase(),
    date,
  });
  res.status(201).json({ transaction: publicTx(transactions.findById(id)) });
});

app.get('/transactions', requireSession, (req, res) => {
  const { category, from, to } = req.query;
  if (from !== undefined && !isValidDate(from)) return res.status(400).json({ error: 'Parámetro from inválido' });
  if (to !== undefined && !isValidDate(to)) return res.status(400).json({ error: 'Parámetro to inválido' });
  if (category !== undefined && typeof category !== 'string')
    return res.status(400).json({ error: 'Parámetro category inválido' });

  const rows = transactions.listByUser(Number(req.user.id), {
    category: category?.trim().toLowerCase(),
    from,
    to,
  });
  res.json({ transactions: rows.map(publicTx) });
});

app.use((err, _req, res, _next) => {
  // Nunca se registra el body ni cabeceras: solo el mensaje del error.
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  console.error('Error interno:', err.message);
  res.status(500).json({ error: 'Error interno' });
});
