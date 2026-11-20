import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Dna,
  ExternalLink,
  FlaskConical,
  Layers,
  Play,
  Search,
  Target,
  XCircle,
} from 'lucide-react';
import { TAXA_CATALOG, TAXA_REFERENCE, type NamedCount, type TaxonReference } from '@/data/taxaReference';
import { api } from '@/lib/api';
import { cn, formatNumber, formatPercent, getErrorBannerMessage } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/ui/StatCard';

type SortKey = 'size' | 'recall' | 'diversity' | 'name';

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'size', label: 'Training sequences' },
  { key: 'recall', label: 'Model recall' },
  { key: 'diversity', label: 'Species diversity' },
  { key: 'name', label: 'Name' },
];

const TOTAL_SEQUENCES = TAXA_CATALOG.totalSequences;
const TOTAL_SPECIES = TAXA_REFERENCE.reduce((sum, t) => sum + t.speciesCount, 0);
const PHYLA = new Set(TAXA_REFERENCE.map((t) => t.phylum)).size;
const ORDERS = TAXA_REFERENCE.filter((t) => t.rank === 'Order').length;
const CLASSES = TAXA_REFERENCE.filter((t) => t.rank === 'Class').length;
const SOURCES = Object.keys(
  TAXA_REFERENCE.reduce<Record<string, number>>((acc, t) => ({ ...acc, ...t.sources }), {})
).join(', ');

function phylumTone(phylum: string): BadgeTone {
  if (phylum === 'Chordata') return 'cyan';
  if (phylum === 'Arthropoda') return 'amber';
  return 'teal';
}

function ncbiTaxonomyUrl(name: string) {
  return `https://www.ncbi.nlm.nih.gov/taxonomy/?term=${encodeURIComponent(name)}`;
}

/** One horizontal bar with a hover tooltip; single series, so identity never depends on color */
function BarRow({
  label,
  value,
  max,
  display,
  tooltip,
  emphasized = false,
  onClick,
  href,
}: {
  label: string;
  value: number;
  max: number;
  display: string;
  tooltip: string;
  emphasized?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const width = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  const labelNode = href ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="truncate italic text-slate-800 dark:text-slate-200 hover:text-cyan-600 dark:hover:text-cyan-400 hover:underline"
    >
      {label}
    </a>
  ) : (
    <span className="truncate text-slate-800 dark:text-slate-200">{label}</span>
  );
  const body = (
    <>
      <div className="flex items-center justify-between gap-3 text-xs mb-1">
        {labelNode}
        <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">{display}</span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800/80">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            emphasized ? 'bg-cyan-600 dark:bg-cyan-400' : 'bg-cyan-500/70 dark:bg-cyan-500/60'
          )}
          style={{ width: `${width}%` }}
        />
      </div>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 -top-8 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 dark:bg-slate-100 px-2 py-1 text-[11px] text-white dark:text-slate-900 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
      >
        {tooltip}
      </span>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} aria-label={tooltip} className="group relative block w-full text-left py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded">
      {body}
    </button>
  ) : (
    <div className="group relative py-1" aria-label={tooltip}>
      {body}
    </div>
  );
}

function BarList({ items, total, hrefFor, limit }: { items: NamedCount[]; total: number; hrefFor?: (name: string) => string; limit: number }) {
  const shown = items.slice(0, limit);
  const max = Math.max(1, ...shown.map((i) => i.count));
  return (
    <div className="space-y-1.5">
      {shown.map((item) => (
        <BarRow
          key={item.name}
          label={item.name}
          value={item.count}
          max={max}
          display={formatNumber(item.count)}
          tooltip={`${item.name}: ${formatNumber(item.count)} sequences (${((item.count / total) * 100).toFixed(1)}%)`}
          href={hrefFor?.(item.name)}
        />
      ))}
    </div>
  );
}

