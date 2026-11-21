import { AlertCircle, CheckCircle2, Dna } from 'lucide-react';
import { analyzeDnaSequence, cn } from '@/lib/utils';

interface SequenceInputProps {
  value: string;
  onChange: (value: string) => void;
  onLoadExample?: () => void;
  disabled?: boolean;
}

export function SequenceInput({
  value,
  onChange,
  onLoadExample,
  disabled = false,
}: SequenceInputProps) {
  const stats = analyzeDnaSequence(value);
  const total = stats.length;

  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          htmlFor="single-dna-sequence"
          className="text-xs font-medium text-slate-700 dark:text-slate-300"
        >
          Nucleotide Sequence (A, T, C, G, N · 100–1,000 bp)
        </label>
        <div className="flex items-center gap-2">
          {value.trim().length > 0 && (
            <button
              type="button"
              onClick={() => onChange('')}
              disabled={disabled}
              className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              Clear
            </button>
          )}
          {onLoadExample && (
            <button
              type="button"
              onClick={onLoadExample}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-medium text-cyan-700 dark:text-cyan-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <Dna className="h-3.5 w-3.5" />
              Load example
            </button>
          )}
        </div>
      </div>

      <textarea
        id="single-dna-sequence"
        rows={6}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        placeholder="Paste raw DNA sequence (e.g. ATCGCAAACAATGCACTAGTTGACCTTCCAGCCCCCTCAAATATTTCGGT...)"
        className={cn(
          'w-full rounded-xl border bg-slate-50 dark:bg-black/25 px-3.5 py-3 font-mono text-xs leading-relaxed text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors',
          total === 0
            ? 'border-slate-200 dark:border-slate-800 focus:ring-cyan-500/60'
            : stats.isValid
            ? 'border-emerald-300 dark:border-emerald-800/80 focus:ring-emerald-500/50'
            : 'border-rose-300 dark:border-rose-800/80 focus:ring-rose-500/50'
        )}
      />

      {/* Base composition mini bar */}
      <div className="space-y-2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 flex">
          {total > 0 && (
            <>
              <div
                style={{ width: `${pct(stats.counts.A)}%` }}
                className="bg-cyan-400 transition-all"
                title={`A: ${stats.counts.A}`}
              />
              <div
                style={{ width: `${pct(stats.counts.T)}%` }}
                className="bg-sky-500 transition-all"
                title={`T: ${stats.counts.T}`}
              />
              <div
                style={{ width: `${pct(stats.counts.C)}%` }}
                className="bg-teal-500 transition-all"
                title={`C: ${stats.counts.C}`}
              />
              <div
                style={{ width: `${pct(stats.counts.G)}%` }}
                className="bg-emerald-500 transition-all"
                title={`G: ${stats.counts.G}`}
              />
              <div
                style={{ width: `${pct(stats.counts.N)}%` }}
                className="bg-amber-400 transition-all"
                title={`N: ${stats.counts.N}`}
              />
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-3">
            <span>Length: {total} bp</span>
            <span aria-hidden="true">·</span>
            <span>GC: {stats.gcPercent.toFixed(1)}%</span>
            <span aria-hidden="true">·</span>
            <span className="text-cyan-600 dark:text-cyan-400">A {stats.counts.A}</span>
            <span className="text-sky-600 dark:text-sky-400">T {stats.counts.T}</span>
            <span className="text-teal-600 dark:text-teal-400">C {stats.counts.C}</span>
            <span className="text-emerald-600 dark:text-emerald-400">G {stats.counts.G}</span>
            {stats.counts.N > 0 && (
              <span className="text-amber-600 dark:text-amber-400">N {stats.counts.N}</span>
            )}
          </div>

          {total > 0 && (
            <div className="flex items-center gap-1.5 font-sans">
              {stats.isValid ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Valid sequence
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {!stats.isValidChars
                    ? `Invalid characters: ${stats.invalidChars.join(', ')}`
                    : total < 100
                    ? 'Minimum 100 bp required'
                    : 'Maximum 1,000 bp allowed'}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
