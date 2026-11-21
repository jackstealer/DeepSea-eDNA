import { createElement, useRef, type ReactNode } from 'react';
import { usePrefersReducedMotion } from '@/components/three/Scene3DGate';
import { gsap, SplitText, useGSAP } from '@/lib/motion/gsap';

/** A heading whose lines rise out of a mask the first time it scrolls into view. Plain text under reduced motion. */
export function SplitReveal({
  as = 'h2',
  className,
  children,
}: {
  as?: 'h1' | 'h2' | 'h3' | 'p';
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();

  useGSAP(
    () => {
      const el = ref.current;
      if (reduced || !el) return;
      const split = SplitText.create(el, {
        type: 'lines',
        mask: 'lines',
        autoSplit: true,
        onSplit: (self) =>
          gsap.from(self.lines, {
            yPercent: 110,
            opacity: 0,
            duration: 0.9,
            ease: 'power3.out',
            stagger: 0.08,
            scrollTrigger: { trigger: el, start: 'top 85%', once: true },
          }),
      });
      return () => split.revert();
    },
    { dependencies: [reduced], scope: ref }
  );

  return createElement(as, { ref, className }, children);
}
