import { describe, expect, it } from 'vitest';
import {
  classifyMetric,
  classifyScore,
  compareOpportunities,
  DEFAULT_THRESHOLDS as DEFAULT,
  exceeds,
  impactOf,
  median,
  rate,
} from '../src/rules.js';
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

describe('impactOf', () => {
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

describe('exceeds', () => {
  it('exige superar el umbral, no igualarlo: max(abs, rel × base)', () => {
    const t = { abs: 150, rel: 0.1 };
    expect(exceeds(1000, 1150, t)).toBe(false);
    expect(exceeds(1000, 1151, t)).toBe(true);
    // con base alta manda el umbral relativo: 10 % de 5000 = 500
    expect(exceeds(5000, 5500, t)).toBe(false);
    expect(exceeds(5000, 5501, t)).toBe(true);
    // en ambos sentidos
    expect(exceeds(1151, 1000, t)).toBe(true);
  });

  it('no se confunde por la coma flotante (0,22 − 0,2 es 0,02, no más)', () => {
    expect(exceeds(0.2, 0.22, { abs: 0.02, rel: 0 })).toBe(false);
    expect(exceeds(0.2, 0.221, { abs: 0.02, rel: 0 })).toBe(true);
  });
});

describe('classifyMetric', () => {
  const m = (value: number, min = value, max = value) => ({ value, min, max });

  it('salto grande y rangos separados: improved o regressed (todas las métricas mejoran al bajar)', () => {
    expect(classifyMetric('lcp', m(4000, 3900, 4100), m(2500, 2400, 2600))).toBe('improved');
    expect(classifyMetric('lcp', m(2500, 2400, 2600), m(4000, 3900, 4100))).toBe('regressed');
    expect(classifyMetric('cls', m(0.29), m(0))).toBe('improved');
  });

  it('salto por debajo del umbral: unchanged aunque los rangos no se solapen', () => {
    expect(classifyMetric('lcp', m(2000, 1990, 2010), m(2100, 2090, 2110))).toBe('unchanged');
    expect(classifyMetric('tbt', m(100), m(150))).toBe('unchanged');
    expect(classifyMetric('tbt', m(100), m(151))).toBe('regressed');
    // con TBT alto manda el 50 % relativo: el TBT es la métrica más ruidosa
    expect(classifyMetric('tbt', m(600, 500, 700), m(890, 800, 950))).toBe('unchanged');
    expect(classifyMetric('tbt', m(600, 500, 700), m(901, 800, 950))).toBe('regressed');
    expect(classifyMetric('cls', m(0.1), m(0.12))).toBe('unchanged');
    expect(classifyMetric('cls', m(0.1), m(0.121))).toBe('regressed');
  });

  it('salto grande pero rangos solapados: unchanged (ruido)', () => {
    expect(classifyMetric('lcp', m(2000, 1500, 2600), m(2400, 2300, 3000))).toBe('unchanged');
  });

  it('los rangos que solo se tocan en un extremo cuentan como solapados', () => {
    expect(classifyMetric('lcp', m(2000, 1900, 2300), m(2500, 2300, 2600))).toBe('unchanged');
    expect(classifyMetric('lcp', m(2000, 1900, 2299), m(2500, 2300, 2600))).toBe('regressed');
  });

  it('usa el umbral de cada métrica y acepta umbrales propios', () => {
    expect(classifyMetric('ttfb', m(500), m(590))).toBe('unchanged');
    expect(classifyMetric('ttfb', m(500), m(610))).toBe('regressed');
    const strict = { ...DEFAULT, metrics: { ...DEFAULT.metrics, lcp: { abs: 10, rel: 0 } } };
    expect(classifyMetric('lcp', m(2000), m(2050), strict)).toBe('regressed');
  });
});

describe('classifyScore', () => {
  it('cambia con más de 5 puntos; la puntuación mejora al subir', () => {
    expect(classifyScore(70, 75)).toBe('unchanged');
    expect(classifyScore(70, 65)).toBe('unchanged');
    expect(classifyScore(70, 76)).toBe('improved');
    expect(classifyScore(70, 64)).toBe('regressed');
  });
});
