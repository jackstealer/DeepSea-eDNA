import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FlaskConical,
  Loader2,
  Play,
  Sparkles,
} from 'lucide-react';
import { api, buildAllTaxaProbabilities } from '@/lib/api';
import {
  EXAMPLE_BATCH_FASTA,
  EXAMPLE_SINGLE_SEQUENCE,
  findTaxonByName,
} from '@/data/taxaReference';
import {
  analyzeDnaSequence,
  cn,
  formatNumber,
  getConfidenceTier,
  getErrorBannerMessage,
  parseBatchInput,
  triggerBlobDownload,
} from '@/lib/utils';
import { toast } from '@/store/toastStore';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ConfidenceGauge } from '@/components/ui/ConfidenceGauge';
import { SequenceInput } from '@/components/ui/SequenceInput';
import { Dropzone } from '@/components/ui/Dropzone';
import { DataTable, type ColumnDef } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import type {
  AnalysisJobResponse,
  BatchPredictResponse,
  ExportFormat,
  PredictResponse,
} from '@/types/api';

type ClassifyTab = 'single' | 'batch' | 'upload';

interface UnifiedResultRow {
  id: string;
  taxon: string;
  confidence: number;
  tier: string;
  tierTone: 'emerald' | 'cyan' | 'amber' | 'rose';
  abundance: number;
  isNovel: boolean;
}

const CHART_PALETTE = [
  '#22D3EE',
  '#14B8A6',
  '#38BDF8',
  '#0EA5E9',
  '#2DD4BF',
  '#818CF8',
  '#34D399',
  '#F59E0B',
];

const EXPORT_FORMATS: Array<{ format: ExportFormat; label: string }> = [
  { format: 'json', label: 'JSON' },
  { format: 'csv', label: 'CSV' },
  { format: 'tsv', label: 'TSV' },
  { format: 'biom', label: 'BIOM' },
  { format: 'fasta', label: 'FASTA' },
];

