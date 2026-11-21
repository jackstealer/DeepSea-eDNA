import { expect, test } from 'vitest';
import { createQualityGovernor, particleBudget, shouldAnimate } from './oceanQuality';

test('small screens get fewer particles; lower quality levels shed load', () => {
  expect(particleBudget(1440, 0)).toEqual({ snow: 220, plankton: 40, caustics: true, maxDpr: 2 });
  expect(particleBudget(375, 0)).toEqual({ snow: 90, plankton: 18, caustics: true, maxDpr: 2 });
  expect(particleBudget(1440, 1)).toEqual({ snow: 132, plankton: 24, caustics: true, maxDpr: 1.5 });
  expect(particleBudget(1440, 2)).toEqual({ snow: 77, plankton: 14, caustics: false, maxDpr: 1 });
});

test('quality drops after sustained slow frames and recovers after sustained fast ones', () => {
  const g = createQualityGovernor();
  const run = (frameMs: number, seconds: number) => {
    let level = g.level;
    for (let t = 0; t < seconds; t += frameMs / 1000) level = g.sample(frameMs);
    return level;
  };
  expect(run(16, 5)).toBe(0); // smooth 60 fps stays at full quality
  expect(run(33, 3)).toBe(1); // ~30 fps for 3 s steps down once
  expect(run(33, 3)).toBe(2); // still slow: steps down again
  expect(run(33, 3)).toBe(2); // never below the lowest level
  expect(run(10, 14)).toBe(1); // long fast stretch steps back up one level
});

test('one janky frame does not change quality', () => {
  const g = createQualityGovernor();
  for (let i = 0; i < 120; i++) g.sample(16);
  g.sample(400);
  for (let i = 0; i < 30; i++) g.sample(16);
  expect(g.level).toBe(0);
});

test('animates only when visible, focused (or briefly unfocused) and motion is allowed', () => {
  const base = { hidden: false, reducedMotion: false, blurredAt: null, now: 100_000, blurGraceMs: 20_000 };
  expect(shouldAnimate(base)).toBe(true);
  expect(shouldAnimate({ ...base, hidden: true })).toBe(false);
  expect(shouldAnimate({ ...base, reducedMotion: true })).toBe(false);
  expect(shouldAnimate({ ...base, blurredAt: 90_000 })).toBe(true); // unfocused for 10 s
  expect(shouldAnimate({ ...base, blurredAt: 70_000 })).toBe(false); // unfocused for 30 s
});
