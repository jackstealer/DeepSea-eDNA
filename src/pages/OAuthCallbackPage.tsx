import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { getErrorBannerMessage } from '@/lib/utils';
import { BrandMark } from '@/components/common/BrandMark';

/**
 * Landing page after Google/GitHub sign-in. The backend redirects here with the
 * tokens in the URL fragment (#access_token=...&refresh_token=...), which never reaches any server.
 */
export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const { setTokens, setUser, clearAuth } = useAuthStore();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return; // StrictMode runs effects twice in development
    handled.current = true;

    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    // Remove tokens from the address bar and browser history
    window.history.replaceState(null, '', window.location.pathname);

    if (!accessToken || !refreshToken) {
      navigate('/login?oauth_error=' + encodeURIComponent('Sign-in did not complete. Please try again.'), {
        replace: true,
      });
      return;
    }

    setTokens(accessToken, refreshToken);
    api
      .getMe()
      .then((me) => {
        setUser(me);
        toast.success('Signed in', `Welcome, ${me.full_name || me.username}`);
        navigate('/', { replace: true });
      })
      .catch((err) => {
        clearAuth();
        navigate('/login?oauth_error=' + encodeURIComponent(getErrorBannerMessage(err)), { replace: true });
      });
  }, [navigate, setTokens, setUser, clearAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-strong flex flex-col items-center gap-4 rounded-[28px] border border-white/[0.08] px-10 py-8 text-xs text-slate-500 dark:text-slate-400">
        <BrandMark className="h-8 w-8" />
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
        <span>Completing sign-in...</span>
      </div>
    </div>
  );
}
