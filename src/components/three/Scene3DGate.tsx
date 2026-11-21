import { Component, Suspense, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react';

/**
 * Lightweight wrapper for the WebGL scenes. It imports no three.js itself, so pages stay small:
 * the scene component is lazy-loaded inside it. Handles the cases a professional 3D UI must:
 * - no WebGL (old GPU, disabled acceleration)  -> static fallback
 * - prefers-reduced-motion                      -> gentle mode: slower ambient motion, still follows the pointer
 * - scene scrolled off-screen or tab hidden     -> animation paused (saves battery/GPU)
 * - any runtime error in the scene              -> static fallback instead of a broken page
 */

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

class SceneErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('3D scene disabled:', error.message, info.componentStack);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export interface SceneControls {
  /** full motion: the scene is visible and reduced motion is not requested */
  animate: boolean;
  /** reduced motion requested while visible: keep it alive and interactive, but calmer */
  gentle: boolean;
}

/** How fast a scene's ambient motion runs, and whether its canvas needs a continuous render loop. */
export function sceneMotion({ animate, gentle }: SceneControls): { speed: number; frameloop: 'always' | 'demand' } {
  if (animate) return { speed: 1, frameloop: 'always' };
  if (gentle) return { speed: 1 / 3, frameloop: 'always' };
  return { speed: 0, frameloop: 'demand' };
}

export function Scene3DGate({
  fallback,
  className,
  children,
}: {
  fallback: ReactNode;
  className?: string;
  children: (controls: SceneControls) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [supported] = useState(detectWebGL);
  const reducedMotion = usePrefersReducedMotion();
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.05 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onVisibility = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return (
    <div ref={ref} className={className}>
      {supported ? (
        <SceneErrorBoundary fallback={fallback}>
          <Suspense fallback={fallback}>
            {children({ animate: !reducedMotion && inView && pageVisible, gentle: reducedMotion && inView && pageVisible })}
          </Suspense>
        </SceneErrorBoundary>
      ) : (
        fallback
      )}
    </div>
  );
}
