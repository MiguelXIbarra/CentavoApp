# transactions-service

Este servicio registra y categoriza movimientos financieros. Nunca logueas tokens ni cabeceras de autorización. Toda
validación de sesión debe pasar por un solo módulo central y delegarse a auth-service; este servicio no conoce
`JWT_SECRET` ni emite tokens.

## Convenciones
- Stack: Node 24 (ESM), Express, SQLite (`node:sqlite`).
- Módulo central de sesión: `src/session.js` (valida el Bearer llamando a `GET {AUTH_SERVICE_URL}/auth/me`).
- Montos se guardan como enteros en centavos (`amount_cents`); la API expone `amount` decimal.
- Fechas en formato `YYYY-MM-DD`.
- Cada transacción pertenece a un usuario (`user_id`); las consultas siempre filtran por el usuario de la sesión.
- Endpoints: `POST /transactions`, `GET /transactions` (Bearer; filtros opcionales `category`, `from`, `to`).
- Puerto por defecto: 4002; ver `.env.example`.
- Tests: `npm test`.
