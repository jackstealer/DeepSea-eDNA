import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Server } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDateTime, formatPercent, getErrorBannerMessage } from '@/lib/utils';
import { toast } from '@/store/toastStore';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { displayModelUri, formatModelVersion } from '@/lib/utils';

/** The model version currently answering predictions, and a reload after promoting a new champion */
export function ServingModelCard({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const servingQ = useQuery({
    queryKey: ['serving-model'],
    queryFn: () => api.getServingModel(),
  });

  const reload = useMutation({
    mutationFn: () => api.reloadServingModel(),
    onSuccess: (info) => {
      queryClient.setQueryData(['serving-model'], { ...info, mlflow_enabled: true });
      queryClient.invalidateQueries({ queryKey: ['model-versions'] });
      queryClient.invalidateQueries({ queryKey: ['model-history'] });
      queryClient.invalidateQueries({ queryKey: ['my-stats'] });
      toast.success(
        info.previous_version === info.version ? 'Champion unchanged' : 'New champion loaded',
        `${info.name} v${info.version} is now serving predictions`
      );
    },
    onError: (err) => toast.error('Reload failed', getErrorBannerMessage(err)),
  });

  const info = servingQ.data;
  const accuracy = info?.metrics?.val_accuracy ?? info?.metrics?.accuracy;

  return (
    <Card>
      <CardHeader
        title="Serving Now"
        subtitle={
          info?.source === 'mlflow'
            ? 'Loaded from the MLflow Model Registry by alias'
            : 'Bundled model files (MLflow not configured)'
        }
        action={
          canManage && info?.mlflow_enabled ? (
            <button
              type="button"
              onClick={() => reload.mutate()}
              disabled={reload.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-cyan-500/60 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${reload.isPending ? 'animate-spin' : ''}`} />
              {reload.isPending ? 'Reloading...' : `Reload @${info.alias ?? 'champion'}`}
            </button>
          ) : (
            <Server className="h-4 w-4 text-cyan-500" />
          )
        }
      />
      {servingQ.isError ? (
        <ErrorState title="Serving info unavailable" error={servingQ.error} onRetry={() => servingQ.refetch()} />
      ) : servingQ.isLoading || !info ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <dl className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Model</dt>
            <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{info.name}</dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Version</dt>
            <dd className="mt-1 flex items-center gap-1.5">
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{formatModelVersion(info.version)}</span>
              {info.alias && <Badge tone="emerald">@{info.alias}</Badge>}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Source</dt>
            <dd className="mt-1">
              <Badge tone={info.source === 'mlflow' ? 'cyan' : 'neutral'}>{info.source}</Badge>
            </dd>
          </div>
          <div>
            {/* The registry's comparison metric (augmented validation set); the clean held-out figure is in the Taxa Explorer */}
            <dt className="text-slate-500 dark:text-slate-400">Accuracy logged in training</dt>
            <dd className="mt-1 font-mono font-semibold text-slate-900 dark:text-slate-100">
              {formatPercent(accuracy)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Loaded</dt>
            <dd className="mt-1 font-mono text-slate-600 dark:text-slate-300">{formatDateTime(info.loaded_at)}</dd>
          </div>
          <div className="col-span-2 lg:col-span-5">
            <dt className="text-slate-500 dark:text-slate-400">Model URI</dt>
            <dd className="mt-1 font-mono text-[11px] text-slate-700 dark:text-slate-300 break-all">
              <span title={info.uri.startsWith('models:/') ? info.uri : undefined}>{displayModelUri(info.uri)}</span>
              {info.run_id && <span className="text-slate-400"> · run {info.run_id.slice(0, 12)}</span>}
            </dd>
          </div>
        </dl>
      )}
    </Card>
  );
}
