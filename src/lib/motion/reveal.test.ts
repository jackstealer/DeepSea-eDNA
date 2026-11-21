// @vitest-environment jsdom
import { beforeAll, expect, test } from 'vitest';

let revealTargets: (root: ParentNode) => Element[];

beforeAll(async () => {
  // jsdom has no matchMedia; GSAP's ScrollTrigger touches it when the module registers.
  window.matchMedia ??= ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  ({ revealTargets } = await import('./reveal'));
});

test('reveal targets are the [data-reveal] elements present at call time only', () => {
  const root = document.createElement('div');
  root.innerHTML = '<div data-reveal></div><section><p data-reveal></p></section><span></span>';
  const targets = revealTargets(root);
  expect(targets).toHaveLength(2);

  // Content that mounts later (e.g. a classification result) is never hidden by the entrance.
  const late = document.createElement('div');
  late.setAttribute('data-reveal', '');
  root.appendChild(late);
  expect(targets).toHaveLength(2);
  expect(late.style.opacity).toBe('');
});
