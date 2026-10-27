import express from 'express';
import { users } from './db.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { issueToken, requireSession } from './session.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Hash ficticio para igualar tiempos cuando el email no existe.
const DUMMY_HASH = await hashPassword('dummy-password');

export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name });

app.post('/auth/register', async (req, res) => {
  const { email, name, password } = req.body ?? {};
  if (typeof email !== 'string' || !EMAIL_RE.test(email))
    return res.status(400).json({ error: 'Email inválido' });
  if (typeof name !== 'string' || !name.trim())
    return res.status(400).json({ error: 'Nombre requerido' });
  if (typeof password !== 'string' || password.length < 8 || password.length > 128)
    return res.status(400).json({ error: 'La contraseña debe tener entre 8 y 128 caracteres' });

  const normalized = email.trim().toLowerCase();
  if (users.findByEmail(normalized))
    return res.status(409).json({ error: 'El email ya está registrado' });

  const id = users.create({
    email: normalized,
    name: name.trim(),
    passwordHash: await hashPassword(password),
  });
  const user = users.findById(id);
  res.status(201).json({ user: publicUser(user), token: issueToken(user) });
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string')
    return res.status(400).json({ error: 'Email y contraseña requeridos' });

  const row = users.findByEmail(email.trim().toLowerCase());
  const ok = await verifyPassword(password, row ? row.password_hash : DUMMY_HASH);
  if (!row || !ok) return res.status(401).json({ error: 'Credenciales inválidas' });

  res.json({ user: publicUser(row), token: issueToken(row) });
});

// Verificación de sesión (también consumible por otros microservicios).
app.get('/auth/me', requireSession, (req, res) => res.json({ user: publicUser(req.user) }));

app.use((err, _req, res, _next) => {
  // Nunca se registra el body ni cabeceras: solo el mensaje del error.
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  console.error('Error interno:', err.message);
  res.status(500).json({ error: 'Error interno' });
});
