import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { usePrefersReducedMotion } from '@/components/three/Scene3DGate';
import { onOceanEvent } from '@/lib/oceanEvents';
import { OCEAN } from './oceanConfig';
import { createQualityGovernor, motionSpeed, shouldAnimate } from './oceanQuality';
import { createOceanScene, type OceanScene } from './oceanScene';

/**
 * Full-screen deep-sea background behind the whole app ("night view from a submersible window").
 * Mounted once above the router, so it never restarts on navigation. Never takes pointer events
 * and sits below every layer, so modals, toasts and dropdowns always stay on top.
 *
 * One requestAnimationFrame loop drives the canvas; nothing here re-renders React per frame.
 * The loop stops when the tab is hidden and after the window has been unfocused for a while.
 * Under reduced motion it keeps running, slower (OCEAN.reducedMotion.speed), like the 3D scenes.
 */
export function OceanBackground() {
  const theme = useAuthStore((s) => s.theme);
  const reducedMotion = usePrefersReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sinkRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<OceanScene | null>(null);
  const reducedRef = useRef(reducedMotion);
  const runningRef = useRef(false);
  const paintStillRef = useRef<() => void>(() => {});
  const palette = OCEAN.palette[theme];

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return; // no 2D canvas: the CSS depth gradient alone still shows
    const scene = createOceanScene(canvas, ctx, useAuthStore.getState().theme);
    sceneRef.current = scene;
    const governor = createQualityGovernor();

    let raf = 0;
    let last = 0;
    let blurredAt: number | null = document.hasFocus() ? null : performance.now();
    let blurTimer = 0;
    let resizeQueued = 0;
    let sinkShown = -1;

    const setSink = (value: number) => {
      if (sinkRef.current && Math.abs(value - sinkShown) > 0.003) {
        sinkRef.current.style.opacity = value.toFixed(3);
        sinkShown = value;
      }
    };
    const paintStill = () => {
      scene.renderStill();
      setSink(0);
    };
    paintStillRef.current = paintStill;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const frameMs = now - last;
      last = now;
      const level = governor.sample(frameMs);
      if (level !== scene.level) scene.setQuality(level);
      // clamp: a long stall must not teleport particles
      scene.frame((Math.min(frameMs, 50) / 1000) * motionSpeed(reducedRef.current));
      setSink(scene.sinkOpacity);
    };

    const reconcile = () => {
      const run = shouldAnimate({
        hidden: document.hidden,
        blurredAt,
        now: performance.now(),
        blurGraceMs: OCEAN.performance.pauseAfterBlurMs,
      });
      if (run && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      } else if (!run && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      runningRef.current = raf !== 0;
    };

    const resizeNow = () => {
      resizeQueued = 0;
      scene.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio);
      if (!raf) paintStill();
    };
    const onResize = () => {
      if (!resizeQueued) resizeQueued = requestAnimationFrame(resizeNow); // coalesce bursts of resize events
    };
    // The window 'focus' event isn't guaranteed after an unfocused pause (devtools, iframes, some
    // window managers), so any sign of the user being back resumes the loop. Hovering a window that
    // isn't focused (e.g. the app on screen while typing elsewhere) counts as watching it too: it
    // restarts the grace period instead of leaving the ocean frozen.
    const resumeIfBack = () => {
      if (blurredAt === null) return;
      if (document.hasFocus()) {
        onFocus();
      } else {
        onBlur();
        reconcile();
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      resumeIfBack();
      scene.pointerMove(e.clientX, e.clientY, e.timeStamp);
    };
    const onVisibility = () => {
      if (!document.hidden) resumeIfBack();
      reconcile();
    };
    const onPointerOut = (e: PointerEvent) => {
      if (!e.relatedTarget) scene.pointerLeave(); // left the window
    };
    const onScroll = () => {
      const max = Math.max(1, Math.min(OCEAN.scroll.depthPx, document.documentElement.scrollHeight - window.innerHeight));
      scene.setScroll(window.scrollY / max);
    };
    function onBlur() {
      blurredAt = performance.now();
      window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(reconcile, OCEAN.performance.pauseAfterBlurMs + 50);
    }
    function onFocus() {
      blurredAt = null;
      window.clearTimeout(blurTimer);
      reconcile();
    }
    const offEvents = onOceanEvent((event) => {
      if (event.type === 'health') {
        scene.setHealthy(event.healthy);
        if (!raf) paintStill();
      } else {
        scene.ripple(event.type === 'novel-taxon' ? 'novel' : 'success');
      }
    });

    resizeNow();
    onScroll();
    reconcile();
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerout', onPointerOut, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    window.addEventListener('keydown', resumeIfBack, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(resizeQueued);
      window.clearTimeout(blurTimer);
      offEvents();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerout', onPointerOut);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('keydown', resumeIfBack);
      document.removeEventListener('visibilitychange', onVisibility);
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    reducedRef.current = reducedMotion; // read by the loop each frame
  }, [reducedMotion]);

  useEffect(() => {
    sceneRef.current?.setTheme(theme);
    if (!runningRef.current) paintStillRef.current();
  }, [theme]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* 1. depth gradient: surface light at the top fading to near-black */}
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(180deg, ${palette.surface} 0%, ${palette.mid} 42%, ${palette.deep} 100%)` }}
      />
      {/* 2–6. rays, caustics, marine snow, plankton, helix */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {/* scrolling deeper darkens the water */}
      <div ref={sinkRef} className="absolute inset-0" style={{ background: palette.sink, opacity: 0 }} />
      {/* soft vignette, like looking through a viewport */}
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(120% 95% at 50% 32%, transparent 52%, ${palette.vignette} 100%)` }}
      />
    </div>
  );
}
