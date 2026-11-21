import { useRef, useState, type DragEvent } from 'react';
import { FileText, UploadCloud, X } from 'lucide-react';
import { cn, formatBytes } from '@/lib/utils';

const DEFAULT_ACCEPTED = ['.fasta', '.fa', '.fna', '.fas', '.fastq', '.fq', '.csv'];
const MAX_BYTES = 500 * 1024 * 1024; // 500 MB

interface DropzoneProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
  maxBytes?: number;
  acceptedExtensions?: string[];
  onValidationError?: (message: string) => void;
}

export function Dropzone({
  files,
  onFilesChange,
  disabled = false,
  maxBytes = MAX_BYTES,
  acceptedExtensions = DEFAULT_ACCEPTED,
  onValidationError,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleSelected = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const accepted: File[] = [];

    for (const file of Array.from(list)) {
      const lower = file.name.toLowerCase();
      const validExt = acceptedExtensions.some((ext) => lower.endsWith(ext));
      if (!validExt) {
        onValidationError?.(
          `Unsupported format: ${file.name}. Allowed: ${acceptedExtensions.join(', ')}`
        );
        continue;
      }
      if (file.size > maxBytes) {
        onValidationError?.(
          `${file.name} exceeds the ${formatBytes(maxBytes)} limit (${formatBytes(file.size)}).`
        );
        continue;
      }
      accepted.push(file);
    }

    if (accepted.length > 0) {
      onFilesChange(accepted);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    handleSelected(e.dataTransfer.files);
  };

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload FASTA, FASTQ, or CSV sequence file"
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500',
          dragging
            ? 'border-cyan-400 bg-cyan-500/10'
            : 'border-slate-300 dark:border-slate-700 hover:border-cyan-500/60 bg-slate-50/70 dark:glass',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={acceptedExtensions.join(',')}
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            handleSelected(e.target.files);
            e.target.value = '';
          }}
        />
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 mb-3">
          <UploadCloud className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
          Drop sequence files here, or click to browse
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Supports FASTA (.fasta, .fa, .fna), FASTQ (.fastq, .fq), or CSV up to 500 MB
        </p>
      </div>

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, idx) => (
            <li
              key={`${file.name}-${idx}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:glass-strong px-3.5 py-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="h-4 w-4 text-cyan-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium font-mono text-slate-900 dark:text-slate-100 truncate">
                    {file.name}
                  </p>
                  <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {formatBytes(file.size)}
                  </p>
                </div>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onFilesChange(files.filter((_, i) => i !== idx))}
                  aria-label={`Remove ${file.name}`}
                  className="rounded p-1 text-slate-400 hover:text-rose-500 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
