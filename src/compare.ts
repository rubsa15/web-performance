import { UsageError } from './errors.js';
import {
  classifyMetric,
  classifyScore,
  DEFAULT_THRESHOLDS,
  exceeds,
  type Change,
  type Thresholds,
} from './rules.js';
import {
  METRIC_IDS,
  networkOf,
  type Impact,
  type MetricId,
  type Network,
  type Opportunity,
  type Rating,
  type Report,
} from './schema.js';

export type OpportunityStatus = 'new' | 'resolved' | 'better' | 'worse' | 'same';
export type Verdict = Change | 'mixed';

export interface ReportRef {
  id: string;
  url: string;
  device: Report['device'];
  network: Network;
  createdAt: string;
  runs: number;
  label?: string;
  git?: Report['git'];
}

export interface MetricDiff {
  unit: 'ms' | '';
  before: number;
  after: number;
  delta: number;
  /** Variación relativa respecto a `before`; `null` si `before` es 0. */
  deltaPct: number | null;
  change: Change;
  ratingBefore: Rating;
  ratingAfter: Rating;
}

export interface OpportunitySide {
  savingsMs: number;
  savingsBytes: number;
  impact: Impact;
}

export interface OpportunityDiff {
  id: string;
  title: string;
  status: OpportunityStatus;
  before?: OpportunitySide;
  after?: OpportunitySide;
  /** `after - before`; el lado ausente cuenta como 0. */
  deltaMs: number;
  deltaBytes: number;
}

export interface ResourceDiff {
  /** Tipo de recurso, o `total`. */
  type: string;
  before: number;
  after: number;
  delta: number;
}

export interface Comparison {
  before: ReportRef;
  after: ReportRef;
  warnings: string[];
  verdict: Verdict;
  score: { before: number; after: number; delta: number; change: Change };
  metrics: Record<MetricId, MetricDiff>;
  opportunities: OpportunityDiff[];
  resources: ResourceDiff[];
}

function refOf(report: Report): ReportRef {
  return {
    id: report.id,
    url: report.url,
    device: report.device,
    network: networkOf(report),
    createdAt: report.createdAt,
    runs: report.environment.runs,
    ...(report.label !== undefined && { label: report.label }),
    ...(report.git && { git: report.git }),
  };
}

/** SPEC §6: no se comparan reportes con distinto `device`, `throttling` o perfil de red. */
function assertComparable(before: Report, after: Report): void {
  if (before.device !== after.device) {
    throw new UsageError(
      `No se pueden comparar reportes de dispositivos distintos (${before.device} vs ${after.device}).`,
    );
  }
  if (networkOf(before) !== networkOf(after)) {
    throw new UsageError(
      `No se pueden comparar reportes con distinto perfil de red (${networkOf(before)} vs ${networkOf(after)}).`,
    );
  }
  if (before.environment.throttling !== after.environment.throttling) {
    throw new UsageError(
      `No se pueden comparar reportes con distinto throttling (${before.environment.throttling} vs ${after.environment.throttling}).`,
    );
  }
}

function comparisonWarnings(before: Report, after: Report): string[] {
  const warnings: string[] = [];
  if (before.createdAt > after.createdAt) {
    warnings.push(
      'El primer reporte es posterior al segundo: "antes" y "después" pueden estar invertidos.',
    );
  }
  if (before.url !== after.url) {
    warnings.push(`Las URLs son distintas (${before.url} vs ${after.url}).`);
  }
  const { lighthouseVersion: lhA, chromeVersion: chA } = before.environment;
  const { lighthouseVersion: lhB, chromeVersion: chB } = after.environment;
  if (lhA !== lhB) {
    warnings.push(
      `Versiones de Lighthouse distintas (${lhA} vs ${lhB}): la puntuación puede no ser comparable.`,
    );
  }
  if (chA.split('.')[0] !== chB.split('.')[0]) {
    warnings.push(`Versiones de Chrome distintas (${chA} vs ${chB}).`);
  }
  if (before.environment.runs === 1 || after.environment.runs === 1) {
    warnings.push(
      'Algún reporte tiene una sola ejecución: sin rango min–max no se puede filtrar el ruido, solo el umbral.',
    );
  }
  return warnings;
}

function sideOf(op: Opportunity): OpportunitySide {
  return { savingsMs: op.savingsMs, savingsBytes: op.savingsBytes, impact: op.impact };
}

