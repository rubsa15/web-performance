import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { compareCommand } from '../src/commands/compare.js';
import { historyCommand } from '../src/commands/history.js';
import type { ReadDeps } from '../src/commands/read-deps.js';
import { UsageError } from '../src/errors.js';
import { saveReport } from '../src/store.js';
import { makeReport, type ReportChanges } from './helpers.js';

let dir: string;
let out: string[];
let log: string[];

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'wperf-compare-'));
  out = [];
  log = [];
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const deps = (): ReadDeps => ({
  baseDir: dir,
  out: (t) => out.push(t),
  log: (t) => log.push(t),
  color: false,
});

const m = (value: number, min = value, max = value) => ({ value, min, max });
const URL_A = 'https://a.test/';

async function save(changes: ReportChanges) {
  const report = makeReport(changes);
  await saveReport(dir, report);
  return report;
}

describe('compareCommand', () => {
  it('con dos ids compara antes → después y deja stdout solo con el resultado', async () => {
    const a = await save({ createdAt: '2026-10-21T10:00:00Z', score: 40 });
    const b = await save({ createdAt: '2026-10-21T11:00:00Z', score: 90 });
    await compareCommand(a.id, b.id, { format: 'json' }, deps());
    expect(out).toHaveLength(1);
    expect(JSON.parse(out[0]!)).toMatchObject({
      before: { id: a.id },
      after: { id: b.id },
      score: { before: 40, after: 90, change: 'improved' },
    });
    expect(log.join('\n')).toContain('Antes:');
  });

  it('sin argumentos compara los dos últimos del sitio más reciente, mismo perfil', async () => {
    await save({ url: 'https://old.test/', createdAt: '2026-10-21T08:00:00Z' });
    const first = await save({ url: URL_A, createdAt: '2026-10-21T10:00:00Z' });
    await save({ url: URL_A, createdAt: '2026-10-21T10:30:00Z', device: 'desktop' });
    const last = await save({ url: URL_A, createdAt: '2026-10-21T11:00:00Z' });
    await save({ url: 'https://other.test/', createdAt: '2026-10-21T12:00:00Z' });
    // el último reporte guardado es de other.test/: solo tiene uno
    await expect(compareCommand(undefined, undefined, { format: 'json' }, deps())).rejects.toThrow(
      /Solo hay una auditoría de https:\/\/other\.test\//,
    );

    await compareCommand(undefined, undefined, { url: URL_A, format: 'json' }, deps());
    expect(JSON.parse(out[0]!)).toMatchObject({ before: { id: first.id }, after: { id: last.id } });
  });

  it('sin argumentos y sin --url usa la URL del último reporte', async () => {
    const a = await save({ url: URL_A, createdAt: '2026-10-21T10:00:00Z' });
    const b = await save({ url: URL_A, createdAt: '2026-10-21T11:00:00Z' });
    await compareCommand(undefined, undefined, { format: 'json' }, deps());
    expect(JSON.parse(out[0]!)).toMatchObject({ before: { id: a.id }, after: { id: b.id } });
  });

  it('respeta el formato md y text', async () => {
    const a = await save({ createdAt: '2026-10-21T10:00:00Z', metrics: { lcp: m(4000) } });
    const b = await save({ createdAt: '2026-10-21T11:00:00Z', metrics: { lcp: m(2000) } });
    await compareCommand(a.id, b.id, { format: 'md' }, deps());
    await compareCommand(a.id, b.id, { format: 'text' }, deps());
    expect(out[0]).toMatch(/^# Comparación de rendimiento/);
    expect(out[1]).toMatch(/^Comparación de rendimiento — /);
  });

  it.each([
    ['solo una referencia', ['x', undefined], {}, /dos reportes/],
    ['--url con referencias', ['x', 'y'], { url: URL_A }, /--url solo se usa/],
  ] as const)('UsageError: %s', async (_name, [a, b], extra, message) => {
    await expect(compareCommand(a, b, { format: 'json', ...extra }, deps())).rejects.toThrow(
      message,
    );
  });

  it('sin auditorías guardadas pide ejecutar wperf audit', async () => {
    await expect(compareCommand(undefined, undefined, { format: 'text' }, deps())).rejects.toThrow(
      UsageError,
    );
    await expect(
      compareCommand(undefined, undefined, { url: URL_A, format: 'text' }, deps()),
    ).rejects.toThrow(/wperf audit https:\/\/a\.test\//);
  });

  it('propaga el error de comparabilidad (device distinto)', async () => {
    const a = await save({ createdAt: '2026-10-21T10:00:00Z' });
    const b = await save({ createdAt: '2026-10-21T11:00:00Z', device: 'desktop' });
    await expect(compareCommand(a.id, b.id, { format: 'json' }, deps())).rejects.toThrow(
      /dispositivos distintos/,
    );
    expect(out).toEqual([]);
  });
});

describe('historyCommand', () => {
  it('lista las auditorías de la URL y sus cambios', async () => {
    await save({ url: URL_A, createdAt: '2026-10-21T10:00:00Z', metrics: { lcp: m(4000) } });
    await save({ url: URL_A, createdAt: '2026-10-21T11:00:00Z', metrics: { lcp: m(2000) } });
    await save({ url: 'https://b.test/', createdAt: '2026-10-21T12:00:00Z' });

    await historyCommand(URL_A, { format: 'json' }, deps());
    const history = JSON.parse(out[0]!);
    expect(history.url).toBe(URL_A);
    expect(history.entries).toHaveLength(2);
    expect(history.entries[1].vsPrevious.metrics.lcp.change).toBe('improved');
  });

  it('filtra por device y falla si no queda ninguna', async () => {
    await save({ url: URL_A, createdAt: '2026-10-21T10:00:00Z' });
    await expect(
      historyCommand(URL_A, { device: 'desktop', format: 'json' }, deps()),
    ).rejects.toThrow(/\(desktop\)/);
  });

  it('URL sin auditorías: UsageError; URL inválida: UsageError', async () => {
    await expect(historyCommand(URL_A, { format: 'text' }, deps())).rejects.toThrow(UsageError);
    await expect(historyCommand('a.test', { format: 'text' }, deps())).rejects.toThrow(UsageError);
  });

  it('con --metric centra la salida en esa métrica', async () => {
    await save({
      url: URL_A,
      createdAt: '2026-10-21T10:00:00Z',
      metrics: { tbt: m(600, 500, 700) },
    });
    await save({ url: URL_A, createdAt: '2026-10-21T11:00:00Z', metrics: { tbt: m(50, 40, 60) } });
    await historyCommand(URL_A, { metric: 'tbt', format: 'text' }, deps());
    expect(out[0]).toContain('TBT');
    expect(out[0]).toContain('Evolución de TBT: █▁');
    expect(out[0]).toMatch(/-550 ms ↓/);
  });
});
