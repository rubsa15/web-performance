import { describe, expect, it } from 'vitest';
import { compareReports } from '../src/compare.js';
import { UsageError } from '../src/errors.js';
import { makeOpportunity, makeReport } from './helpers.js';

const m = (value: number, min = value, max = value) => ({ value, min, max });

describe('compareReports — métricas', () => {
  const before = makeReport({
    score: 41,
    metrics: {
      lcp: m(4800, 4700, 4900),
      cls: m(0.29),
      tbt: m(640, 470, 650),
      fcp: m(2500, 2490, 2510),
      si: m(2500, 2490, 2510),
      ttfb: m(750),
    },
  });

  it('mejora: cada métrica con su delta, porcentaje, valoración y resultado', () => {
    const after = makeReport({
      score: 92,
      metrics: {
        lcp: m(2100, 2050, 2200),
        cls: m(0),
        tbt: m(20, 15, 25),
        fcp: m(1400, 1390, 1410),
        si: m(1400, 1390, 1410),
        ttfb: m(750),
      },
    });
    const c = compareReports(before, after);

    expect(c.verdict).toBe('improved');
    expect(c.score).toEqual({ before: 41, after: 92, delta: 51, change: 'improved' });
    expect(c.metrics.lcp).toMatchObject({
      before: 4800,
      after: 2100,
      delta: -2700,
      change: 'improved',
      ratingBefore: 'poor',
      ratingAfter: 'good',
      unit: 'ms',
    });
    expect(c.metrics.lcp.deltaPct).toBeCloseTo(-0.5625);
    expect(c.metrics.cls).toMatchObject({ delta: -0.29, change: 'improved', unit: '' });
    expect(c.metrics.ttfb).toMatchObject({ delta: 0, change: 'unchanged' });
  });

  it('regresión: el mismo par al revés', () => {
    const after = makeReport({
      score: 92,
      metrics: {
        lcp: m(2100, 2050, 2200),
        cls: m(0.29),
        tbt: m(640, 470, 650),
        fcp: m(2500, 2490, 2510),
        si: m(2500, 2490, 2510),
        ttfb: m(750),
      },
    });
    const c = compareReports(after, before);
    expect(c.metrics.lcp.change).toBe('regressed');
    expect(c.score.change).toBe('regressed');
    expect(c.verdict).toBe('regressed');
  });

  it('ruido: variaciones dentro del umbral o con rangos solapados dan unchanged', () => {
    const a = makeReport({
      score: 80,
      metrics: { lcp: m(2400, 2000, 2800), tbt: m(100, 90, 110), cls: m(0.05) },
    });
    const b = makeReport({
      score: 82,
      metrics: { lcp: m(2900, 2700, 3100), tbt: m(130, 120, 140), cls: m(0.06) },
    });
    const c = compareReports(a, b);
    expect(c.metrics.lcp.change).toBe('unchanged'); // +500 ms, pero 2700 ≤ 2800
    expect(c.metrics.tbt.change).toBe('unchanged'); // rangos separados, pero +30 ms < 50
    expect(c.metrics.cls.change).toBe('unchanged');
    expect(c.score.change).toBe('unchanged');
    expect(c.verdict).toBe('unchanged');
  });

  it('dos reportes idénticos: todo unchanged y sin cambios en oportunidades ni recursos', () => {
    const c = compareReports(before, structuredClone(before));
    expect(c.verdict).toBe('unchanged');
    expect(Object.values(c.metrics).every((d) => d.change === 'unchanged' && d.delta === 0)).toBe(
      true,
    );
    expect(c.opportunities.every((o) => o.status === 'same')).toBe(true);
    expect(c.resources.every((r) => r.delta === 0)).toBe(true);
  });

  it('mejora en unas métricas y regresión en otras: mixed', () => {
    const after = makeReport({
      score: 41,
      metrics: { lcp: m(2100), tbt: m(1400, 1300, 1500) },
    });
    const c = compareReports(before, after);
    expect(c.metrics.lcp.change).toBe('improved');
    expect(c.metrics.tbt.change).toBe('regressed');
    expect(c.verdict).toBe('mixed');
  });

  it('deltaPct es null cuando el valor base es 0', () => {
    const c = compareReports(
      makeReport({ metrics: { cls: m(0) } }),
      makeReport({ metrics: { cls: m(0.3) } }),
    );
    expect(c.metrics.cls.deltaPct).toBeNull();
    expect(c.metrics.cls.change).toBe('regressed');
  });
});

