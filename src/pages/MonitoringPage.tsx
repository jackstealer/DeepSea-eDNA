import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Database, ExternalLink, Pause, Play, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { formatNumber, getErrorBannerMessage } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';

interface TelemetryPoint {
  time: string;
  cpu: number;
  memory: number;
  requestRate: number;
  errorRate: number;
}

const MAX_WINDOW = 30;

export function MonitoringPage() {
  const queryClient = useQueryClient();
  const { user, getEffectiveApiBaseUrl } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [pollingEnabled, setPollingEnabled] = useState(true);
  const [pollIntervalMs, setPollIntervalMs] = useState(5000);
  const [history, setHistory] = useState<TelemetryPoint[]>([]);
  const [confirmClearCache, setConfirmClearCache] = useState(false);

  const dashboardQ = useQuery({
    queryKey: ['monitoring-live-dashboard'],
    queryFn: () => api.getDashboardMetrics(),
    refetchInterval: pollingEnabled ? pollIntervalMs : false,
  });

  const cacheStatsQ = useQuery({
    queryKey: ['monitoring-cache-stats'],
    queryFn: () => api.getCacheStats(),
    refetchInterval: pollingEnabled ? pollIntervalMs : false,
  });

  const cacheBackendQ = useQuery({
    queryKey: ['monitoring-cache-backend'],
    queryFn: () => api.getCacheBackend(),
  });

  useEffect(() => {
    const data = dashboardQ.data;
    if (!data) return;

    const nowLabel = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const nextPoint: TelemetryPoint = {
      time: nowLabel,
      cpu: Number((data.system?.cpu?.usage_percent ?? 0).toFixed(1)),
      memory: Number((data.system?.memory?.usage_percent ?? 0).toFixed(1)),
      requestRate: Number((data.requests?.rate_per_minute ?? 0).toFixed(2)),
      errorRate: Number((data.errors?.rate_per_minute ?? 0).toFixed(2)),
    };

    setHistory((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].time === nextPoint.time) {
        return prev;
      }
      const combined = [...prev, nextPoint];
      return combined.slice(-MAX_WINDOW);
    });
  }, [dashboardQ.data, dashboardQ.dataUpdatedAt]);

  const clearCacheMutation = useMutation({
    mutationFn: () => api.clearCache(),
    onSuccess: (res) => {
      toast.success('Cache cleared', `Removed ${res.cleared_keys} cached keys.`);
      setConfirmClearCache(false);
      queryClient.invalidateQueries({ queryKey: ['monitoring-cache-stats'] });
      queryClient.invalidateQueries({ queryKey: ['cache-stats'] });
    },
    onError: (err) => {
      toast.error('Failed to clear cache', getErrorBannerMessage(err));
    },
  });

  const swaggerUrl = `${getEffectiveApiBaseUrl()}/api/docs`;
  const cacheStats = cacheStatsQ.data ?? dashboardQ.data?.cache;
  const backendName = cacheBackendQ.data?.backend ?? cacheStats?.cache_type ?? 'unknown';

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="dark:on-water">
          <h1 className="text-[clamp(1.75rem,3vw,2.5rem)] font-light leading-[1.05] tracking-[-0.035em] text-ds-ink">
            Live telemetry &amp; cache <span className="accent-phrase text-iridescent">observability</span>
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
            Rolling in-memory telemetry window sampled from <span className="font-mono">/monitoring/dashboard</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Polling cadence"
            value={pollIntervalMs}
            onChange={(e) => setPollIntervalMs(Number(e.target.value))}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:glass px-3 py-1.5 text-xs font-mono"
          >
            <option value={5000}>Poll: 5s</option>
            <option value={10000}>Poll: 10s</option>
          </select>

          <button
            type="button"
            onClick={() => setPollingEnabled((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:glass px-3 py-1.5 text-xs font-medium hover:border-cyan-500/50"
          >
            {pollingEnabled ? (
              <>
                <Pause className="h-3.5 w-3.5 text-amber-500" /> Pause stream
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 text-emerald-500" /> Resume stream
              </>
            )}
          </button>

          <a
            href={swaggerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3.5 py-1.5 text-xs font-medium text-white transition-colors"
          >
            Swagger Docs
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {dashboardQ.isError && (
        <ErrorState
          title="Monitoring endpoint unreachable"
          error={dashboardQ.error}
          onRetry={() => dashboardQ.refetch()}
        />
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader
            title="CPU & Memory Utilization (%)"
            subtitle={`Rolling ${history.length}/${MAX_WINDOW} samples`}
          />
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#1E293B',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#F8FAFC',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cpu"
                  name="CPU %"
                  stroke="#22D3EE"
                  fill="#22D3EE"
                  fillOpacity={0.14}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="memory"
                  name="Memory %"
                  stroke="#14B8A6"
                  fill="#14B8A6"
                  fillOpacity={0.12}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Request & Error Throughput (/min)"
            subtitle="Live API traffic and error rate per minute"
          />
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#1E293B',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#F8FAFC',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="requestRate"
                  name="Requests / min"
                  stroke="#38BDF8"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="errorRate"
                  name="Errors / min"
                  stroke="#F43F5E"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Cache Statistics Panel */}
      <Card>
        <CardHeader
          title="Prediction Cache Telemetry"
          subtitle="Live statistics from /cache/stats and /cache/backend"
          action={
            <div className="flex items-center gap-2">
              <Badge tone={backendName === 'redis' ? 'emerald' : 'cyan'}>
                <Database className="h-3 w-3" />
                Backend: {backendName}
              </Badge>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setConfirmClearCache(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 text-xs font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear cache
                </button>
              )}
            </div>
          }
        />

        {cacheStatsQ.isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : cacheStatsQ.isError ? (
          <ErrorState title="Failed to load cache stats" error={cacheStatsQ.error} />
        ) : (
          <dl className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-black/25 p-3.5">
              <dt className="text-[11px] text-slate-500">Cache Hits</dt>
              <dd className="mt-1 text-lg font-semibold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {cacheStats?.hits !== undefined ? formatNumber(cacheStats.hits) : 'N/A'}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-black/25 p-3.5">
              <dt className="text-[11px] text-slate-500">Cache Misses</dt>
              <dd className="mt-1 text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {cacheStats?.misses !== undefined ? formatNumber(cacheStats.misses) : 'N/A'}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-black/25 p-3.5">
              <dt className="text-[11px] text-slate-500">Hit Rate</dt>
              <dd className="mt-1 text-lg font-semibold font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
                {typeof cacheStats?.hit_rate === 'number'
                  ? `${cacheStats.hit_rate.toFixed(2)}%`
                  : 'N/A'}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-black/25 p-3.5">
              <dt className="text-[11px] text-slate-500">Total Keys</dt>
              <dd className="mt-1 text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {formatNumber(cacheStats?.total_keys ?? 0)}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-black/25 p-3.5">
              <dt className="text-[11px] text-slate-500">Prediction Keys</dt>
              <dd className="mt-1 text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {formatNumber(cacheStats?.prediction_keys ?? 0)}
              </dd>
            </div>
          </dl>
        )}

        {cacheStats?.note && (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{cacheStats.note}</p>
        )}
      </Card>

      <ConfirmDialog
        open={confirmClearCache}
        title="Clear prediction cache?"
        description="All cached DNA classification results will be purged from the active cache store."
        confirmLabel="Clear cache"
        tone="danger"
        loading={clearCacheMutation.isPending}
        onConfirm={() => clearCacheMutation.mutate()}
        onCancel={() => setConfirmClearCache(false)}
      />
    </div>
  );
}
