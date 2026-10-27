# budgets-service

Este servicio define y consulta presupuestos y techos de gasto por categoría. Nunca logueas tokens ni cabeceras de autorización. Toda
validación de sesión debe pasar por un solo módulo central y delegarse a auth-service; este servicio no conoce
`JWT_SECRET` ni emite tokens.

## Convenciones
- Stack: Node 24 (ESM), Express, SQLite (`node:sqlite`).
- Módulo central de sesión: `src/session.js` (valida el Bearer llamando a `GET {AUTH_SERVICE_URL}/auth/me`).
- Montos límite se guardan como enteros en centavos (`limit_cents`); la API expone `limit` y `limit_amount` en formato decimal.
- Cada presupuesto pertenece a un usuario (`user_id`); las consultas siempre filtran por el usuario de la sesión.
- Endpoints: `POST /budgets`, `GET /budgets` (Bearer; filtros opcionales `category`, `period`).
- Puerto por defecto: 4003; ver `.env.example`.
- Tests: `npm test`.
