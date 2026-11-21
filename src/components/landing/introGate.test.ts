import { expect, test } from 'vitest';
import { shouldShowIntro } from './introGate';

const storage = (entries: Record<string, string> = {}) => ({ getItem: (k: string) => entries[k] ?? null });

test('first visit in a session shows the intro', () => {
  expect(shouldShowIntro(storage(), false)).toBe(true);
});

test('a repeat visit in the same session skips it', () => {
  expect(shouldShowIntro(storage({ deepsea_intro_seen: '1' }), false)).toBe(false);
});

test('reduced motion never shows it', () => {
  expect(shouldShowIntro(storage(), true)).toBe(false);
});
