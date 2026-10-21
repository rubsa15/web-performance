import { describe, expect, it } from 'vitest';
import { normalize } from '../src/normalizer.js';
import { render, renderMarkdown, renderText } from '../src/render.js';
import { ReportSchema } from '../src/schema.js';
import { loadLhr, variant } from './helpers.js';

const meta = {
  url: 'https://www.bbc.com/news',
  device: 'mobile',
  createdAt: new Date('2026-10-21T10:32:00Z'),
} as const;
const base = loadLhr('lhr-bbc-mobile');
const report = normalize([base], meta);
const multi = normalize([variant(base, { lcp: 7000 }), base, variant(base, { lcp: 9000 })], {
  ...meta,
  label: 'antes',
  git: { commit: 'abc1234', dirty: true },
});

describe('renderText', () => {
  const text = renderText(report);

  it('muestra cabecera, puntuación, métricas y mejoras con sus cifras', () => {
    expect(text).toContain('https://www.bbc.com/news · mobile · 1 ejecución · Lighthouse 13.5.0');
    expect(text).toContain('Puntuación: 45/100');
    expect(text).toMatch(/LCP\s+7,977 ms\s+poor/);
    expect(text).toMatch(/CLS\s+0\s+good/);
    expect(text).toContain('Mejoras (8 de 8)');
    expect(text).toContain('1,060 ms · 392 KiB · javascript · unused-javascript');
    expect(text).toContain('sin ahorro estimado · network · lcp-discovery-insight');
  });

  it('muestra el rango min–max cuando hay varias ejecuciones', () => {
    expect(renderText(multi)).toMatch(/LCP\s+7,977 ms\s+poor\s+7,000 ms – 9,000 ms/);
    expect(renderText(multi)).toContain('Etiqueta: antes');
    expect(renderText(multi)).toContain('Commit: abc1234 (con cambios sin commitear)');
  });

  it('limita la lista con top', () => {
    const limited = renderText(report, { top: 2 });
    expect(limited).toContain('Mejoras (2 de 8)');
    expect(limited).not.toContain('unused-javascript');
  });

  it('solo usa colores ANSI si se piden', () => {
    expect(text).not.toContain('\u001b[');
    expect(renderText(report, { color: true })).toContain('\u001b[');
  });
});

describe('renderMarkdown', () => {
  const md = renderMarkdown(report);

  it('genera tablas de métricas y mejoras', () => {
    expect(md).toContain('# Auditoría de rendimiento — https://www.bbc.com/news');
    expect(md).toContain('| LCP | 7,977 ms | poor | sin dispersión |');
    expect(md).toContain(
      '| 3 | high | Reduce unused JavaScript (`unused-javascript`) | 1,060 ms · 392 KiB | javascript | LCP |',
    );
  });

  it('lista los recursos afectados de cada mejora', () => {
    expect(md).toContain('### Reduce unused JavaScript');
    expect(md).toContain('- `https://cdn.tinypass.com/api/tinypass.min.js` — 110 KiB');
  });

  it('incluye diagnósticos y recursos', () => {
    expect(md).toContain('- Avoids enormous network payloads: Total size was 1,958 KiB');
    expect(md).toContain('Total transferido: 1.9 MiB');
    expect(md).toContain('- script: 1.3 MiB');
  });
});

describe('render', () => {
  it('json es el reporte completo y vuelve a validar', () => {
    const json = render(report, 'json');
    expect(ReportSchema.parse(JSON.parse(json))).toEqual(report);
  });

  it('elige el formato pedido', () => {
    expect(render(report, 'md').startsWith('# ')).toBe(true);
    expect(render(report, 'text')).toContain('Puntuación');
  });
});
