import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import type { UserRole } from '@/types/api';
import { Card } from '@/components/ui/Card';

interface RequireAuthProps {
  children: ReactNode;
  roles?: UserRole[];
}

export function RequireAuth({ children, roles }: RequireAuthProps) {
  const location = useLocation();
  const { accessToken, user, setUser, clearAuth } = useAuthStore();
  const [verifying, setVerifying] = useState(Boolean(accessToken && !user));

  useEffect(() => {
    let active = true;
    if (accessToken && !user) {
      setVerifying(true);
      api
        .getMe()
        .then((me) => {
          if (active) setUser(me);
        })
        .catch(() => {
          if (active) clearAuth();
        })
        .finally(() => {
          if (active) setVerifying(false);
        });
    } else {
      setVerifying(false);
    }
    return () => {
      active = false;
    };
  }, [accessToken, user, setUser, clearAuth]);

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (verifying || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
          <span>Verifying session credentials...</span>
        </div>
      </div>
    );
  }

  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return (
      <div className="max-w-lg mx-auto py-12">
        <Card className="text-center p-8">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 mb-3">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h2 className="text-2xl font-light tracking-[-0.035em] text-slate-900 dark:text-slate-100">
            Access restricted
          </h2>
          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Your current role (<span className="font-mono font-medium">{user.role}</span>) does not
            have permission to view this section. Required role: {roles.join(' or ')}.
          </p>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
