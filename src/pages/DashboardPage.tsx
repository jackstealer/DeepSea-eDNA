import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Cpu,
  Database,
  Dna,
  FileStack,
  FlaskConical,
  Gauge,
  HardDrive,
  History,
  Server,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatBytes, formatDateTime, formatNumber, formatPercent, getConfidenceTier, statusTone } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuthStore } from '@/store/authStore';
import { PageHeader } from '@/components/ui/PageHeader';

function ResourceGauge({
  label,
  percent,
  detail,
  status,
}: {
  label: string;
  percent?: number;
  detail: string;
  status?: string;
}) {
  const pct = typeof percent === 'number' ? Math.max(0, Math.min(100, percent)) : 0;
  const barColor =
    pct >= 85 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-cyan-500';

  return (
    <div className="space-y-2 py-2.5 border-b last:border-b-0 border-slate-200/70 dark:border-slate-800/70">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-900 dark:text-slate-100">{label}</span>
          {status && <Badge tone={statusTone(status)}>{status}</Badge>}
        </div>
        <span className="text-xs font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
          {typeof percent === 'number' ? `${percent.toFixed(1)}%` : '—'}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
        {detail}
      </p>
    </div>
  );
}

function QuickAction({ to, icon, title, description }: { to: string; icon: ReactNode; title: string; description: string }) {
  return (
    <Link
      to={to}
      className="group rounded-xl border border-slate-200 dark:border-white/[0.07] bg-white dark:glass p-5 hover:border-cyan-500/60 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
          {icon}
        </div>
        <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-cyan-500 transition-transform group-hover:translate-x-0.5" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
    </Link>
  );
}

