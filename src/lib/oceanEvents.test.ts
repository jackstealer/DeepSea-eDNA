import { expect, test, vi } from 'vitest';
import { emitOceanEvent, onOceanEvent, type OceanEvent } from './oceanEvents';

test('subscribers receive events until they unsubscribe', () => {
  const seen: OceanEvent[] = [];
  const off = onOceanEvent((e) => seen.push(e));
  emitOceanEvent({ type: 'classification-success' });
  emitOceanEvent({ type: 'health', healthy: false });
  off();
  emitOceanEvent({ type: 'novel-taxon' });
  expect(seen).toEqual([{ type: 'classification-success' }, { type: 'health', healthy: false }]);
});

test('a failing listener never breaks the caller or other listeners', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const good = vi.fn();
  const offBad = onOceanEvent(() => {
    throw new Error('boom');
  });
  const offGood = onOceanEvent(good);
  expect(() => emitOceanEvent({ type: 'novel-taxon' })).not.toThrow();
  expect(good).toHaveBeenCalledWith({ type: 'novel-taxon' });
  offBad();
  offGood();
  warn.mockRestore();
});
