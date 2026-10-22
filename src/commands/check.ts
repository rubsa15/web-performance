import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { UsageError } from '../errors.js';
import {
  PageSnapshotSchema,
  pageRegressions,
  takeSnapshot,
  type PageSnapshot,
} from '../page-check.js';
import { parseUrl } from './audit.js';

export interface SnapshotOptions {
  screenshot?: string;
}

export interface CheckDeps {
  snapshot: typeof takeSnapshot;
  /** Salida del resultado (stdout). */
  out: (text: string) => void;
  /** Progreso (stderr). */
  log: (text: string) => void;
}

export function defaultCheckDeps(): CheckDeps {
  return {
    snapshot: takeSnapshot,
    out: (text) => process.stdout.write(`${text}\n`),
    log: (text) => process.stderr.write(`${text}\n`),
  };
}

async function writeCreatingDir(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

async function loadSnapshot(path: string): Promise<PageSnapshot> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    throw new UsageError(`No se puede leer la instantánea "${path}".`);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new UsageError(`"${path}" no es JSON. Genera la instantánea con "wperf check snapshot".`);
  }
  const parsed = PageSnapshotSchema.safeParse(json);
  if (!parsed.success) {
    throw new UsageError(
      `"${path}" no es una instantánea de "wperf check snapshot" (formato inesperado).`,
    );
  }
  return parsed.data;
}

/** Abre la URL, guarda la instantánea en `file` y, si se pide, una captura a página completa. */
export async function snapshotCommand(
  urlArg: string,
  file: string,
  options: SnapshotOptions,
  deps: CheckDeps = defaultCheckDeps(),
): Promise<void> {
  const url = parseUrl(urlArg);
  if (options.screenshot && !options.screenshot.endsWith('.png')) {
    throw new UsageError('--screenshot debe ser un fichero .png.');
  }
  deps.log(`Abriendo ${url}…`);
  if (options.screenshot) await mkdir(dirname(options.screenshot), { recursive: true });
  const snapshot = await deps.snapshot(url, options.screenshot);
  await writeCreatingDir(file, `${JSON.stringify(snapshot, null, 2)}\n`);
  deps.log(`Instantánea guardada en ${file}`);
  deps.out(
    `${snapshot.images.length} imágenes, ${snapshot.consoleErrors.length} errores de consola, ` +
      `${snapshot.failedRequests.length} peticiones fallidas, índice: ${snapshot.searchIndexLength ?? 'ausente'}`,
  );
}

/** Compara dos instantáneas. Devuelve `false` si la página dejó de estar íntegra. */
export async function diffCommand(
  beforePath: string,
  afterPath: string,
  deps: CheckDeps = defaultCheckDeps(),
): Promise<boolean> {
  const problems = pageRegressions(await loadSnapshot(beforePath), await loadSnapshot(afterPath));
  deps.out(problems.length === 0 ? 'La página sigue íntegra.' : problems.join('\n'));
  return problems.length === 0;
}
