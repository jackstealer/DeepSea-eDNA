import { create } from 'zustand';
import type { User, UserRole } from '@/types/api';

const SESSION_ACCESS_KEY = 'deepsea_access_token';
const SESSION_REFRESH_KEY = 'deepsea_refresh_token';
const SESSION_USER_KEY = 'deepsea_user';
const THEME_STORAGE_KEY = 'deepsea_theme';

export const DEFAULT_API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:8000';

type ThemeMode = 'dark' | 'light';

function readSessionString(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionString(key: string, value: string | null) {
  try {
    if (value === null) {
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, value);
    }
  } catch {
    // Ignore storage errors in restricted environments
  }
}

function readInitialUser(): User | null {
  const raw = readSessionString(SESSION_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

// Dark only for now: the cinematic redesign has no light palette yet. The theme field and setters
// stay so light mode can come back later by reading THEME_STORAGE_KEY here again.
function readInitialTheme(): ThemeMode {
  return 'dark';
}

export function applyThemeToDom(theme: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  apiBaseUrlOverride: string | null; // Memory-only runtime override
  theme: ThemeMode;
  backendUnreachable: boolean;
  lastNetworkErrorMessage: string | null;

  setTokens: (accessToken: string, refreshToken?: string | null) => void;
  setUser: (user: User | null) => void;
  clearAuth: () => void;
  setApiBaseUrlOverride: (url: string | null) => void;
  getEffectiveApiBaseUrl: () => string;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setBackendStatus: (unreachable: boolean, errorMessage?: string | null) => void;
  hasRole: (roles: UserRole[]) => boolean;
  canWriteModelsOrExperiments: () => boolean;
}

const initialTheme = readInitialTheme();
applyThemeToDom(initialTheme);

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: readSessionString(SESSION_ACCESS_KEY),
  refreshToken: readSessionString(SESSION_REFRESH_KEY),
  user: readInitialUser(),
  apiBaseUrlOverride: null,
  theme: initialTheme,
  backendUnreachable: false,
  lastNetworkErrorMessage: null,

  setTokens: (accessToken, refreshToken) => {
    writeSessionString(SESSION_ACCESS_KEY, accessToken);
    if (refreshToken !== undefined) {
      writeSessionString(SESSION_REFRESH_KEY, refreshToken);
    }
    set((state) => ({
      accessToken,
      refreshToken: refreshToken !== undefined ? refreshToken : state.refreshToken,
    }));
  },

  setUser: (user) => {
    writeSessionString(SESSION_USER_KEY, user ? JSON.stringify(user) : null);
    set({ user });
  },

  clearAuth: () => {
    writeSessionString(SESSION_ACCESS_KEY, null);
    writeSessionString(SESSION_REFRESH_KEY, null);
    writeSessionString(SESSION_USER_KEY, null);
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
    });
  },

  setApiBaseUrlOverride: (url) => {
    const cleaned = url?.trim() ? url.trim().replace(/\/+$/, '') : null;
    set({
      apiBaseUrlOverride: cleaned,
      backendUnreachable: false,
      lastNetworkErrorMessage: null,
    });
  },

  getEffectiveApiBaseUrl: () => {
    const override = get().apiBaseUrlOverride;
    return (override || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
  },

  setTheme: (theme) => {
    applyThemeToDom(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore
    }
    set({ theme });
  },

  toggleTheme: () => {
    const next: ThemeMode = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },

  setBackendStatus: (unreachable, errorMessage = null) => {
    set({
      backendUnreachable: unreachable,
      lastNetworkErrorMessage: errorMessage,
    });
  },

  hasRole: (roles) => {
    const user = get().user;
    if (!user) return false;
    return roles.includes(user.role);
  },

  canWriteModelsOrExperiments: () => {
    const role = get().user?.role;
    return role === 'admin' || role === 'scientist';
  },
}));
