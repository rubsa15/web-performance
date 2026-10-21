import { CommanderError } from 'commander';
import { describe, expect, it } from 'vitest';
import type { AuditDeps } from '../src/commands/audit.js';
import { buildProgram } from '../src/program.js';
import type { RunOptions } from '../src/runner.js';

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
