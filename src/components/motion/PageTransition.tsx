import { useRef, type ReactNode } from 'react';
import { usePrefersReducedMotion } from '@/components/three/Scene3DGate';
import { gsap, useGSAP } from '@/lib/motion/gsap';
import { useRevealOnScroll } from '@/lib/motion/reveal';

/** Fades the page in on every route change and staggers its cards in as they scroll into view. */
export function PageTransition({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (reduced || !ref.current) return;
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', clearProps: 'opacity,transform' }
      );
    },
    { dependencies: [routeKey, reduced], scope: ref }
  );
  useRevealOnScroll(ref, [routeKey]);

  return <div ref={ref}>{children}</div>;
}