/** The signed-in user's own activity */
function PersonalOverview() {
  const user = useAuthStore((s) => s.user);
  const statsQ = useQuery({
    queryKey: ['my-stats'],
    queryFn: () => api.getMyStats(),
    refetchInterval: 30000,
  });

  const stats = statsQ.data;
  const isNewUser = stats && stats.predictions.total === 0 && stats.jobs.total === 0;
  const maxTaxonCount = Math.max(1, ...(stats?.top_taxa.map((t) => t.count) ?? [1]));

  if (statsQ.isError) {
    return <ErrorState title="Could not load your workspace" error={statsQ.error} onRetry={() => statsQ.refetch()} />;
  }

  return (
    <section aria-label="Your workspace" className="space-y-6">
      <PageHeader
        title={user?.full_name ? 'Welcome,' : 'Welcome'}
        accent={user?.full_name?.split(' ')[0]}
        subtitle="Your classifications and analyses. Only you can see this data."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard
          label="My Classifications"
          value={formatNumber(stats?.predictions.total)}
          subtext={`${formatNumber(stats?.predictions.last_7_days ?? 0)} in the last 7 days`}
          icon={<Dna className="h-4 w-4" />}
          tone="cyan"
          loading={statsQ.isLoading}
        />
        <StatCard
          label="Average Confidence"
          value={formatPercent(stats?.predictions.avg_confidence, 1)}
          subtext="Across all your sequences"
          icon={<Gauge className="h-4 w-4" />}
          tone="emerald"
          loading={statsQ.isLoading}
        />
        <StatCard
          label="Potential Novel Taxa"
          value={formatNumber(stats?.predictions.novel)}
          subtext={`Confidence below ${formatPercent(stats?.model.novelty_threshold ?? null, 0)}`}
          icon={<Sparkles className="h-4 w-4" />}
          tone={(stats?.predictions.novel ?? 0) > 0 ? 'amber' : 'default'}
          loading={statsQ.isLoading}
        />
        <StatCard
          label="File Analyses"
          value={formatNumber(stats?.jobs.total)}
          subtext="FASTA / FASTQ uploads"
          icon={<FileStack className="h-4 w-4" />}
          loading={statsQ.isLoading}
        />
        <StatCard
          label="Active Model"
          value={stats?.model.version_name ?? '—'}
          subtext={
            stats?.model.accuracy != null
              ? `Accuracy logged in training ${formatPercent(stats.model.accuracy)}`
              : stats?.model.loaded ? 'Loaded' : 'Not loaded'
          }
          icon={<Cpu className="h-4 w-4" />}
          loading={statsQ.isLoading}
        />
      </div>

      {isNewUser ? (
        <EmptyState
          title="No classifications yet"
          description="Paste a DNA sequence or upload a FASTA/FASTQ file to identify marine taxa. Your results will appear here."
          icon={<Dna className="h-5 w-5" />}
          action={
            <Link
              to="/classify"
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-medium text-white transition-colors"
            >
              Classify your first sequence
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-7">
            <CardHeader
              title="Recent Classifications"
              subtitle="Your latest predictions"
              action={
                <Link to="/history" className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline">
                  View all
                </Link>
              }
            />
            {statsQ.isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ul className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                {stats?.recent_predictions.map((p) => {
                  const tier = getConfidenceTier(p.confidence);
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{p.predicted_class}</p>
                        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                          {p.sequence_id ? `${p.sequence_id} · ` : ''}{p.sequence_length} bp · {formatDateTime(p.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {p.is_novel && <Badge tone="amber">novel?</Badge>}
                        <Badge tone={tier.tone}>{formatPercent(p.confidence, 1)}</Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <div className="lg:col-span-5 space-y-6">
            <Card>
              <CardHeader title="Top Taxa" subtitle="Most frequent predictions in your data" />
              {statsQ.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <div className="space-y-2.5">
                  {stats?.top_taxa.map((t) => (
                    <div key={t.taxon}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-slate-800 dark:text-slate-200">{t.taxon}</span>
                        <span className="font-mono tabular-nums text-slate-500">{formatNumber(t.count)}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div className="h-full rounded-full bg-cyan-500" style={{ width: `${(t.count / maxTaxonCount) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <CardHeader title="Recent File Analyses" subtitle="Uploaded FASTA / FASTQ jobs" />
              {stats?.jobs.recent.length ? (
                <ul className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                  {stats.jobs.recent.map((j) => (
                    <li key={j.job_id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                          {j.filenames.join(', ') || j.job_id.slice(0, 8)}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {j.total_sequences != null ? `${formatNumber(j.total_sequences)} sequences · ` : ''}
                          {formatDateTime(j.created_at)}
                        </p>
                      </div>
                      <Badge tone={statusTone(j.status)}>{j.status}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-2">No file analyses yet.</p>
              )}
            </Card>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickAction
          to="/classify"
          icon={<Dna className="h-4 w-4" />}
          title="Classify a sequence"
          description="Real-time taxonomic prediction for single or batch DNA reads."
        />
        <QuickAction
          to="/classify?tab=upload"
          icon={<UploadCloud className="h-4 w-4" />}
          title="Upload FASTA / FASTQ"
          description="Analyse sequencing files up to 500 MB and export BIOM, CSV or FASTA."
        />
        <QuickAction
          to="/history"
          icon={<History className="h-4 w-4" />}
          title="Browse your history"
          description="Search and revisit every classification you have run."
        />
      </div>
    </section>
  );
}

/** Platform-wide health and telemetry (admins only) */
function SystemOverview() {
  const dashboardQ = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: () => api.getDashboardMetrics(),
    refetchInterval: 10000,
  });

  const appQ = useQuery({
    queryKey: ['application-metrics'],
    queryFn: () => api.getApplicationMetrics(),
    refetchInterval: 15000,
  });

  const cacheQ = useQuery({
    queryKey: ['cache-stats'],
    queryFn: () => api.getCacheStats(),
    refetchInterval: 10000,
  });

  const systemQ = useQuery({
    queryKey: ['system-metrics'],
    queryFn: () => api.getSystemMetrics(),
    refetchInterval: 10000,
  });

  const detailedHealthQ = useQuery({
    queryKey: ['detailed-health'],
    queryFn: () => api.getDetailedHealth(),
    refetchInterval: 15000,
  });

  const totalRequests = dashboardQ.data?.requests?.total ?? 0;
  const totalErrors = dashboardQ.data?.errors?.total ?? 0;
  const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

  const cacheData = cacheQ.data ?? dashboardQ.data?.cache;
  const cacheHitRate =
    typeof cacheData?.hit_rate === 'number' ? `${cacheData.hit_rate.toFixed(1)}%` : 'N/A';

  const systemStatus =
    detailedHealthQ.data?.status ??
    dashboardQ.data?.overview?.status ??
    appQ.data?.status ??
    'Unknown';

  const cpu = systemQ.data?.cpu ?? dashboardQ.data?.system?.cpu;
  const memory = systemQ.data?.memory ?? dashboardQ.data?.system?.memory;
  const disk = systemQ.data?.disk ?? dashboardQ.data?.system?.disk;

  const components = detailedHealthQ.data?.components;
  const database = components?.database as { status?: string } | undefined;

  const componentRows: Array<{ name: string; detail: string; status?: string }> = [
    { name: 'FastAPI Gateway', detail: `Uptime: ${components?.api?.uptime ?? appQ.data?.uptime_human ?? '—'}`, status: components?.api?.status },
    { name: 'Inference Engine', detail: `Model loaded: ${components?.model?.loaded ? 'Yes' : 'No'}`, status: components?.model?.status },
    { name: 'Database', detail: 'User accounts, history and jobs', status: database?.status },
    { name: 'Prediction Cache', detail: `Backend: ${components?.cache?.backend ?? cacheData?.cache_type ?? 'unknown'}`, status: components?.cache?.status },
  ];

  return (
    <section aria-label="System overview" className="space-y-6">
      <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
        <h2 className="pt-4 text-lg font-semibold text-slate-900 dark:text-slate-100 dark:on-water">System Overview</h2>
        <span className="pt-4"><Badge tone="cyan">admin</Badge></span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="System Status"
          value={systemStatus}
          subtext={
            detailedHealthQ.data?.reasons?.length
              ? detailedHealthQ.data.reasons.join(' · ')
              : appQ.data?.uptime_human
                ? `Uptime: ${appQ.data.uptime_human}`
                : 'FastAPI health'
          }
          icon={<Activity className="h-4 w-4" />}
          tone={
            systemStatus === 'healthy'
              ? 'emerald'
              : systemStatus === 'warning'
                ? 'amber'
                : systemStatus === 'critical' || systemStatus === 'degraded'
                  ? 'rose'
                  : 'default'
          }
          loading={detailedHealthQ.isLoading && appQ.isLoading}
        />
        <StatCard
          label="Cache Hit Rate"
          value={cacheHitRate}
          subtext={
            cacheData?.cache_type
              ? `${cacheData.cache_type} · ${formatNumber(cacheData.total_keys ?? 0)} keys`
              : 'Prediction cache'
          }
          icon={<Database className="h-4 w-4" />}
          loading={cacheQ.isLoading}
        />
        <StatCard
          label="Total Requests"
          value={formatNumber(totalRequests)}
          subtext={`${dashboardQ.data?.requests?.rate_per_minute ?? 0} req/min · ${formatNumber(dashboardQ.data?.predictions?.total ?? 0)} predictions`}
          icon={<Server className="h-4 w-4" />}
          loading={dashboardQ.isLoading}
        />
        <StatCard
          label="Error Rate"
          value={`${errorRate.toFixed(2)}%`}
          subtext={`${formatNumber(totalErrors)} server errors since start`}
          icon={<HardDrive className="h-4 w-4" />}
          tone={errorRate > 5 ? 'rose' : errorRate > 1 ? 'amber' : 'default'}
          loading={dashboardQ.isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7">
          <CardHeader
            title="System Resource Telemetry"
            subtitle="Live host CPU, memory, and disk utilization (auto-refreshes every 10 s)"
          />
          {systemQ.isError ? (
            <ErrorState
              title="System telemetry unavailable"
              error={systemQ.error}
              onRetry={() => systemQ.refetch()}
            />
          ) : systemQ.isLoading ? (
            <div className="space-y-4 py-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : (
            <div>
              <ResourceGauge
                label="CPU Utilization"
                percent={cpu?.usage_percent}
                status={cpu?.status}
                detail={cpu?.count ? `${cpu.count} logical cores allocated` : 'Host CPU'}
              />
              <ResourceGauge
                label="Memory Usage"
                percent={memory?.usage_percent}
                status={memory?.status}
                detail={`${formatBytes(memory?.used_bytes)} used of ${formatBytes(memory?.total_bytes)} (${formatBytes(memory?.available_bytes)} free)`}
              />
              <ResourceGauge
                label="Disk Storage"
                percent={disk?.usage_percent}
                status={disk?.status}
                detail={`${formatBytes(disk?.used_bytes)} used of ${formatBytes(disk?.total_bytes)} (${formatBytes(disk?.free_bytes)} free)`}
              />
            </div>
          )}
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader
            title="Component Health"
            subtitle="Service readiness"
            action={
              detailedHealthQ.data?.status ? (
                <Badge tone={statusTone(detailedHealthQ.data.status)}>
                  {detailedHealthQ.data.status}
                </Badge>
              ) : null
            }
          />
          {detailedHealthQ.isError ? (
            <ErrorState
              title="Detailed health check failed"
              error={detailedHealthQ.error}
              onRetry={() => detailedHealthQ.refetch()}
            />
          ) : detailedHealthQ.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          ) : (
            <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
              {componentRows.map((row) => (
                <div key={row.name} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-xs font-medium text-slate-900 dark:text-slate-100">{row.name}</p>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{row.detail}</p>
                  </div>
                  <Badge tone={statusTone(row.status)}>{row.status ?? 'unknown'}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <QuickAction
          to="/experiments"
          icon={<FlaskConical className="h-4 w-4" />}
          title="View experiments"
          description="Inspect active A/B model traffic splits, confidence deltas, and winners."
        />
        <QuickAction
          to="/admin"
          icon={<CalendarDays className="h-4 w-4" />}
          title="Manage users"
          description="Promote scientists, disable accounts and review the permission matrix."
        />
      </div>
    </section>
  );
}

export function DashboardPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
  return (
    <div className="space-y-8">
      <PersonalOverview />
      {isAdmin && <SystemOverview />}
    </div>
  );
}