describe('compareReports — comparabilidad', () => {
  it('rechaza dispositivos distintos', () => {
    expect(() => compareReports(makeReport(), makeReport({ device: 'desktop' }))).toThrow(
      UsageError,
    );
    expect(() => compareReports(makeReport(), makeReport({ device: 'desktop' }))).toThrow(
      /mobile vs desktop/,
    );
  });

  it('avisa en lcpElement de que el elemento LCP cambió (solo si ambos reportes lo tienen)', () => {
    const lcp = (selector: string) => ({
      element: { selector, snippet: `<img class="${selector}">` },
    });
    const a = makeReport();
    const b = makeReport();
    delete a.lcp; // makeReport parte del LHR de BBC, que ya trae elemento LCP
    delete b.lcp;
    expect(compareReports(a, b)).not.toHaveProperty('lcpElement');
    a.lcp = lcp('img.hero');
    expect(compareReports(a, b)).not.toHaveProperty('lcpElement');
    b.lcp = lcp('img.hero');
    expect(compareReports(a, b).lcpElement).toEqual({
      before: 'img.hero',
      after: 'img.hero',
      changed: false,
    });
    b.lcp = lcp('h1.titulo');
    expect(compareReports(a, b).lcpElement).toEqual({
      before: 'img.hero',
      after: 'h1.titulo',
      changed: true,
    });
  });

  it('rechaza perfiles de red distintos', () => {
    expect(() => compareReports(makeReport(), makeReport({ network: '3g' }))).toThrow(
      /perfil de red \(default vs 3g\)/,
    );
  });

  it('trata un reporte sin `network` (anterior a --network) como default', () => {
    const old = makeReport();
    delete old.environment.network;
    expect(() => compareReports(old, makeReport())).not.toThrow();
    expect(() => compareReports(old, makeReport({ network: '4g' }))).toThrow(/default vs 4g/);
  });

  it('rechaza throttling distinto', () => {
    expect(() => compareReports(makeReport(), makeReport({ throttling: 'devtools' }))).toThrow(
      /throttling/,
    );
  });

  it('avisa, sin rechazar, de distinta versión de Lighthouse o de Chrome', () => {
    const c = compareReports(
      makeReport({ lighthouseVersion: '13.5.0', chromeVersion: '155.0.1.0' }),
      makeReport({ lighthouseVersion: '13.6.0', chromeVersion: '156.0.1.0' }),
    );
    expect(c.warnings.join('\n')).toMatch(/Lighthouse distintas \(13\.5\.0 vs 13\.6\.0\)/);
    expect(c.warnings.join('\n')).toMatch(/Chrome distintas/);
  });

  it('no avisa de Chrome si solo cambia el parche', () => {
    const c = compareReports(
      makeReport({ chromeVersion: '155.0.1.0' }),
      makeReport({ chromeVersion: '155.0.9.9' }),
    );
    expect(c.warnings).toEqual([]);
  });

  it('avisa si las URLs difieren, si hay una sola ejecución o si el orden parece invertido', () => {
    const c = compareReports(
      makeReport({ url: 'http://a.test/', createdAt: '2026-10-21T12:00:00Z', runs: 1 }),
      makeReport({ url: 'http://b.test/', createdAt: '2026-10-21T10:00:00Z' }),
    );
    const text = c.warnings.join('\n');
    expect(text).toMatch(/URLs son distintas/);
    expect(text).toMatch(/una sola ejecución/);
    expect(text).toMatch(/posterior al segundo/);
  });

  it('un par comparable normal no genera avisos', () => {
    expect(
      compareReports(makeReport(), makeReport({ createdAt: '2026-10-21T11:00:00Z' })).warnings,
    ).toEqual([]);
  });
});

