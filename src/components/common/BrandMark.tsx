import { useId } from 'react';
import { cn } from '@/lib/utils';

/** Two crossing strands in the thin-film gradient: the product's mark */
export function BrandMark({ className }: { className?: string }) {
  const gradientId = useId();
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn('h-6 w-6 shrink-0', className)} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--ds-iri-1)' }} />
          <stop offset="0.5" style={{ stopColor: 'var(--ds-iri-2)' }} />
          <stop offset="1" style={{ stopColor: 'var(--ds-iri-3)' }} />
        </linearGradient>
      </defs>
      <g stroke={`url(#${gradientId})`} strokeWidth="2" strokeLinecap="round">
        <path d="M6 2c0 6 12 6 12 10S6 16 6 22" />
        <path d="M18 2c0 6-12 6-12 10s12 4 12 10" />
        <path d="M8.5 5.5h7M8.5 18.5h7" strokeWidth="1.5" opacity="0.6" />
      </g>
    </svg>
  );
}
