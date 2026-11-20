import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Award,
  BarChart3,
  Pause,
  Play,
  Plus,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { formatDateTime, formatNumber, getErrorBannerMessage } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Experiment } from '@/types/api';

function expStatusTone(status: string): BadgeTone {
  const s = status.toLowerCase();
  if (s === 'running') return 'emerald';
  if (s === 'paused') return 'amber';
  if (s === 'completed' || s === 'stopped') return 'cyan';
  if (s === 'cancelled') return 'rose';
  return 'neutral';
}

export function ExperimentsPage() {
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((s) => s.canWriteModelsOrExperiments());

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedExpId, setSelectedExpId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmStopExp, setConfirmStopExp] = useState<Experiment | null>(null);

  // Create form state
  const [expName, setExpName] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [strategy, setStrategy] = useState('random');
  const [durationDays, setDurationDays] = useState('14');
  const [variants, setVariants] = useState([
    { name: 'control', version_id: '', traffic: 50 },
    { name: 'treatment', version_id: '', traffic: 50 },
  ]);

  const experimentsQ = useQuery({
    queryKey: ['experiments', statusFilter],
    queryFn: () => api.listExperiments(statusFilter || undefined),
  });

  const activeExpQ = useQuery({
    queryKey: ['active-experiment'],
    queryFn: () => api.getActiveExperiment(),
  });

  const versionsQ = useQuery({
    queryKey: ['model-versions', ''],
    queryFn: () => api.listVersions(),
    enabled: showCreateModal,
  });

  const resultsQ = useQuery({
    queryKey: ['experiment-results', selectedExpId],
    queryFn: () => api.getExperimentResults(selectedExpId!),
    enabled: Boolean(selectedExpId),
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['experiments'] });
    queryClient.invalidateQueries({ queryKey: ['active-experiment'] });
    if (selectedExpId) {
      queryClient.invalidateQueries({ queryKey: ['experiment-results', selectedExpId] });
    }
  };

  const lifecycleMutation = useMutation({
    mutationFn: async ({
      id,
      action,
    }: {
      id: string;
      action: 'start' | 'pause' | 'resume' | 'stop';
    }) => {
      if (action === 'start') return api.startExperiment(id);
      if (action === 'pause') return api.pauseExperiment(id);
      if (action === 'resume') return api.resumeExperiment(id);
      return api.stopExperiment(id, true);
    },
    onSuccess: (_data, vars) => {
      toast.success('Experiment updated', `Action "${vars.action}" succeeded.`);
      setConfirmStopExp(null);
      refreshAll();
    },
    onError: (err) => {
      toast.error('Experiment action failed', getErrorBannerMessage(err));
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createExperiment({
        experiment_name: expName.trim(),
        description: expDesc.trim(),
        variant_configs: variants.map((v) => ({
          name: v.name.trim(),
          version_id: v.version_id.trim(),
          traffic: Number(v.traffic),
        })),
        strategy,
        duration_days: durationDays ? Number(durationDays) : undefined,
      }),
    onSuccess: (res) => {
      toast.success('Experiment created', res.experiment_name);
      setShowCreateModal(false);
      setExpName('');
      setExpDesc('');
      refreshAll();
    },
    onError: (err) => {
      toast.error('Failed to create experiment', getErrorBannerMessage(err));
    },
  });

  const totalTraffic = variants.reduce((sum, v) => sum + Number(v.traffic || 0), 0);
  const experiments = experimentsQ.data?.experiments ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            A/B Testing Experiments
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Split live inference traffic across model versions and inspect statistical significance.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            aria-label="Filter experiments by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101A2E] px-3 py-2 text-xs text-slate-700 dark:text-slate-300"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="running">Running</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>

          {canWrite && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3.5 py-2 text-xs font-medium text-white transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Create experiment
            </button>
          )}
        </div>
      </div>

      {/* Active Experiment Notice */}
      {activeExpQ.data?.active && activeExpQ.data.experiment && (
        <Card className="border-emerald-300/70 dark:border-emerald-800/70 bg-emerald-50/40 dark:bg-emerald-950/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Badge tone="emerald">Active Experiment</Badge>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {activeExpQ.data.experiment.experiment_name}
              </span>
              <span className="text-xs font-mono text-slate-500">
                {activeExpQ.data.experiment.experiment_id}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedExpId(activeExpQ.data!.experiment!.experiment_id)}
              className="text-xs font-medium text-cyan-700 dark:text-cyan-400 hover:underline"
            >
              View live results
            </button>
          </div>
        </Card>
      )}

      {/* Experiments List + Results Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-6 space-y-4">
          {experimentsQ.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : experimentsQ.isError ? (
            <ErrorState
              title="Failed to load experiments"
              error={experimentsQ.error}
              onRetry={() => experimentsQ.refetch()}
            />
          ) : experiments.length === 0 ? (
            <Card>
              <EmptyState
                title="No experiments found"
                description="Create an A/B experiment to compare two model versions on live classification requests."
              />
            </Card>
          ) : (
            experiments.map((exp) => {
              const isSelected = selectedExpId === exp.experiment_id;
              return (
                <Card
                  key={exp.experiment_id}
                  className={
                    isSelected
                      ? 'border-cyan-500/80 dark:border-cyan-500/70'
                      : 'hover:border-slate-300 dark:hover:border-slate-700'
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {exp.experiment_name}
                        </h3>
                        <Badge tone={expStatusTone(exp.status)}>{exp.status}</Badge>
                      </div>
                      <p className="mt-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {exp.experiment_id} · Created {formatDateTime(exp.created_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedExpId(exp.experiment_id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                    >
                      <BarChart3 className="h-3.5 w-3.5 text-cyan-500" />
                      Results
                    </button>
                  </div>

                  {/* Variants summary */}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {exp.variants.map((v, idx) => (
                      <div
                        key={v.variant_id || v.name || idx}
                        className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-[#09101D] px-3 py-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                            {v.name || v.variant_name}
                          </span>
                          <span className="font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
                            {v.traffic ?? v.traffic_percentage ?? 0}%
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] font-mono text-slate-500 truncate">
                          {v.version_id} · {formatNumber(v.predictions ?? v.prediction_count ?? 0)} reqs
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Lifecycle Controls */}
                  {canWrite && (
                    <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center gap-2">
                      {exp.status === 'draft' && (
                        <button
                          type="button"
                          disabled={lifecycleMutation.isPending}
                          onClick={() =>
                            lifecycleMutation.mutate({ id: exp.experiment_id, action: 'start' })
                          }
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-xs font-medium text-white"
                        >
                          <Play className="h-3 w-3" /> Start
                        </button>
                      )}
                      {exp.status === 'running' && (
                        <>
                          <button
                            type="button"
                            disabled={lifecycleMutation.isPending}
                            onClick={() =>
                              lifecycleMutation.mutate({ id: exp.experiment_id, action: 'pause' })
                            }
                            className="inline-flex items-center gap-1 rounded-md border border-amber-300 dark:border-amber-700 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300"
                          >
                            <Pause className="h-3 w-3" /> Pause
                          </button>
                          <button
                            type="button"
                            disabled={lifecycleMutation.isPending}
                            onClick={() => setConfirmStopExp(exp)}
                            className="inline-flex items-center gap-1 rounded-md bg-rose-600 hover:bg-rose-500 px-2.5 py-1 text-xs font-medium text-white"
                          >
                            <Square className="h-3 w-3" /> Stop
                          </button>
                        </>
                      )}
                      {exp.status === 'paused' && (
                        <>
                          <button
                            type="button"
                            disabled={lifecycleMutation.isPending}
                            onClick={() =>
                              lifecycleMutation.mutate({ id: exp.experiment_id, action: 'resume' })
                            }
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-xs font-medium text-white"
                          >
                            <Play className="h-3 w-3" /> Resume
                          </button>
                          <button
                            type="button"
                            disabled={lifecycleMutation.isPending}
                            onClick={() => setConfirmStopExp(exp)}
                            className="inline-flex items-center gap-1 rounded-md bg-rose-600 hover:bg-rose-500 px-2.5 py-1 text-xs font-medium text-white"
                          >
                            <Square className="h-3 w-3" /> Stop
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>

        {/* Results Inspector */}
        <div className="lg:col-span-6">
          {!selectedExpId ? (
            <Card>
              <EmptyState
                icon={<BarChart3 className="h-5 w-5" />}
                title="Select an experiment"
                description="Choose an experiment from the list to inspect per-variant confidence scores, prediction counts, and statistical significance."
              />
            </Card>
          ) : resultsQ.isLoading ? (
            <Card className="space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-56 w-full" />
              <Skeleton className="h-24 w-full" />
            </Card>
          ) : resultsQ.isError ? (
            <ErrorState
              title="Failed to load experiment results"
              error={resultsQ.error}
              onRetry={() => resultsQ.refetch()}
            />
          ) : resultsQ.data ? (
            <Card className="space-y-5">
              <CardHeader
                title={resultsQ.data.experiment_name}
                subtitle={`Status: ${resultsQ.data.status}`}
                action={
                  resultsQ.data.winner ? (
                    <Badge tone="emerald">
                      <Award className="h-3.5 w-3.5" />
                      Winner: {resultsQ.data.winner}
                    </Badge>
                  ) : null
                }
              />

              {/* Variant Comparison Bar Chart */}
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={resultsQ.data.variants.map((v) => ({
                      name: v.variant_name || v.name || v.version_id,
                      avgConfidencePct: Number(((v.avg_confidence ?? 0) * 100).toFixed(2)),
                      successRate: v.success_rate ?? 0,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} />
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
                    <Bar dataKey="avgConfidencePct" name="Avg Confidence (%)" fill="#22D3EE" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="successRate" name="Success Rate (%)" fill="#14B8A6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Variant Table */}
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                      <th className="px-3 py-2 font-semibold text-slate-500">Variant</th>
                      <th className="px-3 py-2 font-semibold text-slate-500 text-right">Samples</th>
                      <th className="px-3 py-2 font-semibold text-slate-500 text-right">Avg Conf.</th>
                      <th className="px-3 py-2 font-semibold text-slate-500 text-right">95% CI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70 font-mono tabular-nums">
                    {resultsQ.data.variants.map((v, idx) => (
                      <tr key={v.variant_id || idx}>
                        <td className="px-3 py-2 font-sans font-medium text-slate-900 dark:text-slate-100">
                          {v.variant_name || v.name}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatNumber(v.prediction_count ?? v.predictions ?? 0)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {((v.avg_confidence ?? 0) * 100).toFixed(2)}%
                        </td>
                        <td className="px-3 py-2 text-right text-[11px] text-slate-500">
                          {v.confidence_interval
                            ? `[${(v.confidence_interval.lower * 100).toFixed(1)}%, ${(v.confidence_interval.upper * 100).toFixed(1)}%]`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Statistical Analysis */}
              {resultsQ.data.statistical_analysis && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#09101D] p-4 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      Statistical Significance
                    </span>
                    <div className="flex items-center gap-2">
                      {resultsQ.data.statistical_analysis.p_value !== undefined && (
                        <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          p = {resultsQ.data.statistical_analysis.p_value.toFixed(4)}
                        </span>
                      )}
                      {resultsQ.data.statistical_analysis.statistically_significant !== undefined && (
                        <Badge
                          tone={
                            resultsQ.data.statistical_analysis.statistically_significant
                              ? 'emerald'
                              : 'amber'
                          }
                        >
                          {resultsQ.data.statistical_analysis.statistically_significant
                            ? 'Significant'
                            : 'Not yet significant'}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {resultsQ.data.statistical_analysis.improvement_percent !== undefined && (
                    <p className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      Relative delta: {resultsQ.data.statistical_analysis.improvement_percent > 0 ? '+' : ''}
                      {resultsQ.data.statistical_analysis.improvement_percent}%
                    </p>
                  )}
                  <p className="text-slate-600 dark:text-slate-400">
                    {resultsQ.data.statistical_analysis.recommendation ||
                      resultsQ.data.statistical_analysis.message}
                  </p>
                </div>
              )}
            </Card>
          ) : null}
        </div>
      </div>

      {/* Create Experiment Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Create A/B experiment"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101A2E] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Create A/B Experiment
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-medium mb-1">Experiment Name *</label>
                <input
                  required
                  value={expName}
                  onChange={(e) => setExpName(e.target.value)}
                  placeholder="e.g. Champion vs retrained challenger"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#09101D] px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Description *</label>
                <textarea
                  required
                  rows={2}
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  placeholder="Compare baseline marine_model against v2.2 on live queries"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#09101D] px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Traffic Strategy</label>
                  <select
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#09101D] px-3 py-2"
                  >
                    <option value="random">random</option>
                    <option value="hash">hash</option>
                    <option value="gradual">gradual</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Duration (days)</label>
                  <input
                    type="number"
                    min="1"
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#09101D] px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    Variants (sum: <span className="font-mono">{totalTraffic}%</span>)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setVariants((prev) => [
                        ...prev,
                        { name: `variant_${prev.length + 1}`, version_id: '', traffic: 0 },
                      ])
                    }
                    className="text-cyan-600 dark:text-cyan-400 hover:underline"
                  >
                    + Add variant
                  </button>
                </div>

                {variants.map((v, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      required
                      value={v.name}
                      onChange={(e) =>
                        setVariants((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item))
                        )
                      }
                      placeholder="name"
                      className="col-span-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#09101D] px-2.5 py-1.5"
                    />
                    <input
                      required
                      list="registry-version-options"
                      value={v.version_id}
                      onChange={(e) =>
                        setVariants((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, version_id: e.target.value } : item
                          )
                        )
                      }
                      placeholder="version_id"
                      className="col-span-5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#09101D] px-2.5 py-1.5 font-mono"
                    />
                    <input
                      required
                      type="number"
                      min="0"
                      max="100"
                      value={v.traffic}
                      onChange={(e) =>
                        setVariants((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, traffic: Number(e.target.value) } : item
                          )
                        )
                      }
                      className="col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#09101D] px-2 py-1.5 font-mono text-right"
                    />
                    {variants.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setVariants((prev) => prev.filter((_, i) => i !== idx))}
                        className="col-span-1 text-slate-400 hover:text-rose-500 flex justify-center"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}

                <datalist id="registry-version-options">
                  {(versionsQ.data?.versions ?? []).map((ver) => (
                    <option key={ver.version_id} value={ver.version_id}>
                      {ver.version_name}
                    </option>
                  ))}
                </datalist>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={Math.abs(totalTraffic - 100) > 0.01 || createMutation.isPending}
                  className="rounded-lg bg-cyan-600 hover:bg-cyan-500 px-4 py-2 font-medium text-white disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Experiment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmStopExp !== null}
        title="Stop active experiment?"
        description={
          confirmStopExp
            ? `Stopping "${confirmStopExp.experiment_name}" will finalize traffic routing and compute a winning variant.`
            : ''
        }
        confirmLabel="Stop experiment"
        tone="danger"
        loading={lifecycleMutation.isPending}
        onConfirm={() =>
          confirmStopExp &&
          lifecycleMutation.mutate({ id: confirmStopExp.experiment_id, action: 'stop' })
        }
        onCancel={() => setConfirmStopExp(null)}
      />
    </div>
  );
}
