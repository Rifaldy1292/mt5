/**
 * Svelte API Client for MT5 Python Bridge
 * Compatible with SvelteKit (client & server) or standard Svelte applications.
 */

export class MT5ApiClient {
  constructor(baseUrl = 'http://127.0.0.1:5050') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async _request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    try {
      const res = await fetch(url, { ...options, headers });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
      }
      return data;
    } catch (err) {
      console.error(`[MT5ApiClient Error] ${path}:`, err.message);
      throw err;
    }
  }

  async checkHealth() {
    return this._request('/health');
  }

  async login(login, password, server, terminalPath = '') {
    return this._request('/api/mt5/login', {
      method: 'POST',
      body: JSON.stringify({
        login: Number(login),
        password: String(password),
        server: String(server),
        terminalPath: terminalPath || undefined
      })
    });
  }

  async getSnapshot() {
    const res = await this._request('/api/mt5/snapshot');
    return res.data;
  }

  async getHistory(days = 60) {
    const res = await this._request(`/api/mt5/history?days=${encodeURIComponent(days)}`);
    return res.data;
  }

  async disconnect() {
    return this._request('/api/mt5/disconnect', { method: 'POST' });
  }
}

export const defaultApiClient = new MT5ApiClient();
