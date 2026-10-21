import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RuntimeError } from './errors.js';
import { ReportSchema, type Report } from './schema.js';
import { z } from 'zod';

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
