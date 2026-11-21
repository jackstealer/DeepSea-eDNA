import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  const padClass =
    padding === 'none'
      ? ''
      : padding === 'sm'
      ? 'p-4'
      : padding === 'lg'
      ? 'p-6 sm:p-7'
      : 'p-5';

  return (
    <div
      data-reveal
      className={cn(
        'rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-white/[0.08] dark:glass transition-[border-color,box-shadow] duration-300 hover:border-cyan-600/30 hover:shadow-[0_10px_30px_-14px_rgba(14,116,144,0.35)] dark:hover:border-cyan-300/25 dark:hover:shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_12px_36px_-14px_rgba(34,211,238,0.45)]',
        padClass,
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 mb-4', className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-normal text-slate-900 dark:text-slate-100 tracking-tight truncate">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
