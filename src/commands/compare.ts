import { compareReports } from '../compare.js';
import { UsageError } from '../errors.js';
import type { Format } from '../render.js';
import { renderComparison } from '../render-compare.js';
import { networkOf } from '../schema.js';
import { listReports, resolveReport, type StoredReport } from '../store.js';
import { parseUrl } from './audit.js';
import { defaultReadDeps, type ReadDeps } from './read-deps.js';

export interface CompareOptions {
  url?: string;
  format: Format;
}

/**
 * Sin referencias: el último reporte guardado (de `--url` si se indica, o de cualquier sitio)
 * contra el anterior de la misma URL y el mismo perfil.
 */
async function latestPair(
  baseDir: string,
  urlArg: string | undefined,
): Promise<[StoredReport, StoredReport]> {
  const url = urlArg === undefined ? undefined : parseUrl(urlArg);
  const all = await listReports(baseDir, url === undefined ? {} : { url });
  const latest = all.at(-1);
  if (!latest) {
    throw new UsageError(
      url
        ? `No hay auditorías guardadas de ${url}. Ejecuta "wperf audit ${url}" primero.`
        : 'No hay auditorías guardadas en .perf/reports/. Ejecuta "wperf audit <url>" primero.',
    );
  }

  const { url: latestUrl, device, environment } = latest.report;
  const network = networkOf(latest.report);
  const sameProfile = all.filter(
    (s) =>
      s.report.url === latestUrl &&
      s.report.device === device &&
      networkOf(s.report) === network &&
      s.report.environment.throttling === environment.throttling,
  );
  const previous = sameProfile.at(-2);
  if (!previous) {
    throw new UsageError(
      `Solo hay una auditoría de ${latestUrl} (${device}${network === 'default' ? '' : `, red ${network}`}): haz otra con "wperf audit" o pasa dos reportes a "wperf compare".`,
    );
  }
  return [previous, latest];
}

export async function compareCommand(
  refA: string | undefined,
  refB: string | undefined,
  options: CompareOptions,
  deps: ReadDeps = defaultReadDeps(),
): Promise<void> {
  if ((refA === undefined) !== (refB === undefined)) {
    throw new UsageError(
      'Indica dos reportes (antes y después) o ninguno para comparar los dos últimos.',
    );
  }
  if (refA !== undefined && options.url !== undefined) {
    throw new UsageError('--url solo se usa sin reportes explícitos.');
  }

  const [before, after] =
    refA !== undefined && refB !== undefined
      ? await Promise.all([resolveReport(deps.baseDir, refA), resolveReport(deps.baseDir, refB)])
      : await latestPair(deps.baseDir, options.url);

  deps.log(`Antes:   ${before.path}`);
  deps.log(`Después: ${after.path}`);
  deps.out(
    renderComparison(compareReports(before.report, after.report), options.format, {
      color: deps.color,
    }),
  );
}
