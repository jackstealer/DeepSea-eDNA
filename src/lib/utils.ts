import type { ApiErrorInfo } from '@/types/api';
import type { BadgeTone } from '@/components/ui/Badge';

/** Badge colour for health and job statuses */
export function statusTone(status?: string): BadgeTone {
  const s = (status || '').toLowerCase();
  if (s === 'healthy' || s === 'active' || s === 'loaded' || s === 'completed') return 'emerald';
  if (s === 'warning' || s === 'processing' || s === 'queued') return 'amber';
  if (s === 'critical' || s === 'degraded' || s === 'error' || s === 'not_loaded' || s === 'inactive' || s === 'failed') return 'rose';
  return 'neutral';
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export interface DnaValidationResult {
  cleaned: string;
  length: number;
  isValidChars: boolean;
  invalidChars: string[];
  isValidLength: boolean;
  isValid: boolean;
  gcPercent: number;
  counts: {
    A: number;
    T: number;
    C: number;
    G: number;
    N: number;
  };
}

export function analyzeDnaSequence(raw: string): DnaValidationResult {
  const cleaned = raw.replace(/\s+/g, '').toUpperCase();
  const invalidSet = new Set<string>();
  const counts = { A: 0, T: 0, C: 0, G: 0, N: 0 };

  for (const ch of cleaned) {
    if (ch === 'A' || ch === 'T' || ch === 'C' || ch === 'G' || ch === 'N') {
      counts[ch] += 1;
    } else {
      invalidSet.add(ch);
    }
  }

  const length = cleaned.length;
  const isValidChars = invalidSet.size === 0;
  const isValidLength = length >= 100 && length <= 1000;
  const gcCount = counts.G + counts.C;
  const gcPercent = length > 0 ? (gcCount / length) * 100 : 0;

  return {
    cleaned,
    length,
    isValidChars,
    invalidChars: Array.from(invalidSet),
    isValidLength,
    isValid: length > 0 && isValidChars && isValidLength,
    gcPercent,
    counts,
  };
}

export interface ParsedSequenceEntry {
  id: string;
  sequence: string;
  validation: DnaValidationResult;
}

export function parseBatchInput(raw: string): ParsedSequenceEntry[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const lines = trimmed.split(/\r?\n/);
  const hasFastaHeaders = lines.some((l) => l.trim().startsWith('>'));

  if (hasFastaHeaders) {
    const entries: ParsedSequenceEntry[] = [];
    let currentId = '';
    let currentSeq: string[] = [];

    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      if (t.startsWith('>')) {
        if (currentId || currentSeq.length > 0) {
          const seq = currentSeq.join('');
          entries.push({
            id: currentId || `seq_${entries.length + 1}`,
            sequence: seq,
            validation: analyzeDnaSequence(seq),
          });
        }
        currentId = t.slice(1).trim().split(/\s+/)[0] || `seq_${entries.length + 1}`;
        currentSeq = [];
      } else {
        currentSeq.push(t);
      }
    }
    if (currentId || currentSeq.length > 0) {
      const seq = currentSeq.join('');
      entries.push({
        id: currentId || `seq_${entries.length + 1}`,
        sequence: seq,
        validation: analyzeDnaSequence(seq),
      });
    }
    return entries.filter((e) => e.sequence.length > 0);
  }

  return lines
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((line, index) => ({
      id: `seq_${index + 1}`,
      sequence: line,
      validation: analyzeDnaSequence(line),
    }));
}

export type ConfidenceTier = 'High' | 'Medium' | 'Low' | 'Very low';

export function getConfidenceTier(confidence: number): {
  tier: ConfidenceTier;
  tone: 'emerald' | 'cyan' | 'amber' | 'rose';
  description: string;
} {
  const normalized = confidence > 1 ? confidence / 100 : confidence;
  if (normalized >= 0.85) {
    return { tier: 'High', tone: 'emerald', description: 'Strong taxonomic match (>= 85%)' };
  }
  if (normalized >= 0.65) {
    return { tier: 'Medium', tone: 'cyan', description: 'Moderate taxonomic match (65–84%)' };
  }
  if (normalized >= 0.45) {
    return { tier: 'Low', tone: 'amber', description: 'Ambiguous signal (45–64%)' };
  }
  return { tier: 'Very low', tone: 'rose', description: 'Potential novel taxon (< 45%)' };
}

export function formatPercent(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—';
  const pct = val <= 1 && val >= 0 ? val * 100 : val;
  return `${pct.toFixed(decimals)}%`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  // The API's times are UTC, but SQLite and the MLOps JSON stores drop the offset; JS would read those as local time
  const date = new Date(/T[\d:.]+$/.test(iso) ? `${iso}Z` : iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatNumber(val: number | null | undefined): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—';
  return new Intl.NumberFormat('en-US').format(val);
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function getErrorBannerMessage(err: unknown): string {
  const apiErr = err as Partial<ApiErrorInfo> | undefined;
  if (apiErr?.message) return apiErr.message;
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred while communicating with the API.';
}

/** "v2.1", "3" or 2 → one leading "v" (the bundled model's version string already carries it). */
export function formatModelVersion(version: string | number): string {
  return `v${String(version).replace(/^v/i, '')}`;
}

/**
 * Registry URIs (models:/…, runs:/…, s3://…) are shown as-is; local file paths are cut to their
 * last two folders so the page never shows the server's directory layout or user name.
 */
export function displayModelUri(uri: string): string {
  if (/^[a-z][a-z0-9+.-]*:\//i.test(uri) && !/^[a-z]:[\\/]/i.test(uri)) return uri;
  const parts = uri.split(/[\\/]+/).filter(Boolean);
  return parts.length > 2 ? `…/${parts.slice(-2).join('/')}` : parts.join('/');
}
