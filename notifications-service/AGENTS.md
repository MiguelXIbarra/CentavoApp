# notifications-service

Este servicio genera, administra y consulta alertas de sobregasto y advertencias presupuestarias.
Nunca logueas tokens ni cabeceras de autorización. Toda validación de sesión de usuario debe pasar por un solo módulo
central y delegarse a auth-service; este servicio no conoce `JWT_SECRET` ni emite tokens.

## Convenciones
- Stack: Node 24 (ESM), Express, SQLite (`node:sqlite`).
- Módulo central de sesión: `src/session.js` (valida el Bearer llamando a `GET {AUTH_SERVICE_URL}/auth/me`).
- Montos y límites se manejan como enteros en centavos (`spent_cents`, `limit_cents`); la API expone montos en decimal (`spent`, `limit`).
- Cada alerta pertenece a un usuario (`user_id`); las consultas siempre filtran por el usuario de la sesión.
- Lógica de alertas de sobregasto:
  - Crítica (`OVERSPEND_ALERT` / `critical`): consumo >= 100% del límite de presupuesto en el periodo.
  - Advertencia (`BUDGET_WARNING` / `warning`): consumo >= 80% y < 100% del límite de presupuesto en el periodo.
- Endpoints:
  - `POST /events/transaction`: recibe un evento de transacción, evalúa contra presupuestos (y consumos acumulados) y genera alertas si supera umbrales.
  - `GET /notifications`: lista alertas del usuario autenticado (filtros opcionales `category`, `read`).
  - `PATCH /notifications/:id/read`: marca una alerta como leída.
- Puerto por defecto: 4004; ver `.env.example`.
- Tests: `npm test`.
