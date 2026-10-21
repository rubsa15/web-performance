import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RuntimeError, UsageError } from '../src/errors.js';
import { normalize } from '../src/normalizer.js';
import {
  listReports,
  readReport,
  reportPath,
  resolveReport,
  saveRawLhrs,
  saveReport,
  siteSlug,
} from '../src/store.js';
import { loadLhr, makeReport } from './helpers.js';

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

describe('listReports', () => {
  it('devuelve [] si todavía no hay .perf/', async () => {
    expect(await listReports(dir)).toEqual([]);
    expect(await listReports(dir, { url: 'https://example.com/' })).toEqual([]);
  });

  it('lista todos los sitios de más antiguo a más reciente y filtra por url y device', async () => {
    const a = makeReport({ url: 'https://a.test/', createdAt: '2026-10-21T12:00:00Z' });
    const b = makeReport({ url: 'https://b.test/', createdAt: '2026-10-21T10:00:00Z' });
    const c = makeReport({
      url: 'https://a.test/',
      createdAt: '2026-10-21T11:00:00Z',
      device: 'desktop',
    });
    for (const r of [a, b, c]) await saveReport(dir, r);

    expect((await listReports(dir)).map((s) => s.report.id)).toEqual([b.id, c.id, a.id]);
    expect((await listReports(dir, { url: 'https://a.test/' })).map((s) => s.report.id)).toEqual([
      c.id,
      a.id,
    ]);
    expect(
      (await listReports(dir, { url: 'https://a.test/', device: 'mobile' })).map(
        (s) => s.report.id,
      ),
    ).toEqual([a.id]);
    expect((await listReports(dir, { device: 'desktop' })).map((s) => s.report.id)).toEqual([c.id]);
  });

  it('filtra por perfil de red', async () => {
    const base = makeReport({ createdAt: '2026-10-21T10:00:00Z' });
    const slow = makeReport({ createdAt: '2026-10-21T10:01:00Z', network: '3g' });
    for (const r of [base, slow]) await saveReport(dir, r);
    expect(slow.id).toMatch(/-mobile-3g$/);
    expect((await listReports(dir, { network: '3g' })).map((s) => s.report.id)).toEqual([slow.id]);
    expect((await listReports(dir, { network: 'default' })).map((s) => s.report.id)).toEqual([
      base.id,
    ]);
  });

  it('distingue páginas distintas del mismo host', async () => {
    const home = makeReport({ url: 'https://a.test/', createdAt: '2026-10-21T10:00:00Z' });
    const blog = makeReport({ url: 'https://a.test/blog', createdAt: '2026-10-21T11:00:00Z' });
    await saveReport(dir, home);
    await saveReport(dir, blog);
    const found = await listReports(dir, { url: 'https://a.test/blog' });
    expect(found.map((s) => s.report.id)).toEqual([blog.id]);
  });

  it('falla con un mensaje claro si un fichero no es un reporte válido', async () => {
    const path = await saveReport(dir, makeReport());
    await writeFile(path, '{"schemaVersion":2}');
    await expect(listReports(dir)).rejects.toThrow(RuntimeError);
  });
});

describe('resolveReport', () => {
  it('resuelve un id en cualquier sitio y una ruta (absoluta o relativa a baseDir)', async () => {
    const r = makeReport({ url: 'https://a.test/' });
    const path = await saveReport(dir, r);
    expect((await resolveReport(dir, r.id)).path).toBe(path);
    expect((await resolveReport(dir, path)).report).toEqual(r);
    expect(
      (await resolveReport(dir, join('.perf', 'reports', 'a.test', `${r.id}.json`))).path,
    ).toBe(path);
  });

  it('id inexistente o ruta inexistente: UsageError', async () => {
    await expect(resolveReport(dir, 'no-existe')).rejects.toThrow(UsageError);
    await expect(resolveReport(dir, 'no-existe.json')).rejects.toThrow(/No existe el fichero/);
  });

  it('un id repetido en varios sitios pide la ruta', async () => {
    await saveReport(dir, makeReport({ url: 'https://a.test/' }));
    const b = makeReport({ url: 'https://b.test/' });
    await saveReport(dir, b);
    await expect(resolveReport(dir, b.id)).rejects.toThrow(/varios sitios/);
  });
});
