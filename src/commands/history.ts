import { UsageError } from '../errors.js';
import { buildHistory } from '../history.js';
import type { Format } from '../render.js';
import { renderHistory } from '../render-compare.js';
import type { Device, MetricId, Network } from '../schema.js';
import { listReports } from '../store.js';
import { parseUrl } from './audit.js';
import { defaultReadDeps, type ReadDeps } from './read-deps.js';

export interface HistoryOptions {
  device?: Device;
  network?: Network;
  metric?: MetricId;
  format: Format;
}

export async function historyCommand(
  urlArg: string,
  options: HistoryOptions,
  deps: ReadDeps = defaultReadDeps(),
): Promise<void> {
  const url = parseUrl(urlArg);
  const stored = await listReports(deps.baseDir, {
    url,
    ...(options.device && { device: options.device }),
    ...(options.network && { network: options.network }),
  });
  if (stored.length === 0) {
    throw new UsageError(
      `No hay auditorías guardadas de ${url}${options.device ? ` (${options.device})` : ''}. Ejecuta "wperf audit ${url}" primero.`,
    );
  }
  deps.out(
    renderHistory(
      buildHistory(
        url,
        stored.map((s) => s.report),
      ),
      options.format,
      options.metric,
      { color: deps.color },
    ),
  );
}
