import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compareReports } from '../src/compare.js';
import { buildHistory } from '../src/history.js';
import { extractNumbers, recallOf, unverifiedFigures } from '../src/experiments/skill-eval.js';
import { ReportSchema, type Report } from '../src/schema.js';

const here = (path: string): string => fileURLToPath(new URL(path, import.meta.url));
const loadReport = (name: string): Report =>
  ReportSchema.parse(JSON.parse(readFileSync(here(`./fixtures/reports/${name}.json`), 'utf8')));
const loadExample = (skill: string): string =>
  readFileSync(here(`../.claude/skills/${skill}/references/ejemplo-salida.md`), 'utf8');

const rota = loadReport('ejemplo-skill-rota');
const arreglada = loadReport('ejemplo-skill-arreglada');
const regresionAntes = loadReport('ejemplo-skill-regresion-antes');
const fixAntes = loadReport('ejemplo-fix-antes');
const fixDespues = loadReport('ejemplo-fix-despues');
const fixRevertido = loadReport('ejemplo-fix-revertido-despues');
const redes = ['default', '3g', '4g'].map((n) => loadReport(`ejemplo-skill-red-${n}`));

describe('extractNumbers', () => {
  it('lee formato español con miles y decimales', () => {
    const nums = extractNumbers('LCP 40 728 ms, CLS 0,291, 2,81 MiB, −38 624 ms');
    expect(nums.map((n) => n.readings)).toEqual([
      [{ value: 40728, decimals: 0 }],
      [{ value: 0.291, decimals: 3 }],
      [{ value: 2.81, decimals: 2 }],
      [{ value: 38624, decimals: 0 }],
    ]);
  });

  it('ignora ids abreviados de reporte', () => {
    expect(extractNumbers('Entre `19-41-55Z` y `19-42-38Z`')).toEqual([]);
  });

  it('ignora ids de reporte, commits, versiones y puertos', () => {
    const md = 'Reporte `2026-10-21T19-42-38Z-mobile` en :4173, commit 3bbc3a2, Lighthouse 13.5.0';
    expect(extractNumbers(md)).toEqual([]);
  });
});

describe('unverifiedFigures', () => {
  it('admite conversiones de unidad y redondeos del JSON', () => {
    const md = 'LCP 40 728 ms (40,7 s), CLS 0,291, hero 2,81 MiB, score 41';
    expect(unverifiedFigures(md, rota)).toEqual([]);
  });

  it('excluye las líneas marcadas como cifra del código', () => {
    const md = 'Construye 150 000 entradas (fuente: código, `js/app.js`).\nEl LCP baja 1 234 ms.';
    expect(unverifiedFigures(md, rota)).toEqual(['1 234']);
  });

  it('detecta una cifra inventada', () => {
    expect(unverifiedFigures('El LCP baja 1 234 ms y el score 77', rota)).toEqual(['1 234', '77']);
  });
});

describe('ejemplos de las skills', () => {
  it('perf-audit: las cifras salen del reporte y cubre los 7 problemas', () => {
    const md = loadExample('perf-audit');
    expect(unverifiedFigures(md, rota)).toEqual([]);
    expect(recallOf(md).found).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('perf-compare: las cifras salen de la comparación', () => {
    const md = loadExample('perf-compare');
    expect(unverifiedFigures(md, [rota, arreglada, compareReports(rota, arreglada)])).toEqual([]);
  });
});

describe('ejemplo multiperfil de perf-audit', () => {
  it('las cifras salen de los tres reportes', () => {
    const md = readFileSync(
      here('../.claude/skills/perf-audit/references/ejemplo-multiperfil.md'),
      'utf8',
    );
    expect(unverifiedFigures(md, redes)).toEqual([]);
  });
});

describe('ejemplo de regresión de perf-compare', () => {
  it('las cifras salen de los dos reportes originales y de su comparación', () => {
    const md = readFileSync(
      here('../.claude/skills/perf-compare/references/ejemplo-regresion.md'),
      'utf8',
    );
    const source = [regresionAntes, rota, compareReports(regresionAntes, rota)];
    expect(unverifiedFigures(md, source)).toEqual([]);
  });
});

describe('ejemplo de serie de perf-compare', () => {
  it('las cifras salen del historial y de las comparaciones que hace', () => {
    const md = readFileSync(
      here('../.claude/skills/perf-compare/references/ejemplo-serie.md'),
      'utf8',
    );
    const [rota1, clsRuido, rota2] = ['demo-rota-1', 'demo-rota-cls-ruido', 'demo-rota-2'].map(
      loadReport,
    );
    const serie = [regresionAntes, rota, rota1!, clsRuido!, rota2!, redes[0]!];
    const source = [
      ...serie,
      buildHistory('http://127.0.0.1:4173/', serie),
      compareReports(regresionAntes, rota),
      compareReports(rota1!, clsRuido!),
      compareReports(regresionAntes, redes[0]!),
      compareReports(rota, redes[0]!),
    ];
    expect(unverifiedFigures(md, source)).toEqual([]);
  });
});

describe('recallOf', () => {
  it('lista los problemas no mencionados', () => {
    const r = recallOf('Solo `render-blocking-insight` y `unused-javascript`.');
    expect(r.found).toEqual([3, 4]);
    expect(r.missing).toEqual([1, 2, 5, 6, 7]);
  });
});

describe('ejemplos de perf-fix', () => {
  const read = (name: string): string =>
    readFileSync(here(`../.claude/skills/perf-fix/references/${name}`), 'utf8');

  it('mejora medida: las cifras salen de los dos reportes y su comparación', () => {
    const source = [fixAntes, fixDespues, compareReports(fixAntes, fixDespues)];
    expect(unverifiedFigures(read('ejemplo-salida.md'), source)).toEqual([]);
  });

  it('arreglo revertido: las cifras salen de los dos reportes y su comparación', () => {
    const source = [fixAntes, fixRevertido, compareReports(fixAntes, fixRevertido)];
    expect(unverifiedFigures(read('ejemplo-revertido.md'), source)).toEqual([]);
  });
});
