import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compareReports } from '../src/compare.js';
import { ReportSchema, type Report } from '../src/schema.js';

// Reportes reales de la demo (tests/fixtures/README.md).
const load = (name: string): Report =>
  ReportSchema.parse(
    JSON.parse(
      readFileSync(
        fileURLToPath(new URL(`./fixtures/reports/${name}.json`, import.meta.url)),
        'utf8',
      ),
    ),
  );

const rota = load('demo-rota-1');
const rota2 = load('demo-rota-2');
const rotaClsRuido = load('demo-rota-cls-ruido');
const arreglada = load('demo-arreglada-1');
const arreglada2 = load('demo-arreglada-2');

describe('compare con reportes reales de la demo', () => {
  it('rota → arreglada: mejoran las métricas y se resuelven los problemas catalogados', () => {
    const c = compareReports(rota, arreglada);
    expect(c.verdict).toBe('improved');
    expect(c.score.change).toBe('improved');
    for (const id of ['lcp', 'fcp', 'tbt', 'cls', 'si'] as const) {
      expect(c.metrics[id].change, id).toBe('improved');
    }
    expect(c.metrics.ttfb.change).toBe('unchanged');
    expect(c.metrics.lcp.ratingBefore).toBe('poor');
    expect(c.metrics.lcp.ratingAfter).toBe('good');

    const status = Object.fromEntries(c.opportunities.map((o) => [o.id, o.status]));
    for (const id of [
      'render-blocking-insight',
      'unused-javascript',
      'font-display-insight',
      'unsized-images',
      'cls-culprits-insight',
    ]) {
      expect(status[id], id).toBe('resolved');
    }
    expect(status['image-delivery-insight']).toBe('better');
    expect(c.resources[0]).toMatchObject({ type: 'total' });
    expect(c.resources[0]!.delta).toBeLessThan(-7 * 1024 * 1024);
  });

  it('arreglada → rota es una regresión', () => {
    const c = compareReports(arreglada, rota);
    expect(c.verdict).toBe('regressed');
    expect(c.metrics.lcp.change).toBe('regressed');
    expect(c.metrics.cls.change).toBe('regressed');
  });

  it('dos ejecuciones iguales de la demo arreglada: unchanged en todo', () => {
    const c = compareReports(arreglada, arreglada2);
    expect(c.verdict).toBe('unchanged');
    expect(c.score.change).toBe('unchanged');
    expect(Object.values(c.metrics).map((d) => d.change)).toEqual(Array(6).fill('unchanged'));
    expect(c.opportunities.every((o) => o.status === 'same')).toBe(true);
  });

  it('dos ejecuciones iguales de la demo rota: unchanged y sin oportunidades nuevas ni resueltas', () => {
    const c = compareReports(rota, rota2);
    expect(c.verdict).toBe('unchanged');
    expect(c.opportunities.filter((o) => o.status === 'new' || o.status === 'resolved')).toEqual(
      [],
    );
  });

  it('el rango min–max filtra el CLS inestable: mediana 0 con rango 0–0,291 frente a 0,291 es ruido', () => {
    expect(rotaClsRuido.metrics.cls).toMatchObject({ value: 0, min: 0, max: 0.291 });
    const c = compareReports(rota, rotaClsRuido);
    expect(c.metrics.cls).toMatchObject({ delta: -0.291, change: 'unchanged' });
  });
});
