import type { RefObject } from 'react';
import { usePrefersReducedMotion } from '@/components/three/Scene3DGate';
import { gsap, ScrollTrigger, useGSAP } from './gsap';

/** The [data-reveal] elements inside `root` right now. Anything mounted later is never touched. */
export function revealTargets(root: ParentNode): Element[] {
  return Array.from(root.querySelectorAll('[data-reveal]'));
}

/**
 * Rise-in for every [data-reveal] element as it scrolls into view, once per `deps` change.
 * The hidden start state is set here in JS (never in CSS), and only on laid-out elements,
 * so content that mounts later or is hidden at mount can never get stuck invisible.
 */
export function useRevealOnScroll(rootRef: RefObject<HTMLElement | null>, deps: unknown[]): void {
  const reduced = usePrefersReducedMotion();
  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root || reduced) return;
      const targets = revealTargets(root).filter((el) => el.getBoundingClientRect().height > 0);
      if (!targets.length) return;
      gsap.set(targets, { opacity: 0, y: 24 });
      ScrollTrigger.batch(targets, {
        start: 'top 92%',
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.06, overwrite: true }),
      });
    },
    { scope: rootRef, dependencies: [reduced, ...deps], revertOnUpdate: true }
  );
}
