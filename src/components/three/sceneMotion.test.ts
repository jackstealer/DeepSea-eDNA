import { expect, test } from 'vitest';
import { sceneMotion } from './Scene3DGate';

test('full motion runs every frame at normal speed', () => {
  expect(sceneMotion({ animate: true, gentle: false })).toEqual({ speed: 1, frameloop: 'always' });
});

test('reduced motion keeps the scene alive and interactive, just slower', () => {
  expect(sceneMotion({ animate: false, gentle: true })).toEqual({ speed: 1 / 3, frameloop: 'always' });
});

test('off-screen or hidden tab stops the render loop', () => {
  expect(sceneMotion({ animate: false, gentle: false })).toEqual({ speed: 0, frameloop: 'demand' });
});
