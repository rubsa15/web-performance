import { describe, expect, it } from 'vitest';
import { RuntimeError } from '../src/errors.js';
import { normalize } from '../src/normalizer.js';
import { ReportSchema } from '../src/schema.js';
import { loadLhr, variant } from './helpers.js';

const meta = {
  url: 'https://www.bbc.com/news',
  device: 'mobile',
  createdAt: new Date('2026-10-21T10:32:00.456Z'),
} as const;

describe('normalize (LHR real de Lighthouse 13, móvil)', () => {
  const report = normalize([loadLhr('lhr-bbc-mobile')], meta);

  it('produce un reporte que valida contra el esquema', () => {
    expect(ReportSchema.safeParse(report).success).toBe(true);
  });

  it('rellena identificación y entorno', () => {
    expect(report).toMatchObject({
      schemaVersion: 1,
      id: '2026-10-21T10-32-00Z-mobile',
      createdAt: '2026-10-21T10:32:00Z',
      url: 'https://www.bbc.com/news',
      finalUrl: 'https://www.bbc.com/news',
      device: 'mobile',
      environment: {
        lighthouseVersion: '13.5.0',
        chromeVersion: '155.0.0.0',
        throttling: 'simulate',
        runs: 1,
        representativeRun: 1,
      },
    });
  });

  it('lee puntuación y métricas redondeadas con su valoración', () => {
    expect(report.score).toBe(45);
    expect(report.metrics.lcp).toEqual({
      value: 7977,
      unit: 'ms',
      min: 7977,
      max: 7977,
      rating: 'poor',
    });
    expect(report.metrics.cls).toMatchObject({ value: 0, unit: '', rating: 'good' });
    expect(report.metrics.tbt).toMatchObject({ value: 2722, rating: 'poor' });
    expect(report.metrics.ttfb).toMatchObject({ value: 634, rating: 'good' });
  });

  it('extrae las oportunidades con ahorro, impacto y categoría de los ids reales', () => {
    const unused = report.opportunities.find((o) => o.id === 'unused-javascript');
    expect(unused).toMatchObject({
      category: 'javascript',
      savingsMs: 1060,
      savingsBytes: 401890,
      impact: 'high',
      affectedMetrics: ['lcp'],
    });
    expect(unused?.items[0]).toEqual({
      url: 'https://cdn.tinypass.com/api/tinypass.min.js',
      wastedBytes: 112970,
      totalBytes: 145197,
    });

    const cache = report.opportunities.find((o) => o.id === 'cache-insight');
    expect(cache).toMatchObject({ category: 'network', savingsMs: 300, impact: 'high' });
    // Sin overallSavingsBytes: se suma wastedBytes de los items (391 KiB en Lighthouse).
    expect(Math.round((cache?.savingsBytes ?? 0) / 1024)).toBe(391);
  });

  it('usa metricSavings (máximo de las métricas en ms) cuando no hay overallSavingsMs', () => {
    const bootup = report.opportunities.find((o) => o.id === 'bootup-time');
    expect(bootup).toMatchObject({ savingsMs: 2550, affectedMetrics: ['tbt'] });
    expect(bootup?.items[0]).toMatchObject({ cpuMs: 1637 });
  });

  it('incluye mejoras suspensas sin ahorro estimado como impacto bajo', () => {
    const discovery = report.opportunities.find((o) => o.id === 'lcp-discovery-insight');
    expect(discovery).toMatchObject({ savingsMs: 0, savingsBytes: 0, impact: 'low' });
  });

  it('no trata como mejora lo que Lighthouse da por bueno ni las métricas', () => {
    const ids = report.opportunities.map((o) => o.id);
    expect(ids).not.toContain('unsized-images');
    expect(ids).not.toContain('largest-contentful-paint');
    expect(ids).not.toContain('interactive');
    expect(ids).not.toContain('max-potential-fid');
  });

  it('ordena por impacto, ms y bytes', () => {
    const impacts = report.opportunities.map((o) => o.impact);
    expect(impacts).toEqual(
      [...impacts].sort((a, b) => 'hml'.indexOf(a[0]!) - 'hml'.indexOf(b[0]!)),
    );
    expect(report.opportunities[0]?.id).toBe('mainthread-work-breakdown');
  });

  it('no deja ninguna mejora real del fixture en la categoría `other`', () => {
    // Si una actualización de Lighthouse añade un id nuevo, este test avisa para mapearlo.
    expect(report.opportunities.filter((o) => o.category === 'other')).toEqual([]);
  });

  it('extrae diagnósticos y recursos', () => {
    expect(report.diagnostics).toContainEqual({
      id: 'total-byte-weight',
      title: 'Avoids enormous network payloads',
      displayValue: 'Total size was 1,958 KiB',
    });
    expect(report.resources.totalBytes).toBe(1998039);
    expect(report.resources.byType['script']).toBe(1368351);
    expect(report.resources.byType).not.toHaveProperty('total');
    expect(report.resources.byType).not.toHaveProperty('third-party');
  });

  it('guarda la etiqueta y el commit solo si se indican', () => {
    expect(report).not.toHaveProperty('label');
    expect(report).not.toHaveProperty('git');
    const withMeta = normalize([loadLhr('lhr-bbc-mobile')], {
      ...meta,
      label: 'antes de lazy-load',
      git: { commit: 'abc1234', dirty: true },
    });
    expect(withMeta).toMatchObject({
      label: 'antes de lazy-load',
      git: { commit: 'abc1234', dirty: true },
    });
  });
});