/** Si el ahorro de una oportunidad presente en ambos reportes ha subido (worse) o bajado (better). */
function classifyOpportunity(
  before: Opportunity,
  after: Opportunity,
  thresholds: Thresholds,
): 'better' | 'worse' | 'same' {
  const direction = (b: number, a: number, key: 'ms' | 'bytes'): number =>
    exceeds(b, a, thresholds.opportunity[key]) ? Math.sign(a - b) : 0;
  const ms = direction(before.savingsMs, after.savingsMs, 'ms');
  const bytes = direction(before.savingsBytes, after.savingsBytes, 'bytes');
  // Si ambas dimensiones se contradicen, manda el tiempo.
  const sign = ms !== 0 ? ms : bytes;
  if (sign === 0) return 'same';
  return sign > 0 ? 'worse' : 'better';
}

const STATUS_ORDER: Record<OpportunityStatus, number> = {
  new: 0,
  worse: 1,
  resolved: 2,
  better: 3,
  same: 4,
};

function diffOpportunities(
  before: Report,
  after: Report,
  thresholds: Thresholds,
): OpportunityDiff[] {
  const beforeById = new Map(before.opportunities.map((o) => [o.id, o]));
  const afterById = new Map(after.opportunities.map((o) => [o.id, o]));
  const ids = [...new Set([...beforeById.keys(), ...afterById.keys()])];

  return ids
    .map((id): OpportunityDiff => {
      const b = beforeById.get(id);
      const a = afterById.get(id);
      const status: OpportunityStatus =
        b && a ? classifyOpportunity(b, a, thresholds) : a ? 'new' : 'resolved';
      return {
        id,
        title: (a ?? b)!.title,
        status,
        ...(b && { before: sideOf(b) }),
        ...(a && { after: sideOf(a) }),
        deltaMs: (a?.savingsMs ?? 0) - (b?.savingsMs ?? 0),
        deltaBytes: (a?.savingsBytes ?? 0) - (b?.savingsBytes ?? 0),
      };
    })
    .sort(
      (x, y) =>
        STATUS_ORDER[x.status] - STATUS_ORDER[y.status] ||
        Math.abs(y.deltaMs) - Math.abs(x.deltaMs) ||
        Math.abs(y.deltaBytes) - Math.abs(x.deltaBytes) ||
        x.id.localeCompare(y.id),
    );
}

function diffResources(before: Report, after: Report): ResourceDiff[] {
  const types = [
    ...new Set([...Object.keys(before.resources.byType), ...Object.keys(after.resources.byType)]),
  ].sort();
  const row = (type: string, b: number, a: number): ResourceDiff => ({
    type,
    before: b,
    after: a,
    delta: a - b,
  });
  return [
    row('total', before.resources.totalBytes, after.resources.totalBytes),
    ...types.map((type) =>
      row(type, before.resources.byType[type] ?? 0, after.resources.byType[type] ?? 0),
    ),
  ];
}

function verdictOf(changes: Change[]): Verdict {
  const improved = changes.includes('improved');
  const regressed = changes.includes('regressed');
  if (improved && regressed) return 'mixed';
  return improved ? 'improved' : regressed ? 'regressed' : 'unchanged';
}

/**
 * Diferencias entre dos reportes (`before` → `after`). Lanza `UsageError` si no son comparables.
 * El veredicto resume las métricas y la puntuación; las oportunidades y los recursos son contexto.
 */
export function compareReports(
  before: Report,
  after: Report,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): Comparison {
  assertComparable(before, after);

  const metrics = Object.fromEntries(
    METRIC_IDS.map((id) => {
      const b = before.metrics[id];
      const a = after.metrics[id];
      const delta = Math.round((a.value - b.value) * 1000) / 1000;
      const diff: MetricDiff = {
        unit: b.unit,
        before: b.value,
        after: a.value,
        delta,
        deltaPct: b.value === 0 ? null : delta / b.value,
        change: classifyMetric(id, b, a, thresholds),
        ratingBefore: b.rating,
        ratingAfter: a.rating,
      };
      return [id, diff];
    }),
  ) as Record<MetricId, MetricDiff>;

  const scoreChange = classifyScore(before.score, after.score, thresholds);
  return {
    before: refOf(before),
    after: refOf(after),
    warnings: comparisonWarnings(before, after),
    verdict: verdictOf([scoreChange, ...METRIC_IDS.map((id) => metrics[id].change)]),
    score: {
      before: before.score,
      after: after.score,
      delta: after.score - before.score,
      change: scoreChange,
    },
    metrics,
    opportunities: diffOpportunities(before, after, thresholds),
    resources: diffResources(before, after),
  };
}
