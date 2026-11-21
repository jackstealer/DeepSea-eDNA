import type { ReactNode } from 'react';
import { Card } from './Card';
import { Skeleton } from './Skeleton';
import { CountUp } from '@/components/motion/CountUp';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  icon?: ReactNode;
  tone?: 'default' | 'cyan' | 'emerald' | 'amber' | 'rose';
  loading?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  unit,
  subtext,
  icon,
  tone = 'default',
  loading = false,
  className,
}: StatCardProps) {
  const accentText =
    tone === 'cyan'
      ? 'text-cyan-600 dark:text-cyan-400'
      : tone === 'emerald'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'amber'
      ? 'text-amber-600 dark:text-amber-400'
      : tone === 'rose'
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-slate-900 dark:text-slate-100';

  return (
    <Card className={cn('flex flex-col justify-between gap-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
          {label}
        </span>
        {icon && (
          <span className="text-slate-400 dark:text-slate-500 shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3.5 w-32" />
        </div>
      ) : (
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className={cn('text-3xl font-light tabular-nums tracking-[-0.03em]', accentText)}>
              <CountUp value={value} />
            </span>
            {unit && (
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {unit}
              </span>
            )}
          </div>
          {subtext && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
              {subtext}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
