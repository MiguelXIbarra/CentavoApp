// ÚNICO módulo que valida sesiones en este servicio. No verifica JWT localmente:
// delega en auth-service (GET /auth/me), que es quien emite y valida los tokens.
import { config } from './config.js';

/** Devuelve el usuario de la sesión, o null si el token es inválido/expirado. Lanza si auth-service no responde. */
export async function verifySession(token) {
  if (!token) return null;
  const res = await fetch(`${config.authServiceUrl}/auth/me`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5000),
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`auth-service respondió ${res.status}`);
  const { user } = await res.json();
  return user ?? null;
}

export async function requireSession(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  let user;
  try {
    user = await verifySession(token);
  } catch (err) {
    console.error('Error validando sesión:', err.message);
    return res.status(503).json({ error: 'Servicio de autenticación no disponible' });
  }
  if (!user) return res.status(401).json({ error: 'Sesión inválida o expirada' });
  req.user = user;
  next();
}
