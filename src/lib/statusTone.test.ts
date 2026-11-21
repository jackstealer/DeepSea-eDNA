import { expect, test } from 'vitest';
import { statusTone } from './utils';

test('health statuses map to badge colours, critical included', () => {
  expect(statusTone('healthy')).toBe('emerald');
  expect(statusTone('warning')).toBe('amber');
  expect(statusTone('critical')).toBe('rose');
  expect(statusTone('degraded')).toBe('rose');
});
