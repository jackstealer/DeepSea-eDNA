import { useState } from 'react';
import { CheckCircle2, KeyRound, RotateCcw, Server, User as UserIcon } from 'lucide-react';
import { DEFAULT_API_BASE_URL, useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { toast } from '@/store/toastStore';
import { formatDateTime, getErrorBannerMessage } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';

const PROVIDER_LABELS: Record<string, string> = { google: 'Google', github: 'GitHub' };

export function SettingsPage() {
  const {
    user,
    setUser,
    apiBaseUrlOverride,
    setApiBaseUrlOverride,
    getEffectiveApiBaseUrl,
  } = useAuthStore();

  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [apiInput, setApiInput] = useState(getEffectiveApiBaseUrl());
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    setSavingName(true);
    try {
      setUser(await api.updateMe(fullName.trim()));
      toast.success('Profile updated');
    } catch (err) {
      toast.error('Could not update profile', getErrorBannerMessage(err));
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveApi = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = apiInput.trim().replace(/\/+$/, '');
    if (!cleaned || cleaned === DEFAULT_API_BASE_URL) {
      setApiBaseUrlOverride(null);
      setApiInput(DEFAULT_API_BASE_URL);
      toast.success('API endpoint reset', `Using ${DEFAULT_API_BASE_URL}`);
    } else {
      setApiBaseUrlOverride(cleaned);
      toast.success('API endpoint updated', `Runtime override set to ${cleaned}`);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestStatus(null);
    try {
      const res = await api.getHealth();
      setTestStatus(`Connected: ${res.status} (model_loaded=${String(res.model_loaded)})`);
      toast.success('Backend reachable', `Health status: ${res.status}`);
    } catch (err) {
      const msg = getErrorBannerMessage(err);
      setTestStatus(`Error: ${msg}`);
      toast.error('Connection test failed', msg);
    } finally {
      setTesting(false);
    }
  };

  const signInMethods = user
    ? [...user.providers.map((p) => PROVIDER_LABELS[p] ?? p), ...(user.has_password ? ['Email & password'] : [])]
    : [];

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Your" accent="settings" />
      {/* User Profile */}
      <Card>
        <CardHeader
          title="Your Profile"
          subtitle="Account details for this workspace"
          action={<UserIcon className="h-4 w-4 text-cyan-500" />}
        />

        {user ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-500/15 text-sm font-semibold text-cyan-700 dark:text-cyan-300">
                  {(user.full_name || user.username).slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{user.full_name || user.username}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
              </div>
            </div>

            <form onSubmit={handleSaveName} className="flex flex-wrap items-end gap-2.5 text-xs">
              <div className="flex-1 min-w-[220px]">
                <label htmlFor="settings-full-name" className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Display name
                </label>
                <input
                  id="settings-full-name"
                  type="text"
                  value={fullName}
                  maxLength={200}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/25 px-3.5 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <button
                type="submit"
                disabled={savingName || !fullName.trim() || fullName.trim() === user.full_name}
                className="rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 px-4 py-2 font-medium text-white transition-colors"
              >
                {savingName ? 'Saving...' : 'Save'}
              </button>
            </form>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Username</dt>
                <dd className="mt-1 font-mono font-semibold text-slate-900 dark:text-slate-100">{user.username}</dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Role</dt>
                <dd className="mt-1">
                  <Badge tone="cyan">{user.role}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <KeyRound className="h-3 w-3" /> Sign-in methods
                </dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {signInMethods.map((m) => (
                    <Badge key={m} tone="neutral">{m}</Badge>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Member since</dt>
                <dd className="mt-1 font-mono text-slate-600 dark:text-slate-300">{formatDateTime(user.created_at)}</dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Last sign-in</dt>
                <dd className="mt-1 font-mono text-slate-600 dark:text-slate-300">{formatDateTime(user.last_login)}</dd>
              </div>
            </dl>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Signing in with Google or GitHub using the same email address links that account automatically.
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Not signed in.</p>
        )}
      </Card>

      {/* Runtime API Endpoint Override (development builds only) */}
      {import.meta.env.DEV && (
        <Card>
          <CardHeader
            title="FastAPI Backend Configuration"
            subtitle="Development only: runtime override stored in memory (resets on reload)"
            action={<Server className="h-4 w-4 text-cyan-500" />}
          />

          <form onSubmit={handleSaveApi} className="space-y-3 text-xs">
            <div>
              <label
                htmlFor="settings-api-url"
                className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                API Base URL
              </label>
              <input
                id="settings-api-url"
                type="url"
                value={apiInput}
                onChange={(e) => setApiInput(e.target.value)}
                placeholder={DEFAULT_API_BASE_URL}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/25 px-3.5 py-2 font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                Env default (<span className="font-mono">VITE_API_BASE_URL</span>):{' '}
                <span className="font-mono">{DEFAULT_API_BASE_URL}</span>
                {apiBaseUrlOverride ? ' · Override active' : ''}
              </p>
            </div>

            {testStatus && (
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-black/25 px-3 py-2 font-mono text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
                <span className="break-all">{testStatus}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="submit"
                className="rounded-lg bg-cyan-600 hover:bg-cyan-500 px-4 py-2 font-medium text-white transition-colors"
              >
                Apply Runtime URL
              </button>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                {testing ? 'Testing...' : 'Test /health'}
              </button>
              {apiBaseUrlOverride && (
                <button
                  type="button"
                  onClick={() => {
                    setApiBaseUrlOverride(null);
                    setApiInput(DEFAULT_API_BASE_URL);
                    toast.info('Reset', `Reverted to ${DEFAULT_API_BASE_URL}`);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </button>
              )}
            </div>
          </form>
        </Card>
      )}

      {/* Appearance: the app is dark only for now; the light/dark choice returns with light mode */}
    </div>
  );
}
