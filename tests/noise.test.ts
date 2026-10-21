import { describe, expect, it } from 'vitest';
import { analyzeNoise } from '../src/experiments/noise.js';
import { makeOpportunity, makeReport } from './helpers.js';

const m = (value: number, min = value, max = value) => ({ value, min, max });

describe('analyzeNoise', () => {
  const reports = [
    makeReport({
      score: 80,
      metrics: { lcp: m(2000, 1900, 2100) },
      opportunities: [makeOpportunity('a', 400)],
    }),
    makeReport({
      score: 82,
      metrics: { lcp: m(2100, 2000, 2200) },
      opportunities: [makeOpportunity('a', 410)],
    }),
    makeReport({ score: 81, metrics: { lcp: m(2900, 2800, 3000) }, opportunities: [] }),
  ];
  const md = analyzeNoise('demo', reports);

  it('resume la puntuación y la dispersión de cada métrica', () => {
    expect(md).toContain('### demo');
    expect(md).toContain('3 auditorías de 3 ejecuciones. Puntuación: mediana 81, rango 80–82.');
    // mediana 2100, rango entre medianas 900, umbral max(150, 10 % × 2100) = 210, 2 de 3 pares marcados
    expect(md).toMatch(/\| lcp \| 2100 \| 900 \| [\d.]+ \| 200 \| 210 \| 2\/3 \|/);
  });

  it('cuenta los pares marcados y el veredicto', () => {
    expect(md).toContain('Puntuación marcada en 0/3 pares;');
    expect(md).toContain('veredicto distinto de `unchanged` en 2/3.');
  });

  it('describe la estabilidad de cada oportunidad', () => {
    // presente en 2 de 3; aparece/desaparece en los pares con la tercera
    expect(md).toContain('| a | 2/3 | 0–410 | 0–0 | 2/3 |');
  });

  it('exige al menos dos auditorías', () => {
    expect(() => analyzeNoise('x', [reports[0]!])).toThrow(RangeError);
  });
});
