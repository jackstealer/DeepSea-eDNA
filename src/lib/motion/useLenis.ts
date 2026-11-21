import { useEffect } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { usePrefersReducedMotion } from '@/components/three/Scene3DGate';
import { gsap, ScrollTrigger } from './gsap';

/** Smooth wheel scrolling for the cinematic pages only. Off on touch devices and under reduced motion. */
export function useLenis(enabled: boolean): void {
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    if (!enabled || reduced || window.matchMedia('(pointer: coarse)').matches) return;
    const lenis = new Lenis({ lerp: 0.1, anchors: true });
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    };
  }, [enabled, reduced]);
}
