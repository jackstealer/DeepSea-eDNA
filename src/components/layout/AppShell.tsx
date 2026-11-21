import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  ChevronDown,
  Compass,
  Cpu,
  Dna,
  FlaskConical,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Server,
  Settings,
  Shield,
  WifiOff,
  X,
} from 'lucide-react';
import { DEFAULT_API_BASE_URL, useAuthStore } from '@/store/authStore';
import { useBackendHealth } from '@/hooks/useBackendHealth';
import { api } from '@/lib/api';
import { toast } from '@/store/toastStore';
import { cn } from '@/lib/utils';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { BrandMark } from '@/components/common/BrandMark';
import { PageTransition } from '@/components/motion/PageTransition';
import type { UserRole } from '@/types/api';
import { emitOceanEvent } from '@/lib/oceanEvents';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'scientist', 'viewer', 'api_user'],
  },
  {
    to: '/classify',
    label: 'Classify',
    icon: Dna,
    roles: ['admin', 'scientist', 'viewer', 'api_user'],
  },
  {
    to: '/history',
    label: 'My History',
    icon: History,
    roles: ['admin', 'scientist', 'viewer', 'api_user'],
  },
  {
    to: '/taxa',
    label: 'Taxa Explorer',
    icon: Compass,
    roles: ['admin', 'scientist', 'viewer', 'api_user'],
  },
  {
    to: '/models',
    label: 'Model Registry',
    icon: Cpu,
    roles: ['admin', 'scientist', 'viewer'],
  },
  {
    to: '/experiments',
    label: 'Experiments',
    icon: FlaskConical,
    roles: ['admin', 'scientist', 'viewer'],
  },
  {
    to: '/monitoring',
    label: 'Monitoring',
    icon: Activity,
    roles: ['admin'],
  },
  {
    to: '/admin',
    label: 'Admin',
    icon: Shield,
    roles: ['admin'],
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: Settings,
    roles: ['admin', 'scientist', 'viewer', 'api_user'],
  },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Overview Dashboard',
  '/classify': 'Sequence Classification',
  '/history': 'My Classification History',
  '/taxa': 'Marine Taxa Explorer',
  '/models': 'Model Registry',
  '/experiments': 'A/B Experiments',
  '/monitoring': 'System Monitoring',
  '/admin': 'Administration & RBAC',
  '/settings': 'Profile & Settings',
};

