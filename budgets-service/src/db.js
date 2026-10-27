import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

if (config.dbPath !== ':memory:') mkdirSync(dirname(config.dbPath), { recursive: true });

export const db = new DatabaseSync(config.dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    limit_cents INTEGER NOT NULL CHECK (limit_cents > 0),
    period TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets (user_id);
  CREATE INDEX IF NOT EXISTS idx_budgets_user_category ON budgets (user_id, category);
  CREATE INDEX IF NOT EXISTS idx_budgets_user_period ON budgets (user_id, period);
`);

export const budgets = {
  create: ({ userId, category, limitCents, period }) => {
    const r = db
      .prepare('INSERT INTO budgets (user_id, category, limit_cents, period) VALUES (?, ?, ?, ?)')
      .run(userId, category, limitCents, period);
    return Number(r.lastInsertRowid);
  },
  findById: (id) => db.prepare('SELECT * FROM budgets WHERE id = ?').get(id),
  listByUser: (userId, { category, period } = {}) => {
    const where = ['user_id = ?'];
    const params = [userId];
    if (category) { where.push('category = ?'); params.push(category); }
    if (period) { where.push('period = ?'); params.push(period); }
    return db
      .prepare(`SELECT * FROM budgets WHERE ${where.join(' AND ')} ORDER BY id DESC`)
      .all(...params);
  },
};
