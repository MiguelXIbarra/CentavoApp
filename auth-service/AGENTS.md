# auth-service

Este servicio maneja autenticación y contraseñas. Nunca logueas credenciales ni tokens en texto plano. Toda validación de
sesión debe pasar por un solo módulo central. Cualquier cambio a la lógica de hashing de contraseñas requiere
justificación explícita en el plan antes de ejecutarse.

## Convenciones
- Stack: Node 24 (ESM), Express, SQLite (`node:sqlite`), JWT (HS256).
- Módulo central de sesión: `src/session.js` (único que emite/valida tokens).
- Hashing: `src/passwords.js` (scrypt). No tocar sin justificación.
- `JWT_SECRET` (>= 32 caracteres) obligatorio vía entorno; ver `.env.example`.
- Endpoints: `POST /auth/register`, `POST /auth/login`, `GET /auth/me` (Bearer).
- Tests: `npm test`.
