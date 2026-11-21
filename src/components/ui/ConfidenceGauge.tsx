import { useRef } from 'react';
import { getConfidenceTier } from '@/lib/utils';
import { CountUp } from '@/components/motion/CountUp';
import { usePrefersReducedMotion } from '@/components/three/Scene3DGate';
import { gsap, useGSAP } from '@/lib/motion/gsap';

interface ConfidenceGaugeProps {
  confidence: number; // 0..1 or 0..100
  size?: number;
  label?: string;
}

export function ConfidenceGauge({
  confidence,
  size = 156,
  label = 'Confidence',
}: ConfidenceGaugeProps) {
  const normalized = confidence > 1 ? confidence / 100 : confidence;
  const clamped = Math.max(0, Math.min(1, normalized));
  const pct = clamped * 100;
  const tier = getConfidenceTier(clamped);

  const strokeWidth = 11;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);
  const arcRef = useRef<SVGCircleElement>(null);
  const reduced = usePrefersReducedMotion();
  useGSAP(
    () => {
      if (reduced || !arcRef.current) return;
      gsap.fromTo(arcRef.current, { strokeDashoffset: circumference }, { strokeDashoffset: offset, duration: 0.9, ease: 'power3.out' });
    },
    { dependencies: [offset, reduced] }
  );

  const strokeColor =
    tier.tone === 'emerald'
      ? '#10B981'
      : tier.tone === 'cyan'
      ? '#22D3EE'
      : tier.tone === 'amber'
      ? '#F59E0B'
      : '#F43F5E';

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}: ${pct.toFixed(1)}% (${tier.tier})`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-200 dark:text-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          ref={arcRef}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
          <CountUp value={`${pct.toFixed(1)}%`} />
        </span>
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {label}
        </span>
      </div>
    </div>
  );
}
