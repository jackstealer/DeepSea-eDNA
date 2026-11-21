import { useEffect, useRef, useState } from 'react';
import { BrandMark } from '@/components/common/BrandMark';
import { gsap } from '@/lib/motion/gsap';
import { INTRO_SEEN_KEY } from './introGate';

const CAP_MS = 2000;

/**
 * Full-screen loading counter for the first homepage visit of a session. The percentage follows
 * real work (fonts, the 3D helix chunk, the page's load event) and is capped at about 2 s; then the
 * curtain lifts and the hero plays.
 */
export function Preloader({ onDone }: { onDone: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const shown = { v: 0 };
    const tasks: Promise<unknown>[] = [
      document.fonts.ready,
      import('@/components/three/GlassHelix'),
      document.readyState === 'complete' ? Promise.resolve() : new Promise((r) => window.addEventListener('load', r, { once: true })),
    ];
    let finished = 0;
    let closed = false;
    const advance = (to: number, duration = 0.45) =>
      gsap.to(shown, { v: to, duration, ease: 'power2.out', overwrite: true, onUpdate: () => setPct(Math.round(shown.v)) });

    const close = () => {
      if (closed) return;
      closed = true;
      advance(100, 0.3).then(() =>
        gsap.to(rootRef.current, {
          yPercent: -100,
          duration: 0.6,
          ease: 'power3.inOut',
          onComplete: () => {
            try {
              sessionStorage.setItem(INTRO_SEEN_KEY, '1');
            } catch {
              // storage blocked: the intro may simply play again next time
            }
            done.current();
          },
        })
      );
    };
    tasks.forEach((task) =>
      task.catch(() => undefined).then(() => {
        finished += 1;
        advance((finished / tasks.length) * 100);
        if (finished === tasks.length) close();
      })
    );
    const cap = window.setTimeout(close, CAP_MS);
    return () => window.clearTimeout(cap);
  }, []);

  return (
    <div
      ref={rootRef}
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-ds-bg text-ds-ink"
    >
      <span className="flex items-center gap-3 text-[15px] font-medium tracking-tight">
        <BrandMark className="h-6 w-6" />
        DeepSea eDNA
      </span>
      <span className="mt-8 font-mono text-[clamp(3.5rem,12vw,8rem)] font-light leading-none tabular-nums tracking-[-0.05em]">
        {pct}
        <span className="text-iridescent">%</span>
      </span>
      <span className="sr-only">Loading</span>
    </div>
  );
}
