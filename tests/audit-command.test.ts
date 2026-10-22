import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  auditCommand,
  parseUrl,
  type AuditDeps,
  type AuditOptions,
} from '../src/commands/audit.js';
import { RuntimeError, UsageError } from '../src/errors.js';
import { ReportSchema } from '../src/schema.js';
import { readReport } from '../src/store.js';
import { loadLhr } from './helpers.js';

let dir: string;
let out: string[];
let log: string[];

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'wperf-audit-'));
  out = [];
  log = [];
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const options: AuditOptions = {
  device: ['mobile'],
  network: ['default'],
  runs: 2,
  save: true,
  keepRaw: false,
  format: 'json',
};

function deps(overrides: Partial<AuditDeps> = {}): AuditDeps {
  return {
    run: async (opts) => {
      for (let i = 1; i <= opts.runs; i++) opts.onProgress?.(i, opts.runs);
      const fixture = opts.device === 'desktop' ? 'lhr-wikipedia-desktop' : 'lhr-bbc-mobile';
      return Array.from({ length: opts.runs }, () => loadLhr(fixture));
    },
    git: async () => ({ commit: 'abc1234', dirty: false }),
    now: () => new Date('2026-10-21T10:32:00Z'),
    baseDir: dir,
    out: (text) => out.push(text),
    log: (text) => log.push(text),
    color: false,
    ...overrides,
  };
}

describe('auditCommand', () => {
  it('audita, guarda el reporte y escribe solo el JSON en stdout', async () => {
    await auditCommand('https://www.bbc.com/news', { ...options, label: 'prueba' }, deps());

    const saved = join(dir, '.perf', 'reports', 'www.bbc.com', '2026-10-21T10-32-00Z-mobile.json');
    const stored = await readReport(saved);
    expect(stored).toMatchObject({ label: 'prueba', git: { commit: 'abc1234', dirty: false } });
    expect(stored.environment.runs).toBe(2);

    expect(out).toHaveLength(1);
    expect(ReportSchema.parse(JSON.parse(out[0]!))).toEqual(stored);
    expect(log.join('\n')).toContain('ejecución 2/2');
    expect(log.join('\n')).toContain(`Reporte guardado en ${saved}`);
  });

  it('con --no-save no escribe nada en disco', async () => {
    await auditCommand('https://www.bbc.com/news', { ...options, save: false }, deps());
    expect(await readdir(dir)).toEqual([]);
    expect(out).toHaveLength(1);
  });

  it('con --keep-raw guarda un LHR por ejecución', async () => {
    await auditCommand('https://www.bbc.com/news', { ...options, keepRaw: true }, deps());
    expect(await readdir(join(dir, '.perf', 'raw', 'www.bbc.com'))).toHaveLength(2);
  });

  it('respeta el formato de salida', async () => {
    await auditCommand('https://www.bbc.com/news', { ...options, format: 'md' }, deps());
    expect(out[0]).toMatch(/^# Auditoría de rendimiento/);
  });

  it('sigue funcionando fuera de un repositorio git', async () => {
    await auditCommand('https://www.bbc.com/news', options, deps({ git: async () => undefined }));
    expect(JSON.parse(out[0]!)).not.toHaveProperty('git');
  });

  it('no guarda nada si la ejecución falla', async () => {
    const failing = deps({
      run: async () => {
        throw new RuntimeError('Chrome no arranca');
      },
    });
    await expect(auditCommand('https://www.bbc.com/news', options, failing)).rejects.toThrow(
      'Chrome no arranca',
    );
    expect(await readdir(dir)).toEqual([]);
    expect(out).toEqual([]);
  });

  it('rechaza una URL inválida antes de lanzar Chrome', async () => {
    let launched = false;
    const spy = deps({
      run: async () => {
        launched = true;
        return [];
      },
    });
    await expect(auditCommand('bbc.com', options, spy)).rejects.toThrow(UsageError);
    expect(launched).toBe(false);
  });
});

describe('auditCommand con varios perfiles', () => {
  const multi: AuditOptions = {
    ...options,
    device: ['mobile', 'desktop'],
    network: ['default', '3g'],
  };

  it('audita cada dispositivo × red en serie, en el orden dado, y escribe un array JSON', async () => {
    const launched: string[] = [];
    let running = 0;
    const base = deps();
    await auditCommand(
      'https://www.bbc.com/news',
      multi,
      deps({
        run: async (opts) => {
          running++;
          expect(running).toBe(1);
          launched.push(`${opts.device}/${opts.network}`);
          await new Promise((resolve) => setTimeout(resolve, 1));
          const lhrs = await base.run(opts);
          running--;
          return lhrs;
        },
      }),
    );

    expect(launched).toEqual(['mobile/default', 'mobile/3g', 'desktop/default', 'desktop/3g']);
    expect(out).toHaveLength(1);
    const reports = (JSON.parse(out[0]!) as unknown[]).map((r) => ReportSchema.parse(r));
    expect(reports.map((r) => `${r.device}/${r.environment.network ?? 'default'}`)).toEqual(
      launched,
    );
    expect(await readdir(join(dir, '.perf', 'reports', 'www.bbc.com'))).toHaveLength(4);
  });

  it('pone el perfil delante de cada línea de progreso y cierra con un resumen', async () => {
    await auditCommand('https://www.bbc.com/news', multi, deps());
    expect(log).toContain('[mobile/3g] ejecución 2/2');
    expect(log.some((l) => l.startsWith('[desktop/default] Reporte guardado en '))).toBe(true);
    expect(log.at(-1)).toBe('Terminado: 4 de 4 perfiles medidos.');
  });

  it('si un perfil falla sigue con los demás, escribe los medidos y termina con error', async () => {
    const base = deps();
    const failing = deps({
      run: async (opts) => {
        if (opts.device === 'mobile' && opts.network === '3g') {
          throw new RuntimeError('Chrome no arranca');
        }
        return base.run(opts);
      },
    });

    await expect(auditCommand('https://www.bbc.com/news', multi, failing)).rejects.toThrow(
      new RuntimeError('Fallaron 1 de 4 perfiles: mobile/3g.'),
    );
    expect(log).toContain('[mobile/3g] Error: Chrome no arranca');
    expect(log.at(-1)).toBe('Terminado: 3 de 4 perfiles medidos; fallaron mobile/3g.');
    expect(JSON.parse(out[0]!)).toHaveLength(3);
  });

  it('si fallan todos no escribe nada en stdout', async () => {
    const failing = deps({
      run: async () => {
        throw new RuntimeError('Chrome no arranca');
      },
    });
    await expect(auditCommand('https://www.bbc.com/news', multi, failing)).rejects.toThrow(
      'Fallaron 4 de 4 perfiles',
    );
    expect(out).toEqual([]);
  });

  it('en texto escribe un resumen por perfil', async () => {
    await auditCommand(
      'https://www.bbc.com/news',
      { ...multi, device: ['mobile'], format: 'text' },
      deps(),
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.match(/^Puntuación: /gm)).toHaveLength(2);
  });
});

describe('parseUrl', () => {
  it('acepta http y https, también en localhost', () => {
    expect(parseUrl('https://example.com')).toBe('https://example.com/');
    expect(parseUrl('http://localhost:3000/demo')).toBe('http://localhost:3000/demo');
  });

  it.each(['example.com', 'ftp://example.com', 'file:///etc/hosts', ''])('rechaza %j', (input) => {
    expect(() => parseUrl(input)).toThrow(UsageError);
  });
});
