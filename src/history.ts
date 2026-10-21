import {
  classifyMetric,
  classifyScore,
  DEFAULT_THRESHOLDS,
  type Change,
  type Thresholds,
} from './rules.js';
import { METRIC_IDS, networkOf, type Metric, type MetricId, type Report } from './schema.js';

export interface HistoryEntry {
  id: string;
  createdAt: string;
  device: Report['device'];
  network: Report['environment']['network'] & string;
  label?: string;
  git?: Report['git'];
  runs: number;
  score: number;
  metrics: Record<MetricId, Metric>;
  /** Cambio respecto al reporte comparable anterior (mismo device, red y throttling); ausente en el primero. */
  vsPrevious?: {
    id: string;
    score: Delta;
    metrics: Record<MetricId, Delta>;
  };
}

export interface Delta {
  delta: number;
  change: Change;
}

export interface History {
  url: string;
  entries: HistoryEntry[];
}

/** Evolución de una URL: un reporte por entrada, de más antiguo a más reciente. */
export function buildHistory(
  url: string,
  reports: Report[],
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): History {
  const sorted = [...reports].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  const lastByProfile = new Map<string, Report>();

  const entries = sorted.map((report): HistoryEntry => {
    const profile = `${report.device}|${networkOf(report)}|${report.environment.throttling}`;
    const previous = lastByProfile.get(profile);
    lastByProfile.set(profile, report);
    return {
      id: report.id,
      createdAt: report.createdAt,
      device: report.device,
      network: networkOf(report),
      ...(report.label !== undefined && { label: report.label }),
      ...(report.git && { git: report.git }),
      runs: report.environment.runs,
      score: report.score,
      metrics: report.metrics,
      ...(previous && {
        vsPrevious: {
          id: previous.id,
          score: {
            delta: report.score - previous.score,
            change: classifyScore(previous.score, report.score, thresholds),
          },
          metrics: Object.fromEntries(
            METRIC_IDS.map((id) => {
              const [b, a] = [previous.metrics[id], report.metrics[id]];
              return [
                id,
                {
                  delta: Math.round((a.value - b.value) * 1000) / 1000,
                  change: classifyMetric(id, b, a, thresholds),
                },
              ];
            }),
          ) as Record<MetricId, Delta>,
        },
      }),
    };
  });
  return { url, entries };
}
