import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

if (config.dbPath !== ':memory:') mkdirSync(dirname(config.dbPath), { recursive: true });

export const db = new DatabaseSync(config.dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL,
    spent_cents INTEGER NOT NULL,
    limit_cents INTEGER NOT NULL,
    percentage REAL NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    transaction_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications (user_id, read);
  CREATE INDEX IF NOT EXISTS idx_notifications_user_category ON notifications (user_id, category);
`);

export const notifications = {
  create: ({
    userId,
    type,
    category,
    message,
    severity,
    spentCents,
    limitCents,
    percentage,
    transactionId = null,
  }) => {
    const r = db
      .prepare(`
        INSERT INTO notifications (
          user_id, type, category, message, severity, spent_cents, limit_cents, percentage, transaction_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        userId,
        type,
        category,
        message,
        severity,
        spentCents,
        limitCents,
        percentage,
        transactionId
      );
    return Number(r.lastInsertRowid);
  },

  findById: (id) => db.prepare('SELECT * FROM notifications WHERE id = ?').get(id),

  listByUser: (userId, { category, read } = {}) => {
    const where = ['user_id = ?'];
    const params = [userId];

    if (category) {
      where.push('category = ?');
      params.push(category);
    }
    if (read !== undefined && read !== null) {
      where.push('read = ?');
      params.push(read ? 1 : 0);
    }

    return db
      .prepare(`SELECT * FROM notifications WHERE ${where.join(' AND ')} ORDER BY id DESC`)
      .all(...params);
  },

  markAsRead: (id, userId) => {
    const r = db
      .prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?')
      .run(id, userId);
    return r.changes > 0;
  },
};