/** Animalia > phylum > class > order, built from the model's lineages */
function TaxonomyTree({ path, onSelectPath }: { path: string[]; onSelectPath: (path: string[]) => void }) {
  const tree = useMemo(() => {
    type Node = { name: string; path: string[]; children: Map<string, Node>; taxa: number };
    const root: Node = { name: 'Animalia', path: ['Animalia'], children: new Map(), taxa: 0 };
    for (const taxon of TAXA_REFERENCE) {
      let node = root;
      root.taxa += 1;
      for (let depth = 1; depth < taxon.lineage.length; depth++) {
        const name = taxon.lineage[depth];
        if (!node.children.has(name)) {
          node.children.set(name, { name, path: taxon.lineage.slice(0, depth + 1), children: new Map(), taxa: 0 });
        }
        node = node.children.get(name)!;
        node.taxa += 1;
      }
    }
    return root;
  }, []);

  type TreeNode = typeof tree;
  const isActive = (p: string[]) => p.length === path.length && p.every((v, i) => v === path[i]);
  const onPath = (p: string[]) => p.every((v, i) => path[i] === v);

  const renderNode = (node: TreeNode, depth: number) => {
    const leaf = node.children.size === 0;
    return (
      <li key={node.path.join('/')}>
        <button
          type="button"
          onClick={() => onSelectPath(isActive(node.path) && depth > 0 ? node.path.slice(0, -1) : node.path)}
          aria-pressed={isActive(node.path)}
          className={cn(
            'group flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs transition-colors',
            isActive(node.path)
              ? 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-200 font-semibold'
              : onPath(node.path)
              ? 'text-slate-900 dark:text-slate-100'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          )}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
        >
          {leaf ? <Dna className="h-3 w-3 shrink-0 text-slate-400" /> : <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />}
          <span className={cn('truncate', leaf && 'font-medium')}>{node.name}</span>
          {!leaf && <span className="ml-auto font-mono text-[10px] text-slate-400">{node.taxa}</span>}
        </button>
        {!leaf && (
          <ul>{Array.from(node.children.values()).map((child) => renderNode(child, depth + 1))}</ul>
        )}
      </li>
    );
  };

  return <ul className="space-y-0.5">{renderNode(tree, 0)}</ul>;
}