export function ClassifyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as ClassifyTab) || 'single';
  const [activeTab, setActiveTab] = useState<ClassifyTab>(
    ['single', 'batch', 'upload'].includes(initialTab) ? initialTab : 'single'
  );

  // Single sequence state
  // Other pages (e.g. Taxa Explorer) can open Classify with a sequence prefilled
  const location = useLocation();
  const [sequence, setSequence] = useState(
    () => (location.state as { sequence?: string } | null)?.sequence ?? ''
  );
  const [useCache, setUseCache] = useState(true);
  const [singleResult, setSingleResult] = useState<PredictResponse | null>(null);

  // Batch state
  const [batchRaw, setBatchRaw] = useState('');
  const [batchResult, setBatchResult] = useState<BatchPredictResponse | null>(null);

  // Upload state
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<unknown>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobState, setJobState] = useState<AnalysisJobResponse | null>(null);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);

  // Tier filter for batch/file table
  const [tierFilter, setTierFilter] = useState<string>('all');

  const switchTab = (tab: ClassifyTab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'single' ? {} : { tab });
  };

  // Single prediction mutation
  const singleMutation = useMutation({
    mutationFn: () => {
      const cleaned = analyzeDnaSequence(sequence).cleaned;
      return api.predictSingle(cleaned, useCache);
    },
    onSuccess: (data) => {
      setSingleResult(data);
      toast.success('Classification complete', `Predicted ${data.predicted_class}`);
    },
    onError: (err) => {
      toast.error('Prediction failed', getErrorBannerMessage(err));
    },
  });

  // Batch prediction mutation
  const parsedBatch = useMemo(() => parseBatchInput(batchRaw), [batchRaw]);
  const validBatchEntries = useMemo(
    () => parsedBatch.filter((e) => e.validation.isValid),
    [parsedBatch]
  );

  const batchMutation = useMutation({
    mutationFn: () =>
      api.predictBatch(
        validBatchEntries.map((e) => ({ id: e.id, sequence: e.validation.cleaned })),
        useCache
      ),
    onSuccess: (data) => {
      setBatchResult(data);
      toast.success(
        'Batch classification complete',
        `Processed ${data.predictions?.length ?? 0} sequences`
      );
    },
    onError: (err) => {
      toast.error('Batch prediction failed', getErrorBannerMessage(err));
    },
  });

  // Poll job results when activeJobId is set and not terminal
  useEffect(() => {
    if (!activeJobId) return;
    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const res = await api.getAnalysisResults(activeJobId);
        if (cancelled) return;
        setJobState(res);
        if (res.status === 'completed' || res.status === 'failed') {
          if (res.status === 'completed') {
            toast.success('File analysis complete', `Job ${activeJobId.slice(0, 8)} finished.`);
          } else {
            toast.error('Analysis failed', res.error || 'Processing error on server.');
          }
          return;
        }
        timer = window.setTimeout(poll, 1500);
      } catch (err) {
        if (!cancelled) {
          setUploadError(err);
        }
      }
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [activeJobId]);

  const handleUploadSubmit = async () => {
    if (files.length === 0) return;
    setUploadError(null);
    setJobState(null);
    setActiveJobId(null);
    setUploadProgress(0);
    setUploading(true);

    try {
      const { jobId } = await api.uploadFileAndStartAnalysis(files, (pct) => {
        setUploadProgress(pct);
      });
      setActiveJobId(jobId);
      setJobState({ jobId, status: 'queued', progress: 0 });
    } catch (err) {
      setUploadError(err);
      toast.error('Upload failed', getErrorBannerMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleExport = async (format: ExportFormat) => {
    if (!activeJobId) return;
    setExportingFormat(format);
    try {
      const { blob, filename } = await api.exportResults(activeJobId, format);
      triggerBlobDownload(blob, filename);
      toast.success('Export downloaded', filename);
    } catch (err) {
      toast.error('Export failed', getErrorBannerMessage(err));
    } finally {
      setExportingFormat(null);
    }
  };

  const singleSeqStats = analyzeDnaSequence(sequence);
  const singleProbBars = useMemo(
    () => (singleResult ? buildAllTaxaProbabilities(singleResult) : []),
    [singleResult]
  );
  const singleTaxonMeta = singleResult ? findTaxonByName(singleResult.predicted_class) : undefined;
  const singleTier = singleResult ? getConfidenceTier(singleResult.confidence) : null;

  // Build unified rows for Batch or File results
  const activeBatchOrFileRows = useMemo<UnifiedResultRow[]>(() => {
    if (activeTab === 'batch' && batchResult?.predictions) {
      return batchResult.predictions.map((item) => {
        const tierInfo = getConfidenceTier(item.confidence);
        return {
          id: item.sequence_id,
          taxon: item.predicted_class,
          confidence: item.confidence <= 1 ? item.confidence * 100 : item.confidence,
          tier: tierInfo.tier,
          tierTone: tierInfo.tone,
          abundance: 1,
          isNovel: Boolean(item.is_novel),
        };
      });
    }

    if (activeTab === 'upload' && jobState?.status === 'completed' && jobState.results) {
      if (Array.isArray(jobState.results.predictions) && jobState.results.predictions.length > 0) {
        return jobState.results.predictions.map((row) => {
          const tierInfo = getConfidenceTier(row.confidence);
          return {
            id: row.sequence_id,
            taxon: row.predicted_taxon,
            confidence: row.confidence <= 1 ? row.confidence * 100 : row.confidence,
            tier: tierInfo.tier,
            tierTone: tierInfo.tone,
            abundance: row.abundance ?? 1,
            isNovel: Boolean(row.is_novel),
          };
        });
      }

      if (Array.isArray(jobState.results.taxonomicData)) {
        return jobState.results.taxonomicData.map((t, idx) => {
          const tierInfo = getConfidenceTier(t.confidence);
          return {
            id: `taxon_${idx + 1}`,
            taxon: t.name,
            confidence: t.confidence <= 1 ? t.confidence * 100 : t.confidence,
            tier: tierInfo.tier,
            tierTone: tierInfo.tone,
            abundance: t.abundance,
            isNovel: Boolean(t.isNovel),
          };
        });
      }
    }

    return [];
  }, [activeTab, batchResult, jobState]);

  const filteredTableRows = useMemo(() => {
    if (tierFilter === 'all') return activeBatchOrFileRows;
    return activeBatchOrFileRows.filter((r) => r.tier === tierFilter);
  }, [activeBatchOrFileRows, tierFilter]);

  const distributionData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of activeBatchOrFileRows) {
      counts.set(row.taxon, (counts.get(row.taxon) ?? 0) + (row.abundance || 1));
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [activeBatchOrFileRows]);

  const dominantTaxon = distributionData[0]?.name ?? '—';
  const richness = distributionData.length;

  const tableColumns: ColumnDef<UnifiedResultRow>[] = [
    {
      key: 'id',
      header: 'Sequence / Entry ID',
      sortable: true,
      sortValue: (r) => r.id,
      render: (r) => <span className="font-mono text-slate-900 dark:text-slate-100">{r.id}</span>,
    },
    {
      key: 'taxon',
      header: 'Predicted Taxon',
      sortable: true,
      sortValue: (r) => r.taxon,
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900 dark:text-slate-100">{r.taxon}</span>
          {r.isNovel && <Badge tone="amber">Novel candidate</Badge>}
        </div>
      ),
    },
    {
      key: 'confidence',
      header: 'Confidence',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.confidence,
      render: (r) => `${r.confidence.toFixed(2)}%`,
    },
    {
      key: 'tier',
      header: 'Tier',
      sortable: true,
      sortValue: (r) => r.tier,
      render: (r) => <Badge tone={r.tierTone}>{r.tier}</Badge>,
    },
    {
      key: 'abundance',
      header: 'Reads / Abundance',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.abundance,
      render: (r) => formatNumber(r.abundance),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Mode Segmented Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div
          role="tablist"
          aria-label="Classification modes"
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101A2E] p-1"
        >
          {(
            [
              { id: 'single', label: 'Single sequence' },
              { id: 'batch', label: 'Batch' },
              { id: 'upload', label: 'File upload' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => switchTab(t.id)}
              className={cn(
                'rounded-lg px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap',
                activeTab === t.id
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={useCache}
            onChange={(e) => setUseCache(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-700 text-cyan-600 focus:ring-cyan-500"
          />
          Use prediction cache
        </label>
      </div>

      {/* TAB 1: SINGLE SEQUENCE */}
      {activeTab === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <Card className="lg:col-span-6 space-y-4">
            <CardHeader
              title="Single Sequence Inference"
              subtitle="Validate nucleotide composition and classify via POST /api/predict"
            />
            <SequenceInput
              value={sequence}
              onChange={setSequence}
              onLoadExample={() => setSequence(EXAMPLE_SINGLE_SEQUENCE)}
              disabled={singleMutation.isPending}
            />

            {singleMutation.isError && (
              <ErrorState
                title="Prediction error"
                error={singleMutation.error}
                onRetry={() => singleMutation.mutate()}
              />
            )}

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                disabled={!singleSeqStats.isValid || singleMutation.isPending}
                onClick={() => singleMutation.mutate()}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-xs font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                {singleMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                {singleMutation.isPending ? 'Classifying...' : 'Classify Sequence'}
              </button>
            </div>
          </Card>

          <div className="lg:col-span-6 space-y-6">
            {!singleResult ? (
              <Card>
                <EmptyState
                  icon={<FlaskConical className="h-5 w-5" />}
                  title="Awaiting sequence submission"
                  description="Enter a 100–1,000 bp marine eDNA sequence or load an example mitochondrial read to view predicted taxonomy, confidence tiers, and class probability distribution."
                />
              </Card>
            ) : (
              <>
                <Card>
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <ConfidenceGauge
                      confidence={singleResult.confidence}
                      label="Model Confidence"
                    />
                    <div className="flex-1 min-w-0 space-y-2.5 text-center sm:text-left">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        {singleTier && (
                          <Badge tone={singleTier.tone}>
                            {singleTier.tier} confidence
                          </Badge>
                        )}
                        {singleResult.cached && <Badge tone="blue">Cache hit</Badge>}
                        {singleResult.is_novel && (
                          <Badge tone="amber">
                            <AlertTriangle className="h-3 w-3" />
                            Novel candidate
                          </Badge>
                        )}
                      </div>
                      <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                        {singleResult.predicted_class}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {singleTier?.description}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Class Probabilities Across 8 Taxa */}
                <Card>
                  <CardHeader
                    title="Class Probability Distribution"
                    subtitle="Confidence distribution across all 8 marine taxonomic groups"
                  />
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={singleProbBars}
                        layout="vertical"
                        margin={{ top: 4, right: 20, left: 20, bottom: 4 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={false}
                          stroke="rgba(148,163,184,0.18)"
                        />
                        <XAxis
                          type="number"
                          domain={[0, 100]}
                          tick={{ fontSize: 11, fill: '#94A3B8' }}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <YAxis
                          type="category"
                          dataKey="taxon"
                          width={120}
                          tick={{ fontSize: 11, fill: '#CBD5E1' }}
                        />
                        <Tooltip
                          formatter={(val: number) => [`${val.toFixed(2)}%`, 'Probability']}
                          contentStyle={{
                            backgroundColor: '#0F172A',
                            borderColor: '#1E293B',
                            borderRadius: '8px',
                            fontSize: '12px',
                            color: '#F8FAFC',
                          }}
                        />
                        <Bar dataKey="probability" radius={[0, 4, 4, 0]}>
                          {singleProbBars.map((entry) => (
                            <Cell
                              key={entry.taxon}
                              fill={entry.isTop ? '#22D3EE' : '#334155'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                {/* Taxonomy Card */}
                <Card>
                  <CardHeader
                    title="Taxonomic Metadata"
                    subtitle="Reference lineage and ecological profile"
                  />
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Class ID</dt>
                      <dd className="mt-1 font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {singleResult.class_id ?? singleTaxonMeta?.classId ?? '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Rank</dt>
                      <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                        {singleResult.rank ?? singleTaxonMeta?.rank ?? 'Order'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Phylum</dt>
                      <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                        {singleTaxonMeta?.phylum ?? singleResult.lineage?.[1] ?? '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Lineage</dt>
                      <dd className="mt-1 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        {(singleResult.lineage ?? singleTaxonMeta?.lineage)?.join(' › ') || '—'}
                      </dd>
                    </div>
                  </dl>
                  {singleTaxonMeta && (
                    <div className="mt-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80 text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Example species: </span>
                      <span className="italic text-slate-800 dark:text-slate-200">
                        {singleTaxonMeta.exampleSpecies.join(', ')}
                      </span>
                    </div>
                  )}
                </Card>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: BATCH */}
      {activeTab === 'batch' && (
        <div className="space-y-6">
          <Card className="space-y-4">
            <CardHeader
              title="Batch Sequence Classification"
              subtitle="Paste multiple raw sequences (one per line) or multi-FASTA records for POST /api/predict/batch"
              action={
                <button
                  type="button"
                  onClick={() => setBatchRaw(EXAMPLE_BATCH_FASTA)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-cyan-700 dark:text-cyan-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Load sample FASTA
                </button>
              }
            />

            <textarea
              rows={7}
              value={batchRaw}
              onChange={(e) => setBatchRaw(e.target.value)}
              spellCheck={false}
              placeholder={'>seq_001\nATCGCAAACAATGCACTAGTTG...\n>seq_002\nCCTGTATCTAGTATTTGGTGCC...'}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#09101D] px-3.5 py-3 font-mono text-xs leading-relaxed text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                <span>Detected: {parsedBatch.length} sequences</span>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  Valid (100–1,000 bp): {validBatchEntries.length}
                </span>
                {parsedBatch.length - validBatchEntries.length > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-600 dark:text-amber-400">
                      Skipped invalid: {parsedBatch.length - validBatchEntries.length}
                    </span>
                  </>
                )}
              </div>

              <button
                type="button"
                disabled={validBatchEntries.length === 0 || batchMutation.isPending}
                onClick={() => batchMutation.mutate()}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 px-4 py-2 text-xs font-medium text-white transition-colors"
              >
                {batchMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                {batchMutation.isPending
                  ? 'Running batch...'
                  : `Classify ${validBatchEntries.length} sequences`}
              </button>
            </div>

            {batchMutation.isError && (
              <ErrorState
                title="Batch classification failed"
                error={batchMutation.error}
                onRetry={() => batchMutation.mutate()}
              />
            )}
          </Card>
        </div>
      )}

      {/* TAB 3: FILE UPLOAD */}
      {activeTab === 'upload' && (
        <Card className="space-y-4">
          <CardHeader
            title="Sequencing File Upload & Pipeline Analysis"
            subtitle="Upload FASTA, FASTQ, or CSV files up to 500 MB via POST /api/upload and poll /api/results/{job_id}"
          />

          <Dropzone
            files={files}
            onFilesChange={setFiles}
            disabled={uploading}
            onValidationError={(msg) => toast.error('Invalid file', msg)}
          />

          {uploading && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                <span className="text-slate-600 dark:text-slate-300">Uploading payload...</span>
                <span className="text-cyan-600 dark:text-cyan-400">{uploadProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full bg-cyan-500 transition-all duration-150"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {jobState && jobState.status !== 'completed' && jobState.status !== 'failed' && (
            <div className="rounded-xl border border-cyan-200 dark:border-cyan-800/60 bg-cyan-50/60 dark:bg-cyan-950/25 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-cyan-900 dark:text-cyan-200 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Job <span className="font-mono">{jobState.jobId}</span> · {jobState.currentStep || jobState.status}
                </span>
                <span className="font-mono tabular-nums text-cyan-700 dark:text-cyan-300">
                  {jobState.progress ?? 0}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-cyan-200/70 dark:bg-cyan-900/50">
                <div
                  className="h-full bg-cyan-500 transition-all duration-300"
                  style={{ width: `${jobState.progress ?? 10}%` }}
                />
              </div>
            </div>
          )}

          {uploadError ? (
            <ErrorState title="Pipeline error" error={uploadError} />
          ) : jobState?.status === 'failed' ? (
            <ErrorState
              title="Analysis job failed"
              message={jobState.error || 'Unknown error while processing file.'}
            />
          ) : null}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={files.length === 0 || uploading}
              onClick={handleUploadSubmit}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 px-4 py-2 text-xs font-medium text-white transition-colors"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-3.5 w-3.5" />
              )}
              {uploading ? 'Uploading...' : 'Upload & Analyze'}
            </button>
          </div>
        </Card>
      )}

      {/* SHARED BATCH / FILE RESULTS VIEW */}
      {(activeTab === 'batch' || activeTab === 'upload') && activeBatchOrFileRows.length > 0 && (
        <div className="space-y-6">
          {/* Biodiversity Summary & Export Menu */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {activeTab === 'upload' && activeJobId
                  ? `Job ${activeJobId} completed`
                  : 'Batch classification results'}
              </span>
            </div>

            {activeTab === 'upload' && activeJobId && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
                  <Download className="h-3.5 w-3.5" /> Export:
                </span>
                {EXPORT_FORMATS.map(({ format, label }) => (
                  <button
                    key={format}
                    type="button"
                    disabled={exportingFormat !== null}
                    onClick={() => handleExport(format)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-mono font-medium text-slate-700 dark:text-slate-200 hover:border-cyan-500/60 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors disabled:opacity-50"
                  >
                    {exportingFormat === format ? '...' : label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Biodiversity Metrics + Donut */}
            <Card className="lg:col-span-5 space-y-5">
              <CardHeader
                title="Biodiversity Summary"
                subtitle="Taxonomic richness and sample composition"
              />
              <dl className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-[#09101D] p-3">
                  <dt className="text-[11px] text-slate-500 dark:text-slate-400">
                    Total Sequences
                  </dt>
                  <dd className="mt-1 text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {formatNumber(
                      jobState?.results?.totalSequences ?? activeBatchOrFileRows.length
                    )}
                  </dd>
                </div>
                <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-[#09101D] p-3">
                  <dt className="text-[11px] text-slate-500 dark:text-slate-400">
                    Taxonomic Richness
                  </dt>
                  <dd className="mt-1 text-lg font-semibold font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
                    {jobState?.results?.identifiedTaxa ?? richness} taxa
                  </dd>
                </div>
                <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-[#09101D] p-3">
                  <dt className="text-[11px] text-slate-500 dark:text-slate-400">
                    Dominant Taxon
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {dominantTaxon}
                  </dd>
                </div>
                <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-[#09101D] p-3">
                  <dt className="text-[11px] text-slate-500 dark:text-slate-400">
                    Shannon Index (H&apos;)
                  </dt>
                  <dd className="mt-1 text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {jobState?.results?.shannonDiversity !== undefined
                      ? jobState.results.shannonDiversity.toFixed(3)
                      : '—'}
                  </dd>
                </div>
              </dl>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={82}
                      paddingAngle={2}
                    >
                      {distributionData.map((entry, idx) => (
                        <Cell
                          key={entry.name}
                          fill={CHART_PALETTE[idx % CHART_PALETTE.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#1E293B',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#F8FAFC',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Results Table */}
            <Card className="lg:col-span-7">
              <CardHeader
                title="Classified Assignments"
                subtitle="Sortable, filterable taxonomic predictions"
              />
              <DataTable
                data={filteredTableRows}
                columns={tableColumns}
                rowKey={(row, idx) => `${row.id}-${idx}`}
                pageSize={8}
                searchPlaceholder="Filter by sequence ID or taxon..."
                searchFilter={(row, q) =>
                  row.id.toLowerCase().includes(q) || row.taxon.toLowerCase().includes(q)
                }
                filterSlot={
                  <select
                    aria-label="Filter by confidence tier"
                    value={tierFilter}
                    onChange={(e) => setTierFilter(e.target.value)}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1628] px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="all">All tiers</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                    <option value="Very low">Very low</option>
                  </select>
                }
              />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