function roleBadgeTone(role: UserRole | undefined): BadgeTone {
  if (role === 'admin') return 'cyan';
  if (role === 'scientist') return 'teal';
  if (role === 'viewer') return 'blue';
  return 'neutral';
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user,
    clearAuth,
    apiBaseUrlOverride,
    setApiBaseUrlOverride,
    getEffectiveApiBaseUrl,
    backendUnreachable,
  } = useAuthStore();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [apiPopoverOpen, setApiPopoverOpen] = useState(false);
  const [apiDraft, setApiDraft] = useState(getEffectiveApiBaseUrl());
  // Pointing the UI at another backend is a developer tool, not something end users should see
  const allowApiOverride = import.meta.env.DEV;

  const healthQuery = useBackendHealth();
  const isHealthy = healthQuery.isSuccess && healthQuery.data?.status === 'healthy';
  const isUnreachable = healthQuery.isError || backendUnreachable;
  // Loading counts as healthy so the ocean never flickers grey on first paint
  const backendHealthy = !(isUnreachable || (healthQuery.isSuccess && healthQuery.data?.status !== 'healthy'));
  useEffect(() => {
    emitOceanEvent({ type: 'health', healthy: backendHealthy });
  }, [backendHealthy]);
  useEffect(() => () => emitOceanEvent({ type: 'health', healthy: true }), []);

  const visibleNav = NAV_ITEMS.filter(
    (item) => !user || item.roles.includes(user.role)
  );

  const pageTitle = PAGE_TITLES[location.pathname] ?? 'DeepSea eDNA AI';

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await api.logout();
    clearAuth();
    toast.info('Signed out', 'Your session has been closed.');
    navigate('/login');
  };

  const handleSaveApiOverride = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = apiDraft.trim().replace(/\/+$/, '');
    if (!cleaned || cleaned === DEFAULT_API_BASE_URL) {
      setApiBaseUrlOverride(null);
      setApiDraft(DEFAULT_API_BASE_URL);
      toast.success('API endpoint reset', `Using default ${DEFAULT_API_BASE_URL}`);
    } else {
      setApiBaseUrlOverride(cleaned);
      toast.success('API endpoint updated', `Runtime target set to ${cleaned}`);
    }
    setApiPopoverOpen(false);
    healthQuery.refetch();
  };

  const renderSidebarLinks = (mobile = false) => (
    <nav aria-label="Primary navigation" className="flex-1 space-y-1 px-2.5 py-4 overflow-y-auto">
      {visibleNav.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => mobile && setMobileMenuOpen(false)}
            className={({ isActive }) =>
              cn(
                'relative flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500',
                isActive
                  ? 'bg-slate-900/[0.05] text-slate-900 dark:bg-white/[0.07] dark:text-white before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-iridescent'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100',
                sidebarCollapsed && !mobile && 'justify-center px-2'
              )
            }
            title={sidebarCollapsed && !mobile ? item.label : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {(!sidebarCollapsed || mobile) && <span>{item.label}</span>}
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen flex text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-slate-200 dark:border-white/[0.06] bg-white dark:glass transition-[width] duration-200 shrink-0',
          sidebarCollapsed ? 'w-16' : 'w-60'
        )}
      >
        <div className="h-14 flex items-center justify-between px-3.5 border-b border-slate-200 dark:border-slate-800/80">
          <Link
            to="/"
            className="flex items-center gap-2.5 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded-md"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5 shrink-0">
              <BrandMark className="h-5 w-5" />
            </div>
            {!sidebarCollapsed && (
              <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100 truncate">
                DeepSea eDNA
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="rounded-md p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        {renderSidebarLinks(false)}

        {!sidebarCollapsed && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono">{getEffectiveApiBaseUrl()}</span>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 flex w-64 flex-col bg-white dark:glass-strong border-r border-slate-200 dark:border-white/[0.06]">
            <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                DeepSea eDNA
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="rounded-md p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {renderSidebarLinks(true)}
          </aside>
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-14 flex items-center justify-between gap-4 border-b border-slate-200 dark:border-white/[0.06] bg-white/90 backdrop-blur-md dark:glass px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="md:hidden rounded-lg p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-base sm:text-lg font-light tracking-[-0.02em] text-slate-900 dark:text-slate-100 truncate">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Backend Health + Runtime API URL Override */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (!allowApiOverride) {
                    healthQuery.refetch();
                    return;
                  }
                  setApiDraft(getEffectiveApiBaseUrl());
                  setApiPopoverOpen((v) => !v);
                }}
                aria-label="Backend health and API settings"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-cyan-500/50 transition-colors whitespace-nowrap"
              >
                <span
                  className={cn(
                    'h-2 w-2 rounded-full shrink-0',
                    healthQuery.isLoading
                      ? 'bg-amber-400'
                      : isHealthy
                      ? 'bg-emerald-500'
                      : 'bg-rose-500'
                  )}
                  aria-hidden="true"
                />
                <span className="hidden sm:inline">
                  {healthQuery.isLoading
                    ? 'Checking API'
                    : isHealthy
                    ? 'API Healthy'
                    : 'API Offline'}
                </span>
                {apiBaseUrlOverride && (
                  <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400">
                    Override
                  </span>
                )}
              </button>

              {allowApiOverride && apiPopoverOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:glass-strong p-4 shadow-xl z-40">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Server className="h-3.5 w-3.5 text-cyan-500" />
                      API Endpoint Settings
                    </span>
                    <button
                      type="button"
                      onClick={() => setApiPopoverOpen(false)}
                      aria-label="Close API settings"
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                    Runtime override (stored in memory only). Default: {DEFAULT_API_BASE_URL}
                  </p>
                  <form onSubmit={handleSaveApiOverride} className="space-y-2.5">
                    <input
                      type="url"
                      value={apiDraft}
                      onChange={(e) => setApiDraft(e.target.value)}
                      placeholder="http://localhost:8000"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/25 px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setApiDraft(DEFAULT_API_BASE_URL);
                          setApiBaseUrlOverride(null);
                          setApiPopoverOpen(false);
                          healthQuery.refetch();
                        }}
                        className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      >
                        Reset default
                      </button>
                      <button
                        type="submit"
                        className="rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3 py-1.5 text-xs font-medium text-white transition-colors"
                      >
                        Apply URL
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* User Menu */}
            {user && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((o) => !o)}
                  aria-label="Account menu"
                  aria-expanded={userMenuOpen}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.04] px-2.5 py-1.5 text-xs hover:border-cyan-500/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  {user.avatar_url && (
                    <img
                      src={user.avatar_url}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-5 w-5 rounded-full object-cover"
                    />
                  )}
                  <span className="font-medium text-slate-900 dark:text-slate-100 max-w-[110px] truncate">
                    {user.username}
                  </span>
                  <Badge tone={roleBadgeTone(user.role)}>{user.role}</Badge>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:glass-strong p-1.5 shadow-xl z-40">
                    <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 mb-1">
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {user.full_name || user.username}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {user.email}
                      </p>
                    </div>
                    <Link
                      to="/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Profile & Settings
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Backend Unreachable Friendly Banner */}
        {isUnreachable && (
          <div
            role="status"
            className="border-b border-amber-300/70 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 px-4 sm:px-6 py-2.5 text-xs text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              {allowApiOverride ? (
                <p className="leading-snug">
                  FastAPI backend unreachable at{' '}
                  <span className="font-mono font-semibold">{getEffectiveApiBaseUrl()}</span>. Verify
                  the server is running, <span className="font-mono">CORS_ORIGINS</span> allows this
                  origin, or adjust the URL in API settings (HTTPS pages cannot call plain HTTP
                  endpoints without browser mixed-content allowance).
                </p>
              ) : (
                <p className="leading-snug">
                  The service is temporarily unavailable. Your data is safe; please try again shortly.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {allowApiOverride && (
                <button
                  type="button"
                  onClick={() => {
                    setApiDraft(getEffectiveApiBaseUrl());
                    setApiPopoverOpen(true);
                  }}
                  className="rounded-md border border-amber-400/70 dark:border-amber-700 px-2.5 py-1 font-medium hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                >
                  API Settings
                </button>
              )}
              <button
                type="button"
                onClick={() => healthQuery.refetch()}
                className="rounded-md bg-amber-600 hover:bg-amber-500 px-2.5 py-1 font-medium text-white transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Main Viewport */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1440px] w-full mx-auto">
          <PageTransition routeKey={location.pathname}>
            <Suspense
              fallback={
                <div className="flex justify-center py-16">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                </div>
              }
            >
              {children}
            </Suspense>
          </PageTransition>
        </main>
      </div>
    </div>
  );
}
