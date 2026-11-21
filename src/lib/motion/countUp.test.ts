import { describe, expect, test } from 'vitest';
import { formatCountable, parseCountable } from './countUp';

describe('parseCountable', () => {
  test('grouped integers', () => {
    expect(parseCountable('48,000')).toEqual({ target: 48000, decimals: 0, grouped: true, suffix: '' });
  });
  test('percentages keep their decimals', () => {
    expect(parseCountable('91.1%')).toEqual({ target: 91.1, decimals: 1, grouped: false, suffix: '%' });
    expect(parseCountable('0.0%')).toEqual({ target: 0, decimals: 1, grouped: false, suffix: '%' });
  });
  test('plain numbers', () => {
    expect(parseCountable(4)).toEqual({ target: 4, decimals: 0, grouped: false, suffix: '' });
  });
  test('versions, placeholders, empty and worded values never count', () => {
    expect(parseCountable('v2.1')).toBeNull();
    expect(parseCountable('—')).toBeNull();
    expect(parseCountable('')).toBeNull();
    expect(parseCountable('3 taxa')).toBeNull();
  });
});

describe('formatCountable', () => {
  test('round-trips the final value and formats intermediate ones the same way', () => {
    const grouped = parseCountable('48,000')!;
    expect(formatCountable(grouped, 48000)).toBe('48,000');
    const pct = parseCountable('91.1%')!;
    expect(formatCountable(pct, 91.1)).toBe('91.1%');
    expect(formatCountable(pct, 0)).toBe('0.0%');
  });
});
