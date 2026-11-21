import { lazy, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, UserCheck } from 'lucide-react';
import { BrandMark } from '@/components/common/BrandMark';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { toast } from '@/store/toastStore';
import { cn, getErrorBannerMessage } from '@/lib/utils';
import { OAuthButtons } from '@/components/auth/OAuthButtons';
import { TAXA_CATALOG, TAXA_REFERENCE } from '@/data/taxaReference';
import { Scene3DGate } from '@/components/three/Scene3DGate';
import type { HeroStat } from '@/components/three/AbyssHero';
import { CountUp } from '@/components/motion/CountUp';
import { SplitReveal } from '@/components/motion/SplitReveal';
import { useLenis } from '@/lib/motion/useLenis';
import { gsap, useGSAP } from '@/lib/motion/gsap';
import { usePrefersReducedMotion } from '@/components/three/Scene3DGate';

// three.js is only downloaded when the scene is shown (separate chunk)
const AbyssHero = lazy(() => import('@/components/three/AbyssHero'));

// Measured on the held-out validation split (see scripts/build_taxa_catalog.py)
const VALIDATION_ACCURACY = TAXA_CATALOG.validation
  ? `${(TAXA_CATALOG.validation.accuracy * 100).toFixed(1)}%`
  : '—';
const PHYLA = Array.from(new Set(TAXA_REFERENCE.map((t) => t.lineage[1])));
const HERO_STATS: HeroStat[] = [
  { value: VALIDATION_ACCURACY, label: 'held-out accuracy' },
  { value: `${TAXA_REFERENCE.length} taxa`, label: `${PHYLA.length} phyla` },
  { value: TAXA_CATALOG.totalSequences.toLocaleString(), label: 'training sequences' },
  { value: TAXA_REFERENCE.reduce((n, t) => n + t.speciesCount, 0).toLocaleString(), label: 'species' },
];

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  useLenis(true);
  useGSAP(
    () => {
      if (reducedMotion || !panelRef.current) return;
      gsap.from(panelRef.current, { y: 40, opacity: 0, duration: 0.6, ease: 'power3.out', clearProps: 'opacity,transform' });
    },
    { dependencies: [reducedMotion] }
  );
  const {
    accessToken,
    user,
    setTokens,
    setUser,
  } = useAuthStore();

  // "Create an account" on the landing page links here with ?mode=register
  const [tab, setTab] = useState<'login' | 'register'>(() =>
    new URLSearchParams(location.search).get('mode') === 'register' ? 'register' : 'login'
  );

  // Login form state (never prefilled)
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  // Google/GitHub sign-in failures come back as ?oauth_error=...
  const [formError, setFormError] = useState<string | null>(
    () => new URLSearchParams(location.search).get('oauth_error')
  );

  // Register form state (never prefilled)
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  if (accessToken && user) {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';
    return <Navigate to={from} replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!username.trim() || !password) {
      setFormError('Username or email and password are required.');
      return;
    }

    setLoginLoading(true);
    try {
      const tokens = await api.login(username.trim(), password);
      setTokens(tokens.access_token, tokens.refresh_token);
      const me = await api.getMe();
      setUser(me);
      toast.success('Authenticated', `Signed in as ${me.username} (${me.role})`);
      const target =
        (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';
      navigate(target, { replace: true });
    } catch (err) {
      setFormError(getErrorBannerMessage(err));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!regUsername.trim() || !regEmail.trim() || !regFullName.trim() || !regPassword) {
      setFormError('All registration fields are required.');
      return;
    }
    if (regPassword.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }

    setRegLoading(true);
    try {
      const created = await api.register({
        username: regUsername.trim(),
        email: regEmail.trim(),
        full_name: regFullName.trim(),
        password: regPassword,
      });
      // Sign the new user straight in
      const tokens = await api.login(created.username, regPassword);
      setTokens(tokens.access_token, tokens.refresh_token);
      setUser(await api.getMe());
      toast.success('Welcome aboard', `Account ${created.username} created.`);
      navigate('/', { replace: true });
    } catch (err) {
      setFormError(getErrorBannerMessage(err));
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-12 text-slate-900 dark:text-slate-100">
      {/* Left Hero Panel */}
      <div className="relative lg:col-span-7 flex flex-col justify-between overflow-hidden bg-transparent text-slate-100 p-8 sm:p-12 lg:p-16 border-b lg:border-b-0 lg:border-r border-slate-800/80">
        {/* Interactive 3D scene (glass orb with DNA over an abyssal seafloor); the SVG is the fallback */}
        <Scene3DGate
          className="pointer-events-none absolute inset-0"
          fallback={
            <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-35" aria-hidden="true">
              <svg
                className="absolute -right-24 top-1/2 -translate-y-1/2 h-[640px] w-[640px] animate-helix-float text-cyan-400/25"
                viewBox="0 0 400 600"
                fill="none"
              >
                {Array.from({ length: 16 }).map((_, i) => {
                  const y = 30 + i * 34;
                  const phase = (i / 15) * Math.PI * 3;
                  const x1 = 200 + Math.sin(phase) * 95;
                  const x2 = 200 - Math.sin(phase) * 95;
                  return (
                    <g key={i}>
                      <line
                        x1={x1}
                        y1={y}
                        x2={x2}
                        y2={y}
                        stroke="currentColor"
                        strokeWidth="1.25"
                        strokeDasharray="3 4"
                        opacity="0.55"
                      />
                      <circle cx={x1} cy={y} r="4.5" fill="#22D3EE" opacity="0.7" />
                      <circle cx={x2} cy={y} r="4.5" fill="#14B8A6" opacity="0.7" />
                    </g>
                  );
                })}
              </svg>

              <svg
                className="absolute bottom-0 left-0 w-[120%] h-48 animate-wave-drift text-cyan-500/15"
                viewBox="0 0 1200 200"
                preserveAspectRatio="none"
                fill="none"
              >
                <path
                  d="M0 120 C 200 60, 400 180, 600 110 C 800 40, 1000 160, 1200 90 L 1200 200 L 0 200 Z"
                  fill="currentColor"
                />
                <path
                  d="M0 150 C 250 100, 450 190, 700 130 C 900 80, 1050 170, 1200 120"
                  stroke="#22D3EE"
                  strokeWidth="1.5"
                  opacity="0.4"
                />
              </svg>
            </div>
          }
        >
          {({ animate, gentle }) => <AbyssHero stats={HERO_STATS} animate={animate} gentle={gentle} />}
        </Scene3DGate>
        {/* Keeps the copy readable over the scene */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#070D19]/70 via-transparent to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-[#070D19] via-[#070D19]/85 to-transparent"
          aria-hidden="true"
        />

        {/* Brand */}
        <div className="relative z-10 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 rounded-xl" aria-label="DeepSea eDNA AI home">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
              <BrandMark />
            </span>
            <span>
              <span className="block text-base font-medium tracking-tight text-white">DeepSea eDNA AI</span>
              <span className="block text-xs text-slate-400">Marine Biodiversity Classification</span>
            </span>
          </Link>

        </div>

        {/* Scientific Summary */}
        {/* Copy docked at the bottom so the 3D orb owns the upper half (as in the reference designs) */}
        <div className="relative z-10 mt-60 sm:mt-72 lg:mt-auto mb-8 max-w-xl">
          <p className="text-xs font-mono text-cyan-400 tracking-wide mb-3">
            CNN + self-attention taxonomic classifier
          </p>
          <SplitReveal as="h1" className="text-4xl sm:text-5xl font-light tracking-[-0.035em] text-white leading-[1.02] [text-wrap:balance]">
            Taxonomic clarity{' '}
            {/* .dark keeps the bright gradient: this panel is dark in both themes */}
            <span className="dark accent-phrase text-iridescent">from abyssal environmental DNA</span>
          </SplitReveal>
          <p className="mt-4 text-sm text-slate-300 leading-relaxed max-w-lg">
            Classify marine DNA barcodes (mostly COI and cytochrome b) into {TAXA_REFERENCE.length}{' '}
            taxonomic orders and classes, with {VALIDATION_ACCURACY} accuracy on held-out data, novelty
            flags for low-confidence reads, and MLflow-tracked model versions.
          </p>

          <dl className="mt-8 grid grid-cols-3 gap-6 border-t border-slate-800/90 pt-6">
            <div>
              <dt className="text-xs text-slate-400">Held-out accuracy</dt>
              <dd className="mt-1 text-xl font-semibold font-mono tabular-nums text-cyan-300">
                <CountUp value={VALIDATION_ACCURACY} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Marine Taxa</dt>
              <dd className="mt-1 text-xl font-semibold font-mono tabular-nums text-white">
                <CountUp value={TAXA_REFERENCE.length} /> Groups
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Sequence Window</dt>
              <dd className="mt-1 text-xl font-semibold font-mono tabular-nums text-white">
                100–1,000 bp
              </dd>
            </div>
          </dl>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3 text-xs text-slate-400">
          {PHYLA.map((phylum, i) => (
            <span key={phylum} className="inline-flex items-center gap-3">
              {i > 0 && <span aria-hidden="true">·</span>}
              {phylum}
            </span>
          ))}
        </div>
      </div>

      {/* Right Auth Card Panel */}
      <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 sm:p-10 lg:p-14">
        <div className="w-full max-w-md space-y-6">
          <div ref={panelRef} className="glass-hover rounded-[28px] border border-slate-200 dark:border-white/[0.08] bg-white dark:glass-strong p-6 sm:p-8 shadow-xl shadow-slate-950/5">
            {/* Tabs */}
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-black/25 p-1 mb-6 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setFormError(null);
                }}
                className={cn(
                  'flex-1 rounded-md py-2 text-xs font-medium transition-colors',
                  tab === 'login'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                )}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setFormError(null);
                }}
                className={cn(
                  'flex-1 rounded-md py-2 text-xs font-medium transition-colors',
                  tab === 'register'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                )}
              >
                Register
              </button>
            </div>

            {formError && (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-rose-200 dark:border-rose-800/70 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300"
              >
                {formError}
              </div>
            )}

            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Sign in to workspace
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Classify marine eDNA and keep a private history of your results.
                  </p>
                </div>

                <OAuthButtons />

                <div>
                  <label
                    htmlFor="login-username"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Username or email
                  </label>
                  <input
                    id="login-username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="you@institute.org"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#09101D] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#09101D] pl-3.5 pr-10 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 px-4 py-2.5 text-sm font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  <Lock className="h-4 w-4" />
                  {loginLoading ? 'Signing in...' : 'Sign in'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Create research account
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    New accounts start with viewer access; an administrator can grant more.
                  </p>
                </div>

                <OAuthButtons />

                <div>
                  <label
                    htmlFor="reg-fullname"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Full name
                  </label>
                  <input
                    id="reg-fullname"
                    type="text"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="Dr. Marina Vance"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#09101D] px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="reg-username"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Username
                  </label>
                  <input
                    id="reg-username"
                    type="text"
                    autoComplete="username"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="mvance"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#09101D] px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="reg-email"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Email address
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="researcher@institute.org"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#09101D] px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="reg-password"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Password
                  </label>
                  <input
                    id="reg-password"
                    type="password"
                    autoComplete="new-password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="At least 8 characters, letters and numbers"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#09101D] px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={regLoading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-60 px-4 py-2.5 text-sm font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                >
                  <UserCheck className="h-4 w-4" />
                  {regLoading ? 'Creating account...' : 'Create account'}
                </button>
              </form>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
