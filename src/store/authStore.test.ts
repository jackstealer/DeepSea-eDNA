// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest';

// Node 25 ships its own half-configured `localStorage` global, so give the store a real in-memory one.
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
  document.documentElement.classList.remove('dark');
});

test('theme is pinned to dark even when light was saved earlier', async () => {
  localStorage.setItem('deepsea_theme', 'light');
  const { useAuthStore } = await import('./authStore');
  expect(useAuthStore.getState().theme).toBe('dark');
  expect(document.documentElement.classList.contains('dark')).toBe(true);
});
