import { OCEAN } from './oceanConfig';

export type QualityLevel = 0 | 1 | 2;

export interface ParticleBudget {
  snow: number;
  plankton: number;
  caustics: boolean;
  maxDpr: number;
}

/** How much the scene draws for a viewport width at a quality level (0 = full). */
export function particleBudget(width: number, level: QualityLevel): ParticleBudget {
  const mobile = width < OCEAN.counts.mobileBreakpoint;
  const shed = OCEAN.performance.shed[level];
  return {
    snow: Math.round((mobile ? OCEAN.counts.snow.mobile : OCEAN.counts.snow.desktop) * shed),
    plankton: Math.round((mobile ? OCEAN.counts.plankton.mobile : OCEAN.counts.plankton.desktop) * shed),
    caustics: level < 2,
    maxDpr: OCEAN.performance.dpr[level],
  };
}

/**
 * Steps quality down after a sustained run of slow frames and back up after a long run of
 * fast ones. Single janky frames (GC, tab switch) never change anything.
 */
export function createQualityGovernor() {
  const { slowFrameMs, fastFrameMs, downgradeAfterS, upgradeAfterS } = OCEAN.performance;
  let level: QualityLevel = 0;
  let slow = 0;
  let fast = 0;
  return {
    get level() {
      return level;
    },
    /** Feed one frame's duration (ms); returns the current level. */
    sample(frameMs: number): QualityLevel {
      const dt = frameMs / 1000;
      if (frameMs > slowFrameMs) {
        slow += dt;
        fast = 0;
      } else if (frameMs <= fastFrameMs) {
        fast += dt;
        slow = 0;
      } else {
        slow = 0;
        fast = 0;
      }
      if (slow >= downgradeAfterS) {
        level = Math.min(2, level + 1) as QualityLevel;
        slow = 0;
      } else if (fast >= upgradeAfterS) {
        level = Math.max(0, level - 1) as QualityLevel;
        fast = 0;
      }
      return level;
    },
  };
}

/** The loop runs only while the tab is visible and the window isn't long unfocused. */
export function shouldAnimate(s: { hidden: boolean; blurredAt: number | null; now: number; blurGraceMs: number }): boolean {
  if (s.hidden) return false;
  return s.blurredAt === null || s.now - s.blurredAt < s.blurGraceMs;
}

/** Time scale for the scene: reduced motion slows the ocean down instead of freezing it. */
export function motionSpeed(reducedMotion: boolean): number {
  return reducedMotion ? OCEAN.reducedMotion.speed : 1;
}
