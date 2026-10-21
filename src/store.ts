import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { RuntimeError, UsageError } from './errors.js';
import { networkOf, ReportSchema, type Device, type Network, type Report } from './schema.js';

export const PERF_DIR = '.perf';

/** Nombre de carpeta estable para una URL: `host` o `host-puerto` (p. ej. `localhost-3000`). */
export function siteSlug(url: string): string {
  const { hostname, port } = new URL(url);
  return (port ? `${hostname}-${port}` : hostname).replace(/[^a-zA-Z0-9.-]/g, '-');
}

export function reportPath(baseDir: string, report: Pick<Report, 'url' | 'id'>): string {
  return join(baseDir, PERF_DIR, 'reports', siteSlug(report.url), `${report.id}.json`);
}

async function writeNew(path: string, content: string): Promise<void> {
  try {
    await writeFile(path, content, { flag: 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new RuntimeError(`Ya existe ${path}; espera un segundo y repite la auditoría.`);
    }
    throw error;
  }
}

/** Guarda el reporte en `<baseDir>/.perf/reports/<sitio>/<id>.json` y devuelve la ruta. */
export async function saveReport(baseDir: string, report: Report): Promise<string> {
  const path = reportPath(baseDir, report);
  await mkdir(join(path, '..'), { recursive: true });
  await writeNew(path, `${JSON.stringify(report, null, 2)}\n`);
  return path;
}

/** Lee un reporte y lo valida contra el esquema. */
export async function readReport(path: string): Promise<Report> {
  const parsed = ReportSchema.safeParse(JSON.parse(await readFile(path, 'utf8')));
  if (!parsed.success) {
    throw new RuntimeError(`${path} no es un reporte válido:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

/** Guarda los LHR crudos de cada ejecución en `.perf/raw/<sitio>/<id>-run<N>.json`. */
export async function saveRawLhrs(
  baseDir: string,
  report: Report,
  lhrs: unknown[],
): Promise<string[]> {
  const dir = join(baseDir, PERF_DIR, 'raw', siteSlug(report.url));
  await mkdir(dir, { recursive: true });
  return Promise.all(
    lhrs.map(async (lhr, i) => {
      const path = join(dir, `${report.id}-run${i + 1}.json`);
      await writeNew(path, JSON.stringify(lhr));
      return path;
    }),
  );
}

export interface StoredReport {
  path: string;
  report: Report;
}

const reportsDir = (baseDir: string): string => join(baseDir, PERF_DIR, 'reports');

async function readdirOrEmpty(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

/**
 * Reportes guardados en `<baseDir>/.perf/reports/`, de más antiguo a más reciente.
 * `url` filtra por URL exacta, `device` por dispositivo y `network` por perfil de red.
 */
export async function listReports(
  baseDir: string,
  filter: { url?: string; device?: Device; network?: Network } = {},
): Promise<StoredReport[]> {
  const root = reportsDir(baseDir);
  const sites = filter.url ? [siteSlug(filter.url)] : await readdirOrEmpty(root);
  const paths = (
    await Promise.all(
      sites.map(async (site) =>
        (await readdirOrEmpty(join(root, site)))
          .filter((name) => name.endsWith('.json'))
          .map((name) => join(root, site, name)),
      ),
    )
  ).flat();

  const stored = await Promise.all(
    paths.map(async (path) => ({ path, report: await readReport(path) })),
  );
  return stored
    .filter(
      ({ report }) =>
        (filter.url === undefined || report.url === filter.url) &&
        (filter.device === undefined || report.device === filter.device) &&
        (filter.network === undefined || networkOf(report) === filter.network),
    )
    .sort(
      (a, b) =>
        a.report.createdAt.localeCompare(b.report.createdAt) ||
        a.report.id.localeCompare(b.report.id),
    );
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/**
 * Resuelve una referencia a un reporte: ruta a un `.json` (relativa a `baseDir`) o id
 * (`2026-10-19T10-32-00Z-mobile`), que se busca en todos los sitios guardados.
 */
export async function resolveReport(baseDir: string, ref: string): Promise<StoredReport> {
  const asPath = resolve(baseDir, ref);
  if (await isFile(asPath)) return { path: asPath, report: await readReport(asPath) };
  if (ref.endsWith('.json') || ref.includes('/')) {
    throw new UsageError(`No existe el fichero ${asPath}.`);
  }

  const root = reportsDir(baseDir);
  const matches: string[] = [];
  for (const site of await readdirOrEmpty(root)) {
    const candidate = join(root, site, `${ref}.json`);
    if (await isFile(candidate)) matches.push(candidate);
  }
  if (matches.length === 0) {
    throw new UsageError(`No hay ningún reporte con id "${ref}" en ${root}.`);
  }
  if (matches.length > 1) {
    throw new UsageError(
      `El id "${ref}" existe en varios sitios; indica la ruta:\n${matches.map((m) => `  ${m}`).join('\n')}`,
    );
  }
  return { path: matches[0] as string, report: await readReport(matches[0] as string) };
}
