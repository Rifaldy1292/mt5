/**
 * Svelte Reactive Store for MT5 Bridge Connection & Real-Time Polling
 * Designed to work with `import { writable, derived } from 'svelte/store'`
 */
import { writable, derived } from 'svelte/store';
import { defaultApiClient } from './apiClient.js';

export function createMT5Store(apiClient = defaultApiClient) {
  const { subscribe, set, update } = writable({
    status: 'DISCONNECTED', // 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR'
    error: null,
    account: null,
    positions: [],
    openTradesCount: 0,
    floatingPnl: 0,
    lastSyncedAt: null
  });

  let pollInterval = null;

  async function connect(login, password, server, terminalPath = '') {
    update(s => ({ ...s, status: 'CONNECTING', error: null }));
    try {
      const res = await apiClient.login(login, password, server, terminalPath);
      update(s => ({
        ...s,
        status: 'CONNECTED',
        account: res.account,
        error: null,
        lastSyncedAt: new Date().toISOString()
      }));
      // Immediately fetch latest snapshot
      await syncSnapshot();
      return true;
    } catch (err) {
      update(s => ({
        ...s,
        status: 'ERROR',
        error: err.message
      }));
      return false;
    }
  }

  async function syncSnapshot() {
    try {
      const snap = await apiClient.getSnapshot();
      update(s => ({
        ...s,
        account: snap.account,
        positions: snap.positions,
        openTradesCount: snap.openTradesCount,
        floatingPnl: snap.floatingPnl,
        lastSyncedAt: new Date().toISOString()
      }));
      return snap;
    } catch (err) {
      console.warn('[mt5Store] syncSnapshot failed:', err.message);
    }
  }

  function startPolling(intervalMs = 3000) {
    stopPolling();
    pollInterval = setInterval(syncSnapshot, intervalMs);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  async function disconnect() {
    stopPolling();
    try {
      await apiClient.disconnect();
    } catch (e) {}
    set({
      status: 'DISCONNECTED',
      error: null,
      account: null,
      positions: [],
      openTradesCount: 0,
      floatingPnl: 0,
      lastSyncedAt: null
    });
  }

  return {
    subscribe,
    connect,
    syncSnapshot,
    startPolling,
    stopPolling,
    disconnect
  };
}

export const mt5 = createMT5Store();
