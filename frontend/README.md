# Centavo Frontend 🪙

Frontend interactivo (SPA Dashboard) para **Centavo**, diseñado con **React 19**, **Vite** y **Tailwind CSS**.

---

## 🚀 Características del Scaffold

- **Pantalla de Autenticación (`LoginView`):**
  - Inicio de sesión y registro de usuario.
  - Validación de campos en cliente y manejo seguro de contraseñas.
  - Acceso rápido a demostración (Modo Demo) para previsualización inmediata.
  - Cumple estrictamente con las directivas de seguridad de `AGENTS.md` (sin logueo de credenciales en texto plano; sesión gobernada por un único módulo central).
- **Módulo Central de Sesión (`src/services/auth.js`):**
  - Módulo único encargado de validar tokens, almacenar la sesión y comunicarse con `auth-service` en `/auth/login`, `/auth/register` y `/auth/me`.
- **Pantalla Principal (`DashboardView`):**
  - Barra superior con identidad de marca, navegación, notificaciones y perfil de usuario con cierre de sesión.
  - Tarjetas métricas (KPIs) de Balance General, Ingresos acumulados, Gastos acumulados y Presupuesto mensual.
  - **Listado vacío de transacciones:**
    - Estado vacío (*empty state*) interactivo con ilustración, descripción explicativa y botón de acción para registrar la primera transacción.
    - Barra de filtros (Todas, Gastos, Ingresos) y buscador en tiempo real.
    - Modal de captura rápida para agregar transacciones y verificar el comportamiento reactivo.

---

## 📂 Estructura de Archivos

```text
frontend/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   ├── context/
│   │   └── AuthContext.jsx       # Contexto React para consumo de la sesión
│   ├── services/
│   │   └── auth.js               # Módulo central de autenticación y sesión
│   └── components/
│       ├── LoginView.jsx         # Pantalla de inicio de sesión / registro
│       └── DashboardView.jsx     # Pantalla principal con listado vacío de transacciones
```

---

## 🛠️ Ejecución en Desarrollo

1. Instalar dependencias (ya instaladas):
   ```bash
   cd frontend
   npm install
   ```

2. Iniciar el servidor de desarrollo:
   ```bash
   npm run dev
   ```
   El frontend correrá en `http://localhost:3000`.

3. Para compilar a producción:
   ```bash
   npm run build
   ```
