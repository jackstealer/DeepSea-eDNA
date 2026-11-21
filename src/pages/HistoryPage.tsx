import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Download, Dna, FileStack } from 'lucide-react';
import { api } from '@/lib/api';
import { TAXA_REFERENCE } from '@/data/taxaReference';
import {
  cn,
  formatDateTime,
  formatNumber,
  formatPercent,
  getConfidenceTier,
  getErrorBannerMessage,
  statusTone,
  triggerBlobDownload,
} from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from '@/store/toastStore';
import type { ExportFormat } from '@/types/api';
import { PageHeader } from '@/components/ui/PageHeader';

const PAGE_SIZE = 25;

function Pager({ offset, total, onChange }: { offset: number; total: number; onChange: (offset: number) => void }) {
  if (total <= PAGE_SIZE) return null;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pages = Math.ceil(total / PAGE_SIZE);
  return (
    <div className="flex items-center justify-between pt-3 text-xs text-slate-500 dark:text-slate-400">
      <span>
        {formatNumber(offset + 1)}–{formatNumber(Math.min(offset + PAGE_SIZE, total))} of {formatNumber(total)}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onChange(offset - PAGE_SIZE)}
          className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="font-mono tabular-nums px-1">{page} / {pages}</span>
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => onChange(offset + PAGE_SIZE)}
          className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ClassificationHistory() {
  const [offset, setOffset] = useState(0);
  // ?taxon=<name> (linked from the Taxa Explorer) pre-selects the filter
  const [taxon, setTaxon] = useState(() => new URLSearchParams(window.location.search).get('taxon') ?? '');
  const historyQ = useQuery({
    queryKey: ['my-predictions', offset, taxon],
    queryFn: () => api.getMyPredictions(PAGE_SIZE, offset, taxon || undefined),
    placeholderData: keepPreviousData,
  });

  return (
    <Card>
      <CardHeader
        title="Classifications"
        subtitle="Every sequence you have classified, newest first"
        action={
          <select
            value={taxon}
            onChange={(e) => {
              setTaxon(e.target.value);
              setOffset(0);
            }}
            aria-label="Filter by taxon"
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-black/25 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="">All taxa</option>
            {TAXA_REFERENCE.map((t) => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </select>
        }
      />
      {historyQ.isError ? (
        <ErrorState title="Could not load your history" error={historyQ.error} onRetry={() => historyQ.refetch()} />
      ) : historyQ.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : historyQ.data?.total === 0 ? (
        <EmptyState
          title={taxon ? `No ${taxon} classifications` : 'No classifications yet'}
          description="Sequences you classify on the Classify page are saved here automatically."
          icon={<Dna className="h-5 w-5" />}
          action={
            <Link to="/classify" className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline">
              Go to Classify
            </Link>
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-white/[0.02] text-slate-500">
                  <th className="px-4 py-2.5 font-semibold">When</th>
                  <th className="px-4 py-2.5 font-semibold">Sequence</th>
                  <th className="px-4 py-2.5 font-semibold">Predicted taxon</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Confidence</th>
                  <th className="px-4 py-2.5 font-semibold">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                {historyQ.data?.items.map((p) => {
                  const tier = getConfidenceTier(p.confidence);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-2 whitespace-nowrap text-slate-500 dark:text-slate-400">
                        {formatDateTime(p.created_at)}
                      </td>
                      <td className="px-4 py-2 max-w-[260px]">
                        <p className="font-mono text-[11px] truncate text-slate-700 dark:text-slate-300" title={p.sequence_preview}>
                          {p.sequence_id ? <span className="font-semibold">{p.sequence_id} · </span> : null}
                          {p.sequence_preview}
                        </p>
                        <p className="text-[11px] text-slate-400">{formatNumber(p.sequence_length)} bp</p>
                      </td>
                      <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {p.predicted_class}
                        {p.is_novel && <Badge tone="amber" className="ml-2">novel?</Badge>}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Badge tone={tier.tone}>{formatPercent(p.confidence, 1)}</Badge>
                      </td>
                      <td className="px-4 py-2 capitalize text-slate-500 dark:text-slate-400">{p.source}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager offset={offset} total={historyQ.data?.total ?? 0} onChange={setOffset} />
        </>
      )}
    </Card>
  );
}

function JobHistory() {
  const [offset, setOffset] = useState(0);
  const [downloading, setDownloading] = useState<string | null>(null);
  const jobsQ = useQuery({
    queryKey: ['my-jobs', offset],
    queryFn: () => api.getMyJobs(PAGE_SIZE, offset),
    placeholderData: keepPreviousData,
    refetchInterval: (q) => (q.state.data?.items.some((j) => j.status === 'queued' || j.status === 'processing') ? 3000 : false),
  });

  const download = async (jobId: string, format: ExportFormat) => {
    setDownloading(`${jobId}:${format}`);
    try {
      const { blob, filename } = await api.exportResults(jobId, format);
      triggerBlobDownload(blob, filename);
    } catch (err) {
      toast.error('Download failed', getErrorBannerMessage(err));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Card>
      <CardHeader title="File Analyses" subtitle="FASTA / FASTQ uploads and their results" />
      {jobsQ.isError ? (
        <ErrorState title="Could not load your analyses" error={jobsQ.error} onRetry={() => jobsQ.refetch()} />
      ) : jobsQ.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : jobsQ.data?.total === 0 ? (
        <EmptyState
          title="No file analyses yet"
          description="Upload a FASTA or FASTQ file on the Classify page to run a full community analysis."
          icon={<FileStack className="h-5 w-5" />}
          action={
            <Link to="/classify?tab=upload" className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline">
              Upload a file
            </Link>
          }
        />
      ) : (
        <>
          <ul className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
            {jobsQ.data?.items.map((j) => (
              <li key={j.job_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {j.filenames.join(', ') || 'Untitled upload'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {formatDateTime(j.created_at)}
                    {j.total_sequences != null && ` · ${formatNumber(j.total_sequences)} sequences · ${formatNumber(j.identified_taxa)} taxa`}
                  </p>
                  {j.error && <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">{j.error}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone(j.status)}>
                    {j.status === 'processing' ? `processing ${Math.round(j.progress)}%` : j.status}
                  </Badge>
                  {j.status === 'completed' &&
                    (['csv', 'json'] as ExportFormat[]).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        disabled={downloading !== null}
                        onClick={() => download(j.job_id, fmt)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:border-cyan-500/60',
                          downloading === `${j.job_id}:${fmt}` && 'opacity-60'
                        )}
                      >
                        <Download className="h-3 w-3" />
                        {fmt.toUpperCase()}
                      </button>
                    ))}
                </div>
              </li>
            ))}
          </ul>
          <Pager offset={offset} total={jobsQ.data?.total ?? 0} onChange={setOffset} />
        </>
      )}
    </Card>
  );
}

export function HistoryPage() {
  const [tab, setTab] = useState<'predictions' | 'jobs'>('predictions');
  return (
    <div className="space-y-5">
      <PageHeader title="Classification" accent="history" />
      <div role="tablist" className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-black/25 p-1 border border-slate-200 dark:border-slate-800">
        {(
          [
            ['predictions', 'Classifications'],
            ['jobs', 'File analyses'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'rounded-md px-4 py-1.5 text-xs font-medium transition-colors',
              tab === id
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'predictions' ? <ClassificationHistory /> : <JobHistory />}
    </div>
  );
}
