/**
 * Módulo central de autenticación y validación de sesiones para Centavo.
 *
 * REGLAS DE SEGURIDAD (AGENTS.md):
 * 1. Toda validación de sesión debe pasar por este módulo central.
 * 2. NUNCA loguear credenciales, contraseñas ni tokens en texto plano (en console.log ni en métricas).
 */

const STORAGE_TOKEN_KEY = 'centavo_token';
const STORAGE_USER_KEY = 'centavo_user';
const API_BASE_URL = '/api/auth';

/**
 * Decodifica de forma segura la carga útil de un JWT para inspeccionar su fecha de expiración.
 * Sin exponer ni loguear el secreto ni el token.
 */
function parseJwtPayload(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

class AuthService {
  /**
   * Obtiene el token actual almacenado en el navegador.
   * @returns {string|null}
   */
  getToken() {
    return localStorage.getItem(STORAGE_TOKEN_KEY) || null;
  }

  /**
   * Obtiene la información del usuario autenticado en la sesión.
   * @returns {object|null}
   */
  getUser() {
    const raw = localStorage.getItem(STORAGE_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Comprueba si existe un token almacenado y no ha expirado.
   * Toda comprobación de sesión pasa por este método.
   * @returns {boolean}
   */
  isAuthenticated() {
    const token = this.getToken();
    if (!token) return false;

    // Si es un token demo sintético
    if (token.startsWith('demo-session-token')) {
      return true;
    }

    const payload = parseJwtPayload(token);
    if (!payload) return false;

    if (payload.exp && Date.now() >= payload.exp * 1000) {
      this.logout();
      return false;
    }

    return true;
  }

  /**
   * Valida la sesión actual contactando al endpoint /auth/me del microservicio de autenticación.
   * Si el token es inválido o expiró en el servidor, limpia la sesión local.
   * @returns {Promise<{ valid: boolean, user?: object }>}
   */
  async validateSession() {
    const token = this.getToken();
    if (!token) {
      return { valid: false };
    }

    if (token.startsWith('demo-session-token')) {
      const user = this.getUser();
      return { valid: true, user: user || { id: 'demo-1', name: 'Usuario Demo', email: 'demo@centavo.app' } };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        this.logout();
        return { valid: false };
      }

      const data = await response.json();
      if (data?.user) {
        this._setSession(token, data.user);
        return { valid: true, user: data.user };
      }
      return { valid: false };
    } catch {
      // Si el backend no está disponible en este instante, revisa la validez local del JWT
      const isValidLocally = this.isAuthenticated();
      return { valid: isValidLocally, user: isValidLocally ? this.getUser() : null };
    }
  }

  /**
   * Inicia sesión con email y contraseña comunicándose con el microservicio.
   * @param {string} email
   * @param {string} password
   */
  async login(email, password) {
    if (!email || !password) {
      throw new Error('Debes ingresar tu correo y contraseña.');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data.error || 'Credenciales inválidas o error en el servidor.';
        throw new Error(errorMsg);
      }

      if (!data.token || !data.user) {
        throw new Error('Respuesta de autenticación incompleta.');
      }

      this._setSession(data.token, data.user);
      return { user: data.user };
    } catch (err) {
      // Verificamos si fue falla de conexión con el backend
      if (err.message.includes('Failed to fetch') || err.name === 'TypeError') {
        throw new Error('No se pudo conectar con el servicio de autenticación (auth-service). Verifica que esté encendido.');
      }
      throw err;
    }
  }

  /**
   * Registro de nuevo usuario.
   * @param {string} name
   * @param {string} email
   * @param {string} password
   */
  async register(name, email, password) {
    if (!name || !email || !password) {
      throw new Error('Todos los campos son obligatorios.');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'No fue posible registrar la cuenta.');
      }

      this._setSession(data.token, data.user);
      return { user: data.user };
    } catch (err) {
      if (err.message.includes('Failed to fetch') || err.name === 'TypeError') {
        throw new Error('No se pudo conectar con el servicio de autenticación (auth-service).');
      }
      throw err;
    }
  }

  /**
   * Inicia una sesión simulada en modo demostración para explorar la interfaz.
   */
  loginAsDemo() {
    const demoUser = {
      id: 'demo-centavo-user',
      name: 'Alejandro Morales',
      email: 'alejandro@centavo.app',
    };
    const demoToken = `demo-session-token-${Date.now()}`;
    this._setSession(demoToken, demoUser);
    return demoUser;
  }

  /**
   * Cierra la sesión activa y limpia las credenciales almacenadas.
   */
  logout() {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
  }

  /**
   * @private
   */
  _setSession(token, user) {
    if (token) localStorage.setItem(STORAGE_TOKEN_KEY, token);
    if (user) localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
  }
}

export const authService = new AuthService();
export default authService;
