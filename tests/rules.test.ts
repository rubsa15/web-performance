import { describe, expect, it } from 'vitest';
import { compareOpportunities, impactOf, median, rate } from '../src/rules.js';
import type { Opportunity } from '../src/schema.js';

describe('rate', () => {
  it('usa los umbrales oficiales con los límites incluidos en el tramo mejor', () => {
    expect(rate('lcp', 2500)).toBe('good');
    expect(rate('lcp', 2501)).toBe('needs-improvement');
    expect(rate('lcp', 4000)).toBe('needs-improvement');
    expect(rate('lcp', 4001)).toBe('poor');
    expect(rate('cls', 0.1)).toBe('good');
    expect(rate('cls', 0.26)).toBe('poor');
    expect(rate('tbt', 200)).toBe('good');
    expect(rate('ttfb', 1801)).toBe('poor');
  });
});

describe('impactOf (SPEC §6)', () => {
  it.each([
    [500, 0, 'high'],
    [499, 0, 'medium'],
    [0, 250 * 1024, 'high'],
    [0, 250 * 1024 - 1, 'medium'],
    [150, 0, 'medium'],
    [149, 0, 'low'],
    [0, 50 * 1024, 'medium'],
    [0, 50 * 1024 - 1, 'low'],
    [0, 0, 'low'],
  ] as const)('%d ms / %d bytes → %s', (ms, bytes, expected) => {
    expect(impactOf(ms, bytes)).toBe(expected);
  });
});

describe('compareOpportunities', () => {
  const op = (id: string, impact: Opportunity['impact'], savingsMs: number, savingsBytes: number) =>
    ({ id, impact, savingsMs, savingsBytes }) as Opportunity;

  it('ordena por impacto, luego ms, luego bytes y desempata por id', () => {
    const sorted = [
      op('d', 'low', 900, 0),
      op('c', 'high', 600, 10),
      op('b', 'high', 600, 90),
      op('a', 'high', 800, 0),
      op('e', 'high', 600, 90),
    ].sort(compareOpportunities);
    expect(sorted.map((o) => o.id)).toEqual(['a', 'b', 'e', 'c', 'd']);
  });
});

describe('median', () => {
  it('toma el valor central y promedia los dos centrales si hay un número par', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([7])).toBe(7);
  });

  it('falla con una lista vacía', () => {
    expect(() => median([])).toThrow(RangeError);
  });
});
