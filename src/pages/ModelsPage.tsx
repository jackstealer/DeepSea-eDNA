import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  CheckCircle2,
  GitCompare,
  History,
  Plus,
  RotateCcw,
  ShieldOff,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { formatDateTime, formatPercent, getErrorBannerMessage } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { DataTable, type ColumnDef } from '@/components/ui/DataTable';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { ServingModelCard } from '@/components/models/ServingModelCard';
import type { ModelVersion } from '@/types/api';

function versionStatusTone(status: string): BadgeTone {
  if (status === 'active') return 'emerald';
  if (status === 'archived') return 'neutral';
  if (status === 'deprecated') return 'rose';
  return 'blue';
}

type PendingAction =
  | { type: 'activate' | 'rollback' | 'archive' | 'deprecate'; version: ModelVersion }
  | null;

export function ModelsPage() {
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((s) => s.canWriteModelsOrExperiments());

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [compareId1, setCompareId1] = useState<string>('');
  const [compareId2, setCompareId2] = useState<string>('');
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [deprecateReason, setDeprecateReason] = useState('');
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regPath, setRegPath] = useState('./ml_models/marine_model');
  const [regDesc, setRegDesc] = useState('');
  // Metrics must come from a real evaluation, so nothing is pre-filled
  const [regAccuracy, setRegAccuracy] = useState('');
  const [regF1, setRegF1] = useState('');
  const [regTags, setRegTags] = useState('marine_diverse');
  const [regSetCurrent, setRegSetCurrent] = useState(false);

  const versionsQ = useQuery({
    queryKey: ['model-versions', statusFilter],
    queryFn: () => api.listVersions(statusFilter || undefined),
  });

  const historyQ = useQuery({
    queryKey: ['model-history'],
    queryFn: () => api.getVersionHistory(15),
  });

  const detailQ = useQuery({
    queryKey: ['model-version-detail', selectedVersionId],
    queryFn: () => api.getVersionDetails(selectedVersionId!),
    enabled: Boolean(selectedVersionId),
  });

  const compareQ = useQuery({
    queryKey: ['model-compare', compareId1, compareId2],
    queryFn: () => api.compareVersions(compareId1, compareId2),
    enabled: Boolean(compareId1 && compareId2 && compareId1 !== compareId2),
  });

  const invalidateVersions = () => {
    queryClient.invalidateQueries({ queryKey: ['model-versions'] });
    queryClient.invalidateQueries({ queryKey: ['model-history'] });
    queryClient.invalidateQueries({ queryKey: ['current-version-info'] });
    if (selectedVersionId) {
      queryClient.invalidateQueries({ queryKey: ['model-version-detail', selectedVersionId] });
    }
  };

  const actionMutation = useMutation({
    mutationFn: async (action: NonNullable<PendingAction>) => {
      const id = action.version.version_id;
      if (action.type === 'activate') return api.activateVersion(id);
      if (action.type === 'rollback') return api.rollbackVersion(id);
      if (action.type === 'archive') return api.archiveVersion(id);
      return api.deprecateVersion(id, deprecateReason.trim());
    },
    onSuccess: (_data, action) => {
      toast.success('Registry updated', `Completed ${action.type} on ${action.version.version_name}`);
      setPendingAction(null);
      setDeprecateReason('');
      invalidateVersions();
    },
    onError: (err) => {
      toast.error('Action failed', getErrorBannerMessage(err));
    },
  });

  const registerMutation = useMutation({
    mutationFn: () =>
      api.registerVersion({
        version_name: regName.trim(),
        model_path: regPath.trim(),
        description: regDesc.trim(),
        metrics: {
          ...(regAccuracy ? { accuracy: Number(regAccuracy) } : {}),
          ...(regF1 ? { f1_score: Number(regF1) } : {}),
        },
        tags: regTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        set_as_current: regSetCurrent,
      }),
    onSuccess: (res) => {
      toast.success('Version registered', `${res.version_name} (${res.version_id})`);
      setShowRegisterModal(false);
      setRegName('');
      setRegDesc('');
      invalidateVersions();
    },
    onError: (err) => {
      toast.error('Registration failed', getErrorBannerMessage(err));
    },
  });

  const versions = versionsQ.data?.versions ?? [];

  const columns: ColumnDef<ModelVersion>[] = [
    {
      key: 'version',
      header: 'Version',
      sortable: true,
      sortValue: (v) => v.version_name,
      render: (v) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedVersionId(v.version_id)}
            className="font-mono font-medium text-cyan-700 dark:text-cyan-400 hover:underline text-left"
          >
            {v.version_name}
          </button>
          {v.is_current && <Badge tone="cyan">Current</Badge>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (v) => v.status,
      render: (v) => <Badge tone={versionStatusTone(v.status)}>{v.status}</Badge>,
    },
    {
      key: 'accuracy',
      header: 'Accuracy',
      align: 'right',
      sortable: true,
      sortValue: (v) => v.metrics?.accuracy ?? -1,
      render: (v) => formatPercent(v.metrics?.accuracy),
    },
    {
      key: 'created',
      header: 'Created',
      sortable: true,
      sortValue: (v) => v.created_at,
      render: (v) => (
        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
          {formatDateTime(v.created_at)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (v) => (
        <div className="inline-flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedVersionId(v.version_id)}
            className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Inspect
          </button>
          {canWrite && !v.is_current && (
            <>
              <button
                type="button"
                onClick={() => setPendingAction({ type: 'activate', version: v })}
                title="Activate version"
                className="rounded-md border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
              >
                Activate
              </button>
              <button
                type="button"
                onClick={() => setPendingAction({ type: 'rollback', version: v })}
                title="Rollback to version"
                className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Rollback
              </button>
              {v.status !== 'archived' && (
                <button
                  type="button"
                  onClick={() => setPendingAction({ type: 'archive', version: v })}
                  title="Archive version"
                  className="rounded-md border border-slate-200 dark:border-slate-700 p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  <Archive className="h-3.5 w-3.5" />
                </button>
              )}
              {v.status !== 'deprecated' && (
                <button
                  type="button"
                  onClick={() => setPendingAction({ type: 'deprecate', version: v })}
                  title="Deprecate version"
                  className="rounded-md border border-rose-200 dark:border-rose-900/60 p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <ShieldOff className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <ServingModelCard canManage={canWrite} />
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Model Version Registry
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Track trained PyTorch checkpoints, compare metrics, and manage active production models.
          </p>
        </div>

        {canWrite && (
          <button
            type="button"
            onClick={() => setShowRegisterModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3.5 py-2 text-xs font-medium text-white transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Register new version
          </button>
        )}
      </div>

      {/* Versions Table */}
      <Card>
        {versionsQ.isError ? (
          <ErrorState
            title="Unable to load model versions"
            error={versionsQ.error}
            onRetry={() => versionsQ.refetch()}
          />
        ) : (
          <DataTable
            data={versions}
            columns={columns}
            rowKey={(v) => v.version_id}
            loading={versionsQ.isLoading}
            searchPlaceholder="Search versions by name or ID..."
            searchFilter={(v, q) =>
              v.version_name.toLowerCase().includes(q) || v.version_id.toLowerCase().includes(q)
            }
            emptyTitle="No model versions registered"
            emptyDescription="Register a model version via the button above or POST /versions/register."
            filterSlot={
              <select
                aria-label="Filter versions by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1628] px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300"
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
                <option value="deprecated">Deprecated</option>
              </select>
            }
          />
        )}
      </Card>

      {/* Compare + History Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Side-by-side comparison */}
        <Card className="lg:col-span-7 space-y-4">
          <CardHeader
            title="Compare Two Versions"
            subtitle="Inspect metric deltas via GET /versions/compare/{id1}/{id2}"
            action={<GitCompare className="h-4 w-4 text-cyan-500" />}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              aria-label="Select baseline version"
              value={compareId1}
              onChange={(e) => setCompareId1(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#09101D] px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
            >
              <option value="">Select Version A...</option>
              {versions.map((v) => (
                <option key={v.version_id} value={v.version_id}>
                  {v.version_name} ({v.version_id})
                </option>
              ))}
            </select>

            <select
              aria-label="Select candidate version"
              value={compareId2}
              onChange={(e) => setCompareId2(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#09101D] px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
            >
              <option value="">Select Version B...</option>
              {versions.map((v) => (
                <option key={v.version_id} value={v.version_id}>
                  {v.version_name} ({v.version_id})
                </option>
              ))}
            </select>
          </div>

          {!compareId1 || !compareId2 || compareId1 === compareId2 ? (
            <EmptyState
              title="Select two distinct versions"
              description="Choose Version A and Version B above to compare accuracy, F1, and regression deltas."
            />
          ) : compareQ.isLoading ? (
            <Skeleton className="h-36 w-full" />
          ) : compareQ.isError ? (
            <ErrorState title="Comparison failed" error={compareQ.error} />
          ) : compareQ.data ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                    <th className="px-3 py-2 font-semibold text-slate-500">Metric</th>
                    <th className="px-3 py-2 font-semibold text-slate-500 text-right">
                      {compareQ.data.version_1.name}
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-500 text-right">
                      {compareQ.data.version_2.name}
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-500 text-right">Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70 font-mono tabular-nums">
                  {Object.entries(compareQ.data.metrics_comparison ?? {}).map(([metric, vals]) => (
                    <tr key={metric}>
                      <td className="px-3 py-2 font-sans font-medium text-slate-900 dark:text-slate-100">
                        {metric}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {vals.version_1 !== null ? vals.version_1.toFixed(4) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {vals.version_2 !== null ? vals.version_2.toFixed(4) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {vals.difference !== null ? (
                          <span
                            className={
                              vals.difference > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : vals.difference < 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-500'
                            }
                          >
                            {vals.difference > 0 ? '+' : ''}
                            {vals.difference.toFixed(4)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>

        {/* Version History Timeline */}
        <Card className="lg:col-span-5">
          <CardHeader
            title="Version History Timeline"
            subtitle="Chronological release log from /versions/history"
            action={<History className="h-4 w-4 text-slate-400" />}
          />

          {historyQ.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : historyQ.isError ? (
            <ErrorState title="Unable to load version history" error={historyQ.error} />
          ) : (historyQ.data?.history ?? []).length === 0 ? (
            <EmptyState
              title="No version history"
              description="Registered versions will appear chronologically here."
            />
          ) : (
            <ol className="relative border-l border-slate-200 dark:border-slate-800 ml-2.5 space-y-5 pl-5">
              {(historyQ.data?.history ?? []).map((item) => (
                <li key={item.version_id} className="relative">
                  <span
                    className={`absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-[#101A2E] ${
                      item.is_current ? 'bg-cyan-500' : 'bg-slate-400 dark:bg-slate-600'
                    }`}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedVersionId(item.version_id)}
                      className="text-xs font-mono font-semibold text-slate-900 dark:text-slate-100 hover:text-cyan-500"
                    >
                      {item.version_name}
                    </button>
                    <Badge tone={versionStatusTone(item.status)}>
                      {item.is_current ? 'current' : item.status}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {formatDateTime(item.created_at)}
                  </p>
                  {item.description && (
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {/* Version Detail Drawer */}
      {selectedVersionId && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Model version details"
        >
          <div className="w-full max-w-lg bg-white dark:bg-[#101A2E] border-l border-slate-200 dark:border-slate-800 h-full overflow-y-auto p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400">
                  {selectedVersionId}
                </p>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {detailQ.data?.version_name || 'Loading version...'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVersionId(null)}
                aria-label="Close detail drawer"
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {detailQ.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : detailQ.isError ? (
              <ErrorState title="Failed to fetch details" error={detailQ.error} />
            ) : detailQ.data ? (
              <div className="space-y-5 text-xs">
                <div className="flex items-center gap-2">
                  <Badge tone={versionStatusTone(detailQ.data.status)}>
                    {detailQ.data.status}
                  </Badge>
                  {detailQ.data.is_current && <Badge tone="cyan">Active Production</Badge>}
                </div>

                <dl className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#09101D] p-4">
                  <div>
                    <dt className="text-slate-500">Created</dt>
                    <dd className="mt-1 font-mono">{formatDateTime(detailQ.data.created_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Checksum</dt>
                    <dd className="mt-1 font-mono">{detailQ.data.checksum || '—'}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-slate-500">Artifact Path</dt>
                    <dd className="mt-1 font-mono break-all">{detailQ.data.model_path || '—'}</dd>
                  </div>
                </dl>

                {detailQ.data.description && (
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                      Description
                    </h4>
                    <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                      {detailQ.data.description}
                    </p>
                  </div>
                )}

                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    Recorded Metrics
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(detailQ.data.metrics ?? {}).map(([k, val]) => (
                      <div
                        key={k}
                        className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-between"
                      >
                        <span className="text-slate-500">{k}</span>
                        <span className="font-mono tabular-nums font-semibold">
                          {typeof val === 'number' ? val.toFixed(4) : String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {canWrite && !detailQ.data.is_current && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPendingAction({ type: 'activate', version: detailQ.data! })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-xs font-medium text-white"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Activate
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingAction({ type: 'rollback', version: detailQ.data! })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Rollback
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Register New Version Modal */}
      {showRegisterModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Register new model version"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101A2E] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Register Model Version
              </h3>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                registerMutation.mutate();
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-medium mb-1">Version Name *</label>
                <input
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="v2.2-marine-cnn-lstm"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#09101D] px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Model Path *</label>
                <input
                  required
                  value={regPath}
                  onChange={(e) => setRegPath(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#09101D] px-3 py-2 font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Accuracy (0–1)</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    max="1"
                    value={regAccuracy}
                    onChange={(e) => setRegAccuracy(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#09101D] px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">F1 Score (0–1)</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    max="1"
                    value={regF1}
                    onChange={(e) => setRegF1(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#09101D] px-3 py-2 font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium mb-1">Description</label>
                <textarea
                  rows={2}
                  value={regDesc}
                  onChange={(e) => setRegDesc(e.target.value)}
                  placeholder="Training notes and hyperparameters..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#09101D] px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Tags (comma-separated)</label>
                <input
                  value={regTags}
                  onChange={(e) => setRegTags(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#09101D] px-3 py-2 font-mono"
                />
              </div>
              <label className="inline-flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={regSetCurrent}
                  onChange={(e) => setRegSetCurrent(e.target.checked)}
                />
                <span>Set immediately as active production model</span>
              </label>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registerMutation.isPending}
                  className="rounded-lg bg-cyan-600 hover:bg-cyan-500 px-4 py-2 font-medium text-white disabled:opacity-50"
                >
                  {registerMutation.isPending ? 'Registering...' : 'Register Version'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Action Dialog */}
      <ConfirmDialog
        open={pendingAction !== null}
        title={
          pendingAction
            ? `${pendingAction.type.charAt(0).toUpperCase() + pendingAction.type.slice(1)} version ${pendingAction.version.version_name}?`
            : ''
        }
        description={
          pendingAction?.type === 'deprecate'
            ? 'Deprecated models are flagged against production deployment.'
            : pendingAction?.type === 'archive'
            ? 'Archived models remain in registry history but are marked inactive.'
            : 'This will switch the active serving model pointer in the registry.'
        }
        confirmLabel={pendingAction ? pendingAction.type.toUpperCase() : 'Confirm'}
        tone={pendingAction?.type === 'deprecate' ? 'danger' : 'primary'}
        loading={actionMutation.isPending}
        onConfirm={() => pendingAction && actionMutation.mutate(pendingAction)}
        onCancel={() => {
          setPendingAction(null);
          setDeprecateReason('');
        }}
      >
        {pendingAction?.type === 'deprecate' && (
          <input
            type="text"
            value={deprecateReason}
            onChange={(e) => setDeprecateReason(e.target.value)}
            placeholder="Optional deprecation reason..."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#09101D] px-3 py-2 text-xs"
          />
        )}
      </ConfirmDialog>
    </div>
  );
}
