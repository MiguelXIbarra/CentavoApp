// ÚNICO módulo que emite y valida sesiones/tokens. Cualquier validación de
// sesión (incluida la de otros servicios vía /auth/verify) debe pasar por aquí.
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { users } from './db.js';

export function issueToken(user) {
  return jwt.sign({ sub: String(user.id) }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: config.tokenTtlSeconds,
  });
}

/** Devuelve el usuario de la sesión, o null si el token es inválido/expirado. */
export function verifySession(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    return users.findById(Number(payload.sub)) ?? null;
  } catch {
    return null;
  }
}

export function requireSession(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = verifySession(token);
  if (!user) return res.status(401).json({ error: 'Sesión inválida o expirada' });
  req.user = user;
  next();
}
