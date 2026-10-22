import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { diffCommand, snapshotCommand, type CheckDeps } from '../src/commands/check.js';
import { UsageError } from '../src/errors.js';
import type { PageSnapshot } from '../src/page-check.js';

const healthy: PageSnapshot = {
  url: 'http://127.0.0.1:4173/',
  title: 'Tostadero Atlas',
  text: 'Café de especialidad',
  images: [{ src: 'http://127.0.0.1:4173/img/hero.jpg', loaded: true }],
  consoleErrors: [],
  failedRequests: [],
  searchIndexLength: null,
};

let dir: string;
let out: string[];
let log: string[];

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'wperf-check-'));
  out = [];
  log = [];
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const deps = (snapshot?: CheckDeps['snapshot']): CheckDeps => ({
  snapshot: snapshot ?? (async () => healthy),
  out: (t) => out.push(t),
  log: (t) => log.push(t),
});

async function save(name: string, snapshot: unknown): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, JSON.stringify(snapshot));
  return path;
}

describe('snapshotCommand', () => {
  it('guarda la instantánea (creando la carpeta) y resume por stdout', async () => {
    const file = join(dir, 'nueva', 'antes.json');
    await snapshotCommand('http://127.0.0.1:4173/', file, {}, deps());
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(healthy);
    expect(out).toEqual([
      '1 imágenes, 0 errores de consola, 0 peticiones fallidas, índice: ausente',
    ]);
    expect(log.join('\n')).toContain('antes.json');
  });

  it('pasa la ruta de la captura al navegador', async () => {
    let received: string | undefined;
    const shot = join(dir, 'capturas', 'antes.png');
    await snapshotCommand(
      'http://127.0.0.1:4173/',
      join(dir, 'a.json'),
      { screenshot: shot },
      deps(async (_url, screenshotPath) => {
        received = screenshotPath;
        return healthy;
      }),
    );
    expect(received).toBe(shot);
  });

  it('rechaza una URL inválida y una captura que no es .png', async () => {
    await expect(snapshotCommand('nope', join(dir, 'a.json'), {}, deps())).rejects.toThrow(
      UsageError,
    );
    await expect(
      snapshotCommand('http://a.test/', join(dir, 'a.json'), { screenshot: 'x.jpg' }, deps()),
    ).rejects.toThrow(/\.png/);
  });
});

describe('diffCommand', () => {
  it('devuelve true si la página sigue íntegra', async () => {
    const a = await save('a.json', healthy);
    const b = await save('b.json', healthy);
    expect(await diffCommand(a, b, deps())).toBe(true);
    expect(out).toEqual(['La página sigue íntegra.']);
  });

  it('devuelve false y lista lo roto', async () => {
    const a = await save('a.json', healthy);
    const b = await save('b.json', { ...healthy, text: 'Café' });
    expect(await diffCommand(a, b, deps())).toBe(false);
    expect(out.join('\n')).toContain('texto visible');
  });

  it('da un error de uso si el fichero no existe, no es JSON o no es una instantánea', async () => {
    const ok = await save('ok.json', healthy);
    await expect(diffCommand(join(dir, 'no-existe.json'), ok, deps())).rejects.toThrow(/leer/);
    const notJson = join(dir, 'x.json');
    await writeFile(notJson, '{');
    await expect(diffCommand(notJson, ok, deps())).rejects.toThrow(/no es JSON/);
    const other = await save('otro.json', { id: 'un-reporte' });
    await expect(diffCommand(ok, other, deps())).rejects.toThrow(UsageError);
  });
});
