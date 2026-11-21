import { useMemo, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/components/three/Scene3DGate';
import { formatCountable, parseCountable } from '@/lib/motion/countUp';
import { gsap, useGSAP } from '@/lib/motion/gsap';

/**
 * Counts a headline number up once per mount ("48,000", "91.1%"); later value changes (refetches)
 * just update the text. Non-numeric values render as-is. Screen readers only ever get the final value.
 */
export function CountUp({ value, className }: { value: string | number; className?: string }) {
  const reduced = usePrefersReducedMotion();
  const final = String(value);
  const parsed = useMemo(() => parseCountable(value), [value]);
  const played = useRef(false);
  const animating = Boolean(parsed) && !reduced && !played.current;
  const [shown, setShown] = useState(() => (animating && parsed ? formatCountable(parsed, 0) : final));

  useGSAP(
    () => {
      if (!parsed || reduced || played.current) {
        setShown(final);
        return;
      }
      played.current = true;
      const state = { n: 0 };
      gsap.to(state, {
        n: parsed.target,
        duration: 1.1,
        ease: 'power3.out',
        onUpdate: () => setShown(formatCountable(parsed, state.n)),
        onComplete: () => setShown(final),
      });
    },
    { dependencies: [final, reduced] }
  );

  return (
    <span className={className}>
      <span aria-hidden="true">{shown}</span>
      <span className="sr-only">{final}</span>
    </span>
  );
}
