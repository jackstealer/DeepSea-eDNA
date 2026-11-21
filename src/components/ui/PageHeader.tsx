import type { ReactNode } from 'react';

/** Page title in the homepage's display style: light sans with an iridescent serif accent. */
export function PageHeader({
  title,
  accent,
  subtitle,
  actions,
}: {
  title: string;
  accent?: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between dark:on-water">
      <div className="min-w-0">
        <h1 className="text-[clamp(1.75rem,3vw,2.5rem)] font-light leading-[1.05] tracking-[-0.035em] text-ds-ink [text-wrap:balance]">
          {title}
          {accent && (
            <>
              {' '}
              <span className="accent-phrase text-iridescent">{accent}</span>
            </>
          )}
        </h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ds-muted dark:text-slate-300">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
