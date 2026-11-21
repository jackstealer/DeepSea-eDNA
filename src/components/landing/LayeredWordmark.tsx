import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from '@/components/three/Scene3DGate';
import { gsap, useGSAP } from '@/lib/motion/gsap';

const LETTER_STYLE = {
  fontSize: 'clamp(4rem, 16vw, 16rem)',
  backgroundImage: 'linear-gradient(to bottom, var(--ds-ink), color-mix(in oklab, var(--ds-ink) 28%, transparent))',
} as const;

/**
 * The giant hero wordmark, Kage-style: two identical copies, one painted under the 3D helix canvas
 * and one above it showing only the `front` letters, so the helix reads as weaving through the word.
 * Render it as a direct child of the page root (outside <main>) so it shares the canvas's stacking context.
 */
export function LayeredWordmark({ text = 'DEEPSEA', front = [6] }: { text?: string; front?: number[] }) {
  const backRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (reduced) return;
      gsap.to([backRef.current, frontRef.current], {
        yPercent: -35,
        opacity: 0,
        ease: 'none',
        scrollTrigger: { trigger: '#top', start: 'top top', end: 'bottom top', scrub: true },
      });
    },
    { dependencies: [reduced] }
  );

  const layer = (isFront: boolean) => (
    <div
      ref={isFront ? frontRef : backRef}
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-x-0 top-[13vh] flex select-none justify-center overflow-hidden whitespace-nowrap font-light leading-[0.85] tracking-[-0.06em]',
        isFront ? 'z-[5]' : 'z-0'
      )}
    >
      {[...text].map((ch, i) => (
        <span
          key={i}
          className="bg-clip-text text-transparent"
          style={{ ...LETTER_STYLE, visibility: isFront && !front.includes(i) ? 'hidden' : undefined }}
        >
          {ch}
        </span>
      ))}
    </div>
  );

  return (
    <>
      {layer(false)}
      {layer(true)}
    </>
  );
}
