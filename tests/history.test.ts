import { describe, expect, it } from 'vitest';
import { buildHistory } from '../src/history.js';
import { makeReport } from './helpers.js';

const m = (value: number, min = value, max = value) => ({ value, min, max });
const at = (hour: number) => `2026-10-21T${String(hour).padStart(2, '0')}:00:00Z`;

describe('buildHistory', () => {
  const reports = [
    makeReport({ createdAt: at(12), score: 90, metrics: { lcp: m(2000, 1950, 2050) } }),
    makeReport({ createdAt: at(10), score: 60, metrics: { lcp: m(4500, 4400, 4600) } }),
    makeReport({ createdAt: at(11), score: 61, metrics: { lcp: m(4550, 4450, 4650) } }),
  ];
  const history = buildHistory('https://example.com/', reports);

  it('ordena de más antiguo a más reciente', () => {
    expect(history.entries.map((e) => e.createdAt)).toEqual([at(10), at(11), at(12)]);
  });

  it('el primero no tiene comparación previa', () => {
    expect(history.entries[0]).not.toHaveProperty('vsPrevious');
  });

  it('cada entrada se compara con la anterior: ruido y mejora real', () => {
    expect(history.entries[1]?.vsPrevious).toMatchObject({
      id: history.entries[0]?.id,
      score: { delta: 1, change: 'unchanged' },
      metrics: { lcp: { delta: 50, change: 'unchanged' } },
    });
    expect(history.entries[2]?.vsPrevious).toMatchObject({
      score: { delta: 29, change: 'improved' },
      metrics: { lcp: { delta: -2550, change: 'improved' } },
    });
  });

  it('compara solo dentro del mismo perfil (device)', () => {
    const mixed = buildHistory('https://example.com/', [
      makeReport({ createdAt: at(10), device: 'mobile', score: 40 }),
      makeReport({ createdAt: at(11), device: 'desktop', score: 95 }),
      makeReport({ createdAt: at(12), device: 'mobile', score: 80 }),
    ]);
    expect(mixed.entries[1]).not.toHaveProperty('vsPrevious');
    expect(mixed.entries[2]?.vsPrevious?.score).toEqual({ delta: 40, change: 'improved' });
  });

  it('conserva etiqueta, commit y número de ejecuciones', () => {
    const r = makeReport({ createdAt: at(10), label: 'base', runs: 5 });
    r.git = { commit: 'abc1234', dirty: true };
    expect(buildHistory('https://example.com/', [r]).entries[0]).toMatchObject({
      label: 'base',
      git: { commit: 'abc1234', dirty: true },
      runs: 5,
    });
  });
});