describe('compareReports — oportunidades (SPEC §6)', () => {
  const status = (
    before: ReturnType<typeof makeOpportunity>[],
    after: ReturnType<typeof makeOpportunity>[],
  ) =>
    Object.fromEntries(
      compareReports(
        makeReport({ opportunities: before }),
        makeReport({ opportunities: after }),
      ).opportunities.map((o) => [o.id, o.status]),
    );

  it('clasifica new, resolved, better, worse y same', () => {
    expect(
      status(
        [
          makeOpportunity('resuelta', 800),
          makeOpportunity('mejor', 1000),
          makeOpportunity('peor', 300),
          makeOpportunity('igual', 400),
        ],
        [
          makeOpportunity('nueva', 500),
          makeOpportunity('mejor', 400),
          makeOpportunity('peor', 900),
          makeOpportunity('igual', 410),
        ],
      ),
    ).toEqual({
      nueva: 'new',
      resuelta: 'resolved',
      mejor: 'better',
      peor: 'worse',
      igual: 'same',
    });
  });

  it('el ahorro en bytes también cuenta cuando no hay ahorro en ms', () => {
    const KiB = 1024;
    expect(
      status([makeOpportunity('img', 0, 800 * KiB)], [makeOpportunity('img', 0, 100 * KiB)]),
    ).toEqual({ img: 'better' });
    expect(
      status([makeOpportunity('img', 0, 800 * KiB)], [makeOpportunity('img', 0, 805 * KiB)]),
    ).toEqual({ img: 'same' });
  });

  it('ordena primero lo que empeora, luego lo que mejora y al final lo que no cambia', () => {
    const c = compareReports(
      makeReport({
        opportunities: [
          makeOpportunity('same', 400),
          makeOpportunity('resolved', 800),
          makeOpportunity('worse', 300),
        ],
      }),
      makeReport({
        opportunities: [
          makeOpportunity('same', 400),
          makeOpportunity('worse', 900),
          makeOpportunity('new', 200),
        ],
      }),
    );
    expect(c.opportunities.map((o) => o.id)).toEqual(['new', 'worse', 'resolved', 'same']);
  });

  it('guarda ambos lados y los deltas; el lado ausente cuenta como 0', () => {
    const c = compareReports(
      makeReport({ opportunities: [makeOpportunity('a', 800, 2048)] }),
      makeReport({ opportunities: [] }),
    );
    expect(c.opportunities[0]).toMatchObject({
      id: 'a',
      status: 'resolved',
      before: { savingsMs: 800, savingsBytes: 2048, impact: 'high' },
      deltaMs: -800,
      deltaBytes: -2048,
    });
    expect(c.opportunities[0]).not.toHaveProperty('after');
  });
});

describe('compareReports — recursos', () => {
  it('lista el total y cada tipo, con tipos que solo existen en un lado', () => {
    const c = compareReports(
      makeReport({ resources: { totalBytes: 1000, byType: { image: 800, script: 200 } } }),
      makeReport({ resources: { totalBytes: 500, byType: { image: 300, font: 200 } } }),
    );
    expect(c.resources).toEqual([
      { type: 'total', before: 1000, after: 500, delta: -500 },
      { type: 'font', before: 0, after: 200, delta: 200 },
      { type: 'image', before: 800, after: 300, delta: -500 },
      { type: 'script', before: 200, after: 0, delta: -200 },
    ]);
  });
});

describe('compareReports — referencias', () => {
  it('resume cada reporte con id, url, device, ejecuciones, etiqueta y commit', () => {
    const a = makeReport({ label: 'antes', runs: 3 });
    a.git = { commit: 'abc1234', dirty: false };
    const c = compareReports(a, makeReport());
    expect(c.before).toEqual({
      id: a.id,
      url: 'https://example.com/',
      device: 'mobile',
      network: 'default',
      createdAt: a.createdAt,
      runs: 3,
      label: 'antes',
      git: { commit: 'abc1234', dirty: false },
    });
    expect(c.after).not.toHaveProperty('label');
  });
});
