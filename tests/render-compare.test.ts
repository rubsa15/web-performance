import { describe, expect, it } from 'vitest';
import { compareReports } from '../src/compare.js';
import { buildHistory } from '../src/history.js';
import {
  renderComparison,
  renderComparisonMarkdown,
  renderComparisonText,
  renderHistory,
  sparkline,
} from '../src/render-compare.js';
import { makeOpportunity, makeReport } from './helpers.js';

const m = (value: number, min = value, max = value) => ({ value, min, max });

const before = makeReport({
  label: 'rota',
  createdAt: '2026-10-21T10:00:00Z',
  score: 41,
  metrics: { lcp: m(4800, 4700, 4900), cls: m(0.29), ttfb: m(750) },
  opportunities: [
    makeOpportunity('render-blocking-insight', 1550),
    makeOpportunity('same-one', 300),
  ],
  resources: {
    totalBytes: 8 * 1024 * 1024,
    byType: { image: 7 * 1024 * 1024, script: 1024 * 1024 },
  },
});
const after = makeReport({
  label: 'arreglada',
  createdAt: '2026-10-21T11:00:00Z',
  score: 92,
  metrics: { lcp: m(2100, 2050, 2200), cls: m(0), ttfb: m(750) },
  opportunities: [makeOpportunity('same-one', 300), makeOpportunity('new-one', 200)],
  resources: { totalBytes: 1024 * 1024, byType: { image: 1024 * 1024, script: 1024 * 1024 } },
});
const comparison = compareReports(before, after);

describe('renderComparisonText', () => {
  const text = renderComparisonText(comparison);

  it('muestra el veredicto, las referencias y la puntuación', () => {
    expect(text).toContain('Comparación de rendimiento — improved');
    expect(text).toContain('Antes:   ' + before.id);
    expect(text).toContain('"rota"');
    expect(text).toContain('Puntuación: 41 → 92 (+51)  improved');
  });

  it('muestra cada métrica con antes, después, delta, porcentaje y valoración', () => {
    expect(text).toMatch(
      /LCP\s+4,800 ms\s+→\s+2,100 ms\s+-2,700 ms \(-56%\)\s+poor → good\s+improved/,
    );
    expect(text).toMatch(/CLS\s+0.29\s+→\s+0\s+-0.29 \(-100%\)\s+poor → good\s+improved/);
    expect(text).toMatch(/TTFB\s+750 ms\s+→\s+750 ms\s+0 ms\s+good\s+unchanged/);
  });

  it('lista solo las oportunidades que cambian y cuenta las que no', () => {
    expect(text).toContain('Mejoras (2 con cambios, 1 sin cambios)');
    expect(text).toMatch(/new\s+\[medium\]\s+Título de new-one\s+— → 200 ms/);
    expect(text).toMatch(/resolved\s+\[high\]\s+Título de render-blocking-insight\s+1,550 ms → —/);
    expect(text).not.toContain('same-one');
  });

  it('muestra los recursos que cambian', () => {
    expect(text).toMatch(/total\s+8.0 MiB → 1.0 MiB\s+-7.0 MiB/);
    expect(text).toMatch(/image\s+7.0 MiB → 1.0 MiB/);
    expect(text).not.toMatch(/script\s+1.0 MiB → 1.0 MiB/);
  });

  it('sin color no hay secuencias ANSI y con color sí', () => {
    // eslint-disable-next-line no-control-regex
    expect(text).not.toMatch(/\x1b\[/);
    // eslint-disable-next-line no-control-regex
    expect(renderComparisonText(comparison, { color: true })).toMatch(/\x1b\[/);
  });

  it('incluye los avisos', () => {
    const warned = compareReports(before, makeReport({ url: 'https://other.test/' }));
    expect(renderComparisonText(warned)).toContain('Aviso: Las URLs son distintas');
  });

  it('un par idéntico dice unchanged y que no cambia nada', () => {
    const same = renderComparisonText(compareReports(before, structuredClone(before)));
    expect(same).toContain('Comparación de rendimiento — unchanged');
    expect(same).toContain('Ninguna oportunidad ha cambiado.');
    expect(same).toContain('Sin cambios.');
  });
});

describe('renderComparisonMarkdown', () => {
  const md = renderComparisonMarkdown(comparison);

  it('genera tablas de métricas, mejoras y recursos', () => {
    expect(md).toMatch(/^# Comparación de rendimiento/);
    expect(md).toContain('- **Resultado:** improved');
    expect(md).toContain(
      '| LCP | 4,800 ms | 2,100 ms | -2,700 ms (-56%) | poor → good | improved |',
    );
    expect(md).toContain(
      '| resolved | high | Título de render-blocking-insight (`render-blocking-insight`) | 1,550 ms → — |',
    );
    expect(md).toContain('1 oportunidades sin cambios.');
    expect(md).toContain('| total | 8.0 MiB | 1.0 MiB | -7.0 MiB |');
  });
});

describe('renderComparison', () => {
  it('json es la Comparison tal cual', () => {
    expect(JSON.parse(renderComparison(comparison, 'json'))).toEqual(
      JSON.parse(JSON.stringify(comparison)),
    );
  });
});

describe('sparkline', () => {
  it('escala entre el mínimo y el máximo', () => {
    expect(sparkline([1, 8])).toBe('▁█');
    expect(sparkline([5, 5, 5])).toBe('▁▁▁');
    expect(sparkline([0, 50, 100])).toBe('▁▅█');
  });
});

describe('renderHistory', () => {
  const history = buildHistory('https://example.com/', [
    makeReport({
      createdAt: '2026-10-21T10:00:00Z',
      score: 40,
      metrics: { lcp: m(4000, 3900, 4100) },
    }),
    makeReport({
      createdAt: '2026-10-21T11:00:00Z',
      score: 41,
      metrics: { lcp: m(4050, 3950, 4150) },
    }),
    makeReport({
      createdAt: '2026-10-21T12:00:00Z',
      score: 90,
      metrics: { lcp: m(2000, 1950, 2050) },
    }),
  ]);

  it('tabla por defecto: flecha solo en los cambios significativos', () => {
    const text = renderHistory(history, 'text');
    expect(text).toContain('Historial de https://example.com/ (3 auditorías)');
    const rows = text.split('\n').filter((l) => l.includes('Z-mobile'));
    expect(rows[0]).not.toMatch(/[↑↓]/);
    expect(rows[1]).not.toMatch(/[↑↓]/); // 41 vs 40 y +50 ms: ruido
    expect(rows[2]).toMatch(/90 ↑/);
    expect(rows[2]).toMatch(/2,000 ms ↓/);
  });

  it('con métrica: valor, rango, delta y evolución', () => {
    const text = renderHistory(history, 'text', 'lcp');
    expect(text).toMatch(/4,000 ms\s+3,900 ms – 4,100 ms\s+needs-improvement\s+—/);
    expect(text).toMatch(/-2,050 ms ↓/);
    expect(text).toContain('Evolución de LCP: ██▁');
  });

  it('md y json', () => {
    const md = renderHistory(history, 'md', 'lcp');
    expect(md).toMatch(/^# Historial de https:\/\/example.com\//);
    expect(md).toContain('| ID | LCP | Rango | Valoración | Δ anterior | Commit | Etiqueta |');
    expect(JSON.parse(renderHistory(history, 'json')).entries).toHaveLength(3);
  });
});
