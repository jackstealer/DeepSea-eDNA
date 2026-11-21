import { Fragment, useRef } from 'react';
import { usePrefersReducedMotion } from '@/components/three/Scene3DGate';
import { gsap, useGSAP } from '@/lib/motion/gsap';

/** "Animalia › Chordata › …" with each rank stepping in left to right once on mount. */
export function LineageTrail({ items }: { items: string[] }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();
  useGSAP(
    () => {
      if (reduced || !ref.current) return;
      gsap.from(ref.current.children, { opacity: 0, x: -8, duration: 0.4, ease: 'power2.out', stagger: 0.07 });
    },
    { scope: ref, dependencies: [reduced] }
  );
  return (
    <span ref={ref}>
      {items.map((rank, i) => (
        <Fragment key={`${rank}-${i}`}>
          {/* separator stays outside the inline-block so its spaces aren't trimmed */}
          {i > 0 && ' › '}
          <span className="inline-block">{rank}</span>
        </Fragment>
      ))}
    </span>
  );
}