function LiveTest({ taxon }: { taxon: TaxonReference }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const example = taxon.example;
  const predict = useMutation({
    mutationFn: () => api.predictSingle(example!.sequence, false),
    // The prediction is saved to the user's history: refresh their per-taxon counts
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-stats'] }),
  });
  if (!example) return null;
  const result = predict.data;
  const correct = result && result.predicted_class === taxon.name;

  return (
    <Card>
      <CardHeader
        title="Try a real sequence"
        subtitle="A training sequence of this taxon's most common species, run through the live model"
        action={<FlaskConical className="h-4 w-4 text-cyan-500" />}
      />
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Species</dt>
          <dd className="mt-0.5 italic text-slate-900 dark:text-slate-100">{example.species}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">GenBank accession</dt>
          <dd className="mt-0.5">
            <a
              href={`https://www.ncbi.nlm.nih.gov/nuccore/${example.accession}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-cyan-700 dark:text-cyan-400 hover:underline"
            >
              {example.accession}
              <ExternalLink className="h-3 w-3" />
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Marker</dt>
          <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{example.marker}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Length</dt>
          <dd className="mt-0.5 font-mono text-slate-900 dark:text-slate-100">{formatNumber(example.sequence.length)} bp</dd>
        </div>
      </dl>
      <p className="mt-3 font-mono text-[11px] leading-relaxed break-all text-slate-500 dark:text-slate-400 line-clamp-2" title={example.sequence}>
        {example.sequence}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => predict.mutate()}
          disabled={predict.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 px-3.5 py-2 text-xs font-medium text-white transition-colors"
        >
          <Play className="h-3.5 w-3.5" />
          {predict.isPending ? 'Classifying...' : 'Run the classifier'}
        </button>
        <button
          type="button"
          onClick={() => navigate('/classify', { state: { sequence: example.sequence } })}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-cyan-500/60"
        >
          Open in Classify
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>
      {predict.isError && (
        <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">{getErrorBannerMessage(predict.error)}</p>
      )}
      {result && (
        <div
          className={cn(
            'mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
            correct
              ? 'border-emerald-300/70 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'border-amber-300/70 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
          )}
          role="status"
        >
          {correct ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
          <span>
            Predicted <strong>{result.predicted_class}</strong> with {formatPercent(result.confidence, 1)} confidence
            {correct ? ' (correct).' : ` (expected ${taxon.name}).`} Saved to your history.
          </span>
        </div>
      )}
    </Card>
  );
}

function TaxonDetail({ taxon, onSelectTaxon, onSelectPath, myCount }: {
  taxon: TaxonReference;
  onSelectTaxon: (name: string) => void;
  onSelectPath: (path: string[]) => void;
  myCount: number | undefined;
}) {
  const [showAllSpecies, setShowAllSpecies] = useState(false);
  const v = taxon.validation;

  return (
    <div className="space-y-4">
      <Card>
        <nav aria-label="Lineage" className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
          {taxon.lineage.map((level, i) => (
            <span key={level} className="inline-flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              <button
                type="button"
                onClick={() => onSelectPath(taxon.lineage.slice(0, i + 1))}
                className="hover:text-cyan-600 dark:hover:text-cyan-400 hover:underline"
              >
                {level}
              </button>
            </span>
          ))}
        </nav>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{taxon.name}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {taxon.commonName} · {taxon.rank} · model class #{taxon.classId}
            </p>
          </div>
          <a
            href={ncbiTaxonomyUrl(taxon.name)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-700 dark:text-cyan-400 hover:underline"
          >
            NCBI Taxonomy <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{taxon.description}</p>

        <dl className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          {[
            ['Sequences', `${formatNumber(taxon.trainingCount)} (${((taxon.trainingCount / TOTAL_SEQUENCES) * 100).toFixed(1)}%)`],
            ['Species', formatNumber(taxon.speciesCount)],
            ['Genera', formatNumber(taxon.genusCount)],
            ['Median length', `${formatNumber(taxon.length.median)} bp`],
            ['Mean GC', `${taxon.gcPercent}%`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-slate-50 dark:bg-slate-900/50 px-3 py-2">
              <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
              <dd className="mt-0.5 font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value}</dd>
            </div>
          ))}
        </dl>
        {myCount !== undefined && (
          <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
            You have classified <strong>{formatNumber(myCount)}</strong> sequence{myCount === 1 ? '' : 's'} as {taxon.name}.{' '}
            {myCount > 0 && (
              <Link to={`/history?taxon=${encodeURIComponent(taxon.name)}`} className="font-medium text-cyan-700 dark:text-cyan-400 hover:underline">
                View them in your history
              </Link>
            )}
          </p>
        )}
      </Card>

      {v && (
        <Card>
          <CardHeader
            title="Model performance"
            subtitle={`Held-out validation split: ${formatNumber(v.support)} ${taxon.name} sequences the model never trained on`}
            action={<Target className="h-4 w-4 text-cyan-500" />}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(
              [
                ['Recall', v.recall, `Of all true ${taxon.name} sequences, the share the model identified`],
                ['Precision', v.precision, `Of all sequences predicted as ${taxon.name}, the share that really were`],
                ['F1 score', v.f1, 'Harmonic mean of precision and recall'],
              ] as const
            ).map(([label, value, help]) => (
              <BarRow key={label} label={label} value={value} max={1} display={formatPercent(value, 1)} tooltip={help} emphasized />
            ))}
          </div>
          {v.confusedWith.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800/80 text-xs">
              <span className="text-slate-500 dark:text-slate-400">Most often mistaken for: </span>
              <span className="inline-flex flex-wrap gap-1.5 align-middle">
                {v.confusedWith.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => onSelectTaxon(c.name)}
                    className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-slate-700 dark:text-slate-300 hover:border-cyan-500/60"
                    title={`${c.count} of ${v.support} validation sequences were predicted as ${c.name}`}
                  >
                    {c.name} <span className="font-mono text-slate-400">×{c.count}</span>
                  </button>
                ))}
              </span>
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader
            title="Most represented species"
            subtitle={`Top of ${formatNumber(taxon.speciesCount)} species in the training data (names link to NCBI)`}
          />
          <BarList items={taxon.topSpecies} total={taxon.trainingCount} hrefFor={ncbiTaxonomyUrl} limit={showAllSpecies ? 12 : 6} />
          {taxon.topSpecies.length > 6 && (
            <button
              type="button"
              onClick={() => setShowAllSpecies((s) => !s)}
              className="mt-2 text-[11px] font-medium text-cyan-700 dark:text-cyan-400 hover:underline"
            >
              {showAllSpecies ? 'Show fewer' : `Show top ${taxon.topSpecies.length}`}
            </button>
          )}
        </Card>
        <Card>
          <CardHeader title="Marker genes" subtitle="Which genes the training sequences come from" />
          <BarList items={taxon.markers} total={taxon.trainingCount} limit={9} />
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
            Lengths {formatNumber(taxon.length.min)}–{formatNumber(taxon.length.max)} bp · sources:{' '}
            {Object.entries(taxon.sources).map(([s, n]) => `${s} ${formatNumber(n)}`).join(', ')}
          </p>
        </Card>
      </div>

      <LiveTest key={taxon.name} taxon={taxon} />
    </div>
  );
}

export function TaxaExplorerPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('size');
  const [path, setPath] = useState<string[]>(['Animalia']);

  const selectedName = params.get('taxon') ?? TAXA_REFERENCE[0].name;
  const selected = TAXA_REFERENCE.find((t) => t.name === selectedName) ?? TAXA_REFERENCE[0];
  const detailRef = useRef<HTMLDivElement>(null);
  const selectTaxon = (name: string) => {
    setParams({ taxon: name }, { replace: true });
    // Details sit below the list on narrow screens: bring them into view
    if (window.matchMedia('(max-width: 1279px)').matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

  const statsQ = useQuery({ queryKey: ['my-stats'], queryFn: () => api.getMyStats() });
  const myCounts = useMemo(
    () => new Map((statsQ.data?.top_taxa ?? []).map((t) => [t.taxon, t.count])),
    [statsQ.data]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = TAXA_REFERENCE.filter((taxon) => {
      if (!path.every((level, i) => taxon.lineage[i] === level)) return false;
      if (!q) return true;
      return (
        taxon.name.toLowerCase().includes(q) ||
        taxon.commonName.toLowerCase().includes(q) ||
        taxon.lineage.some((l) => l.toLowerCase().includes(q)) ||
        taxon.topSpecies.some((s) => s.name.toLowerCase().includes(q)) ||
        taxon.markers.some((m) => m.name.toLowerCase().includes(q))
      );
    });
    const by: Record<SortKey, (a: TaxonReference, b: TaxonReference) => number> = {
      size: (a, b) => b.trainingCount - a.trainingCount,
      recall: (a, b) => (b.validation?.recall ?? 0) - (a.validation?.recall ?? 0),
      diversity: (a, b) => b.speciesCount - a.speciesCount,
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return [...matches].sort(by[sort]);
  }, [search, sort, path]);

  const byRecall = useMemo(
    () => [...TAXA_REFERENCE].sort((a, b) => (b.validation?.recall ?? 0) - (a.validation?.recall ?? 0)),
    []
  );
  const accuracy = TAXA_CATALOG.validation?.accuracy;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Marine taxa the classifier recognises</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Built from the {formatNumber(TOTAL_SEQUENCES)}-sequence training set and the model's held-out validation results.
            Predictions are at order/class level.
          </p>
        </div>
        <Link
          to="/classify"
          className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3.5 py-2 text-xs font-medium text-white transition-colors whitespace-nowrap"
        >
          Classify sequence
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 2xl:grid-cols-4 gap-4">
        <StatCard
          label="Model classes"
          value={TAXA_REFERENCE.length}
          subtext={`${PHYLA} phyla · ${ORDERS} orders, ${CLASSES} classes`}
          icon={<Layers className="h-4 w-4" />}
        />
        <StatCard label="Training sequences" value={formatNumber(TOTAL_SEQUENCES)} subtext={`Source: ${SOURCES}`} icon={<Dna className="h-4 w-4" />} tone="cyan" />
        <StatCard label="Species represented" value={formatNumber(TOTAL_SPECIES)} subtext="Named species in the training set" icon={<Search className="h-4 w-4" />} />
        <StatCard
          label="Validation accuracy"
          value={formatPercent(accuracy, 1)}
          subtext={`${formatNumber(TAXA_CATALOG.validation?.samples)} held-out sequences`}
          icon={<Target className="h-4 w-4" />}
          tone="emerald"
        />
      </div>

      {/* Narrow screens: list, then details, then tree and chart. Wide: details on the right. */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-4">
          <Card>
            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search taxon, common name, species, gene..."
                  aria-label="Search marine taxa"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101A2E] pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <label className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                Sort by
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#09101D] px-2 py-1 text-xs text-slate-900 dark:text-slate-100"
                >
                  {SORTS.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3">
              {filtered.length === 0 ? (
                <EmptyState
                  title="No matching taxa"
                  description="Clear the search or select Animalia in the tree."
                  className="py-6"
                />
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-1.5">
                  {filtered.map((taxon) => (
                    <li key={taxon.classId}>
                      <button
                        type="button"
                        onClick={() => selectTaxon(taxon.name)}
                        aria-current={taxon.name === selected.name}
                        className={cn(
                          'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                          taxon.name === selected.name
                            ? 'border-cyan-500/70 bg-cyan-500/10'
                            : 'border-slate-200 dark:border-slate-800 hover:border-cyan-500/40'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{taxon.name}</span>
                          <Badge tone={phylumTone(taxon.phylum)}>{taxon.phylum}</Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{taxon.commonName}</p>
                        <p className="mt-1 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {formatNumber(taxon.trainingCount)} seqs · {formatNumber(taxon.speciesCount)} species · recall{' '}
                          {formatPercent(taxon.validation?.recall, 1)}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>

        <div ref={detailRef} className="xl:col-span-8 xl:row-span-2 scroll-mt-20">
          <TaxonDetail
            taxon={selected}
            onSelectTaxon={selectTaxon}
            onSelectPath={setPath}
            myCount={statsQ.data ? myCounts.get(selected.name) ?? 0 : undefined}
          />
        </div>

        <div className="xl:col-span-4 space-y-4">
          <Card>
            <CardHeader title="Taxonomy" subtitle="Click a level to filter" />
            <TaxonomyTree path={path} onSelectPath={setPath} />
          </Card>

          <Card>
            <CardHeader title="Recall by taxon" subtitle="Share of held-out sequences identified correctly; click to open" />
            <div className="space-y-1">
              {byRecall.map((t) => (
                <BarRow
                  key={t.name}
                  label={t.name}
                  value={t.validation?.recall ?? 0}
                  max={1}
                  display={formatPercent(t.validation?.recall, 1)}
                  tooltip={`${t.name}: recall ${formatPercent(t.validation?.recall, 1)}, precision ${formatPercent(t.validation?.precision, 1)} (n=${t.validation?.support})`}
                  emphasized={t.name === selected.name}
                  onClick={() => selectTaxon(t.name)}
                />
              ))}
            </div>
          </Card>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        Data generated {new Date(TAXA_CATALOG.generatedAt).toLocaleDateString()} by scripts/build_taxa_catalog.py from{' '}
        {TAXA_CATALOG.dataset}. Validation split: {TAXA_CATALOG.validation?.split}.
      </p>
    </div>
  );
}
