import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

if (config.dbPath !== ':memory:') mkdirSync(dirname(config.dbPath), { recursive: true });

export const db = new DatabaseSync(config.dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    category TEXT NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions (user_id, date DESC);
`);

export const transactions = {
  create: ({ userId, amountCents, category, date }) => {
    const r = db
      .prepare('INSERT INTO transactions (user_id, amount_cents, category, date) VALUES (?, ?, ?, ?)')
      .run(userId, amountCents, category, date);
    return Number(r.lastInsertRowid);
  },
  findById: (id) => db.prepare('SELECT * FROM transactions WHERE id = ?').get(id),
  listByUser: (userId, { category, from, to } = {}) => {
    const where = ['user_id = ?'];
    const params = [userId];
    if (category) { where.push('category = ?'); params.push(category); }
    if (from) { where.push('date >= ?'); params.push(from); }
    if (to) { where.push('date <= ?'); params.push(to); }
    return db
      .prepare(`SELECT * FROM transactions WHERE ${where.join(' AND ')} ORDER BY date DESC, id DESC`)
      .all(...params);
  },
};
