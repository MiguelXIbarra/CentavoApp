import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

if (config.dbPath !== ':memory:') mkdirSync(dirname(config.dbPath), { recursive: true });

export const db = new DatabaseSync(config.dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

export const users = {
  findByEmail: (email) => db.prepare('SELECT * FROM users WHERE email = ?').get(email),
  findById: (id) => db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?').get(id),
  create: ({ email, name, passwordHash }) => {
    const r = db
      .prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)')
      .run(email, name, passwordHash);
    return Number(r.lastInsertRowid);
  },
};
