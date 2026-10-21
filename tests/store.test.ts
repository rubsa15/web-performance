import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RuntimeError } from '../src/errors.js';
import { normalize } from '../src/normalizer.js';
import { readReport, reportPath, saveRawLhrs, saveReport, siteSlug } from '../src/store.js';
import { loadLhr } from './helpers.js';

const report = normalize([loadLhr('lhr-bbc-mobile')], {
  url: 'https://www.bbc.com/news',
  device: 'mobile',
  createdAt: new Date('2026-10-21T10:32:00Z'),
});

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'wperf-store-'));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe('siteSlug', () => {
  it.each([
    ['https://www.bbc.com/news', 'www.bbc.com'],
    ['http://localhost:3000/', 'localhost-3000'],
    ['https://example.com:443/', 'example.com'],
  ])('%s → %s', (url, slug) => {
    expect(siteSlug(url)).toBe(slug);
  });
});

describe('saveReport / readReport', () => {
  it('guarda en .perf/reports/<sitio>/<id>.json y se puede releer validado', async () => {
    const path = await saveReport(dir, report);
    expect(path).toBe(
      join(dir, '.perf', 'reports', 'www.bbc.com', '2026-10-21T10-32-00Z-mobile.json'),
    );
    expect(path).toBe(reportPath(dir, report));
    expect(await readReport(path)).toEqual(report);
  });

  it('no sobrescribe un reporte existente', async () => {
    await saveReport(dir, report);
    await expect(saveReport(dir, report)).rejects.toThrow(RuntimeError);
  });

  it('rechaza un fichero que no cumple el esquema', async () => {
    const path = await saveReport(dir, report);
    await rm(path);
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path, JSON.stringify({ schemaVersion: 2 }));
    await expect(readReport(path)).rejects.toThrow(/no es un reporte válido/);
  });
});

describe('saveRawLhrs', () => {
  it('guarda un fichero por ejecución en .perf/raw/', async () => {
    const paths = await saveRawLhrs(dir, report, [{ a: 1 }, { a: 2 }]);
    expect(paths.map((p) => p.slice(dir.length + 1))).toEqual([
      join('.perf', 'raw', 'www.bbc.com', '2026-10-21T10-32-00Z-mobile-run1.json'),
      join('.perf', 'raw', 'www.bbc.com', '2026-10-21T10-32-00Z-mobile-run2.json'),
    ]);
    expect(JSON.parse(await readFile(paths[1]!, 'utf8'))).toEqual({ a: 2 });
  });
});
