export interface Countable {
  target: number;
  decimals: number;
  grouped: boolean;
  suffix: '' | '%';
}

const GROUPED = /^-?\d{1,3}(,\d{3})+(\.\d+)?%?$/;
const PLAIN = /^-?\d+(\.\d+)?%?$/;

/** Numbers worth counting up ("48,000", "91.1%", 4); anything else (versions, "—", "3 taxa") is shown as-is. */
export function parseCountable(value: string | number): Countable | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return { target: value, decimals: (String(value).split('.')[1] ?? '').length, grouped: false, suffix: '' };
  }
  const text = value.trim();
  const grouped = GROUPED.test(text);
  if (!grouped && !PLAIN.test(text)) return null;
  const suffix = text.endsWith('%') ? '%' : '';
  const body = (suffix ? text.slice(0, -1) : text).replace(/,/g, '');
  return { target: Number(body), decimals: (body.split('.')[1] ?? '').length, grouped, suffix };
}

export function formatCountable(p: Countable, n: number): string {
  const text = p.grouped
    ? n.toLocaleString('en-US', { minimumFractionDigits: p.decimals, maximumFractionDigits: p.decimals })
    : n.toFixed(p.decimals);
  return text + p.suffix;
}