describe('normalize (LHR real, escritorio)', () => {
  it('valida contra el esquema y refleja el perfil', () => {
    const report = normalize([loadLhr('lhr-wikipedia-desktop')], {
      url: 'https://www.wikipedia.org/',
      device: 'desktop',
      createdAt: meta.createdAt,
    });
    expect(ReportSchema.safeParse(report).success).toBe(true);
    expect(report).toMatchObject({
      device: 'desktop',
      score: 61,
      id: '2026-10-21T10-32-00Z-desktop',
    });
    expect(report.metrics.cls.value).toBe(0.021);
    expect(report.opportunities.find((o) => o.id === 'image-delivery-insight')).toMatchObject({
      category: 'images',
      savingsMs: 150,
      impact: 'medium',
    });
  });
});

describe('normalize con varias ejecuciones', () => {
  const base = loadLhr('lhr-bbc-mobile');
  const runs = [
    variant(base, { score: 0.4, lcp: 9000.4, cls: 0.0004 }),
    variant(base, { score: 0.5, lcp: 8000, cls: 0.05 }),
    variant(base, { score: 0.6, lcp: 7000, cls: 0.0125 }),
  ];

  it('toma la mediana de puntuación y métricas, con min y max', () => {
    const report = normalize(runs, meta);
    expect(report.score).toBe(50);
    expect(report.metrics.lcp).toMatchObject({ value: 8000, min: 7000, max: 9000 });
    expect(report.metrics.cls).toMatchObject({ value: 0.013, min: 0, max: 0.05 });
    expect(report.environment.runs).toBe(3);
  });

  it('elige como representativa la ejecución de puntuación mediana', () => {
    expect(normalize(runs, meta).environment.representativeRun).toBe(2);
  });

  it('con un número par promedia las medianas y elige la ejecución más cercana', () => {
    const report = normalize([runs[0]!, runs[1]!], meta);
    expect(report.score).toBe(45);
    expect(report.environment.representativeRun).toBe(1);
  });
});

describe('normalize ante entradas inválidas', () => {
  it('falla si no hay ejecuciones', () => {
    expect(() => normalize([], meta)).toThrow(RuntimeError);
  });

  it('falla con un mensaje claro si el LHR no tiene el formato esperado', () => {
    expect(() => normalize([{ lighthouseVersion: '13.5.0' }], meta)).toThrow(/formato de LHR/);
  });

  it('falla si Lighthouse devolvió un runtimeError', () => {
    const lhr = {
      ...loadLhr('lhr-bbc-mobile'),
      runtimeError: { code: 'NO_FCP', message: 'Sin pintado' },
    };
    expect(() => normalize([lhr], meta)).toThrow(/NO_FCP.*Sin pintado/);
  });

  it('falla si el perfil del LHR no coincide con el pedido', () => {
    expect(() => normalize([loadLhr('lhr-wikipedia-desktop')], meta)).toThrow(
      /formFactor "desktop"/,
    );
  });

  it('falla si falta una métrica', () => {
    const lhr = loadLhr('lhr-bbc-mobile');
    delete lhr.audits['speed-index'];
    expect(() => normalize([lhr], meta)).toThrow(/métrica si/);
  });

  it('falla si no hay puntuación de rendimiento', () => {
    const lhr = loadLhr('lhr-bbc-mobile');
    lhr.categories.performance.score = null;
    expect(() => normalize([lhr], meta)).toThrow(/puntuación/);
  });

  it('avisa si falta resource-summary en vez de inventar recursos', () => {
    const lhr = loadLhr('lhr-bbc-mobile');
    delete lhr.audits['resource-summary'];
    const report = normalize([lhr], meta);
    expect(report.resources).toEqual({ totalBytes: 0, byType: {} });
    expect(report.warnings.join()).toMatch(/resource-summary/);
  });
});

describe('normalize — perfil de red', () => {
  it('sin --network, el reporte es default y el id no cambia', () => {
    const report = normalize([loadLhr('lhr-bbc-mobile')], meta);
    expect(report.environment.network).toBe('default');
    expect(report.id).toBe('2026-10-21T10-32-00Z-mobile');
    expect(report.warnings.some((w) => w.includes('perfil de red'))).toBe(false);
  });

  it('un perfil no default va en el id y en el entorno', () => {
    const lhr = loadLhr('lhr-bbc-mobile');
    (lhr.configSettings as { throttling?: unknown }).throttling = {
      rttMs: 300,
      throughputKbps: 700,
    };
    const report = normalize([lhr], { ...meta, network: '3g' });
    expect(report.id).toBe('2026-10-21T10-32-00Z-mobile-3g');
    expect(report.environment.network).toBe('3g');
    expect(report.warnings.some((w) => w.includes('perfil de red'))).toBe(false);
  });

  it('avisa si Lighthouse no aplicó el perfil pedido', () => {
    const report = normalize([loadLhr('lhr-bbc-mobile')], { ...meta, network: '3g' });
    expect(report.warnings).toContainEqual(expect.stringContaining('"3g" no se aplicó'));
  });
});
