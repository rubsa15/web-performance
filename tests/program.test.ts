import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CommanderError } from 'commander';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AuditDeps } from '../src/commands/audit.js';
import type { ReadDeps } from '../src/commands/read-deps.js';
import { UsageError } from '../src/errors.js';
import { buildProgram } from '../src/program.js';
import type { RunOptions } from '../src/runner.js';
import { saveReport } from '../src/store.js';
import { makeReport } from './helpers.js';

describe('buildProgram', () => {
  it('se llama wperf y describe su propósito en la ayuda', () => {
    const help = buildProgram().helpInformation();
    expect(help).toContain('Usage: wperf');
    expect(help).toContain('Audita el rendimiento');
  });
});

describe('wperf audit', () => {
  const STOP = new Error('stop');

  /** Parsea los argumentos y devuelve las opciones con las que se habría lanzado el runner. */
  async function parse(args: string[]): Promise<RunOptions> {
    let received: RunOptions | undefined;
    const deps = {
      run: async (options: RunOptions) => {
        received = options;
        throw STOP;
      },
      log: () => {},
    } as unknown as AuditDeps;
    const program = buildProgram(deps);
    program.commands.forEach((c) =>
      c.configureOutput({ writeErr: () => {}, outputError: () => {} }),
    );
    await expect(program.parseAsync(['node', 'wperf', 'audit', ...args])).rejects.toBe(STOP);
    return received!;
  }

  async function usageError(args: string[]): Promise<void> {
    const program = buildProgram();
    program.commands.forEach((c) =>
      c.configureOutput({ writeErr: () => {}, outputError: () => {} }),
    );
    await expect(program.parseAsync(['node', 'wperf', 'audit', ...args])).rejects.toBeInstanceOf(
      CommanderError,
    );
  }

  it('usa mobile y 3 ejecuciones por defecto', async () => {
    const options = await parse(['https://example.com']);
    expect(options).toMatchObject({ url: 'https://example.com/', device: 'mobile', runs: 3 });
  });

  it('lee --device y --runs', async () => {
    const options = await parse(['https://example.com', '--device', 'desktop', '--runs', '5']);
    expect(options).toMatchObject({ device: 'desktop', runs: 5 });
  });

  it.each([
    ['--runs 0', ['--runs', '0']],
    ['--runs no numérico', ['--runs', 'abc']],
    ['--runs decimal', ['--runs', '2.5']],
    ['--device desconocido', ['--device', 'tablet']],
    ['--format desconocido', ['--format', 'html']],
    ['--keep-raw con --no-save', ['--no-save', '--keep-raw']],
  ])('rechaza %s como error de uso', async (_name, flags) => {
    await usageError(['https://example.com', ...flags]);
  });

  it('exige la URL', async () => {
    await usageError([]);
  });
});

describe('wperf compare / history', () => {
  let dir: string;
  let out: string[];

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'wperf-program-'));
    out = [];
    await saveReport(dir, makeReport({ createdAt: '2026-10-21T10:00:00Z', score: 40 }));
    await saveReport(dir, makeReport({ createdAt: '2026-10-21T11:00:00Z', score: 90 }));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  const readDeps: ReadDeps = {
    get baseDir() {
      return dir;
    },
    out: (t) => out.push(t),
    log: () => {},
    color: false,
  };

  function program() {
    const p = buildProgram(undefined, readDeps);
    p.commands.forEach((c) => c.configureOutput({ writeErr: () => {}, outputError: () => {} }));
    return p;
  }
  const run = (...args: string[]) => program().parseAsync(['node', 'wperf', ...args]);

  it('compare sin argumentos compara los dos últimos; el formato por defecto es text', async () => {
    await run('compare');
    expect(out[0]).toContain('Comparación de rendimiento — improved');
    expect(out[0]).toContain('Puntuación: 40 → 90');
  });

  it('compare acepta --url y --format', async () => {
    await run('compare', '--url', 'https://example.com/', '--format', 'json');
    expect(JSON.parse(out[0]!).score.after).toBe(90);
  });

  it('history acepta --device, --metric y --format', async () => {
    await run(
      'history',
      'https://example.com/',
      '--device',
      'mobile',
      '--metric',
      'lcp',
      '--format',
      'md',
    );
    expect(out[0]).toContain('| ID | LCP |');
  });

  it('compare con una sola referencia es un error de uso', async () => {
    await expect(run('compare', 'solo-una')).rejects.toBeInstanceOf(UsageError);
  });

  it.each([
    ['history sin URL', ['history']],
    ['history con --metric desconocida', ['history', 'https://example.com/', '--metric', 'fid']],
    ['history con --device desconocido', ['history', 'https://example.com/', '--device', 'tablet']],
    ['compare con --format desconocido', ['compare', '--format', 'html']],
  ])('%s: error de uso', async (_name, args) => {
    await expect(run(...args)).rejects.toBeInstanceOf(CommanderError);
  });
});
