import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { AppShell } from '@/components/layout/AppShell';
import { ToastContainer } from '@/components/ui/Toast';
import { lazy } from 'react';
import { LoginPage } from '@/pages/LoginPage';
import { LandingPage } from '@/pages/LandingPage';
import { useAuthStore } from '@/store/authStore';
import type { UserRole } from '@/types/api';
import { OAuthCallbackPage } from '@/pages/OAuthCallbackPage';
import { OceanBackground } from '@/components/backdrop/OceanBackground';

// Pages load on first visit, so the login screen doesn't wait for charts and admin views
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ClassifyPage = lazy(() => import('@/pages/ClassifyPage').then((m) => ({ default: m.ClassifyPage })));
const TaxaExplorerPage = lazy(() => import('@/pages/TaxaExplorerPage').then((m) => ({ default: m.TaxaExplorerPage })));
const ModelsPage = lazy(() => import('@/pages/ModelsPage').then((m) => ({ default: m.ModelsPage })));
const ExperimentsPage = lazy(() => import('@/pages/ExperimentsPage').then((m) => ({ default: m.ExperimentsPage })));
const MonitoringPage = lazy(() => import('@/pages/MonitoringPage').then((m) => ({ default: m.MonitoringPage })));
const AdminPage = lazy(() => import('@/pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const HistoryPage = lazy(() => import('@/pages/HistoryPage').then((m) => ({ default: m.HistoryPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * One layout for every signed-in page, so the shell (and the ocean behind it) stays mounted across
 * navigation. Signed-out visitors at "/" get the product page instead.
 */
function ShellLayout() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { pathname } = useLocation();
  if (!accessToken && pathname === '/') return <LandingPage />;
  return (
    <RequireAuth>
      <AppShell>
        <Outlet />
      </AppShell>
    </RequireAuth>
  );
}

const SCIENCE_ROLES: UserRole[] = ['admin', 'scientist', 'viewer'];
const ADMIN_ROLES: UserRole[] = ['admin'];

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <OceanBackground />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
            <Route element={<ShellLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="classify" element={<ClassifyPage />} />
              <Route path="taxa" element={<TaxaExplorerPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="models" element={<RequireAuth roles={SCIENCE_ROLES}><ModelsPage /></RequireAuth>} />
              <Route path="experiments" element={<RequireAuth roles={SCIENCE_ROLES}><ExperimentsPage /></RequireAuth>} />
              <Route path="monitoring" element={<RequireAuth roles={ADMIN_ROLES}><MonitoringPage /></RequireAuth>} />
              <Route path="admin" element={<RequireAuth roles={ADMIN_ROLES}><AdminPage /></RequireAuth>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <ToastContainer />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
