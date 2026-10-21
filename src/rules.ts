import type { Impact, Metric, MetricId, Opportunity, Rating } from './schema.js';

/** Umbrales oficiales (Core Web Vitals / Lighthouse): `good` hasta `good`, `poor` por encima de `poor`. */
const RATING_THRESHOLDS: Record<MetricId, { good: number; poor: number }> = {
  lcp: { good: 2500, poor: 4000 },
  fcp: { good: 1800, poor: 3000 },
  tbt: { good: 200, poor: 600 },
  cls: { good: 0.1, poor: 0.25 },
  si: { good: 3400, poor: 5800 },
  ttfb: { good: 800, poor: 1800 },
};

export function rate(metric: MetricId, value: number): Rating {
  const { good, poor } = RATING_THRESHOLDS[metric];
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

// SPEC §6. Los KB son KiB, igual que los muestra Lighthouse.
const KIB = 1024;
const HIGH = { ms: 500, bytes: 250 * KIB };
const MEDIUM = { ms: 150, bytes: 50 * KIB };

export function impactOf(savingsMs: number, savingsBytes: number): Impact {
  if (savingsMs >= HIGH.ms || savingsBytes >= HIGH.bytes) return 'high';
  if (savingsMs >= MEDIUM.ms || savingsBytes >= MEDIUM.bytes) return 'medium';
  return 'low';
}

const IMPACT_ORDER: Record<Impact, number> = { high: 0, medium: 1, low: 2 };

/** Orden: impacto, luego `savingsMs`, luego `savingsBytes`; el id desempata para ser determinista. */
export function compareOpportunities(a: Opportunity, b: Opportunity): number {
  return (
    IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact] ||
    b.savingsMs - a.savingsMs ||
    b.savingsBytes - a.savingsBytes ||
    a.id.localeCompare(b.id)
  );
}

export type Change = 'improved' | 'regressed' | 'unchanged';

/** Umbral de cambio significativo: `max(abs, rel × valor_base)`. */
export interface ChangeThreshold {
  abs: number;
  rel: number;
}

export interface Thresholds {
  metrics: Record<MetricId, ChangeThreshold>;
  /** Puntos de puntuación (0–100). */
  score: number;
  /** Ahorro de una oportunidad que se mantiene entre dos reportes. */
  opportunity: { ms: ChangeThreshold; bytes: ChangeThreshold };
}

// SPEC §6 calibrado con el experimento de ruido (docs/metrics/noise.md). Cambios respecto a la
// SPEC: TBT relativo 15 % → 50 %, score 3 → 5 puntos; TTFB y `opportunity` no estaban definidos.
export const DEFAULT_THRESHOLDS: Thresholds = {
  metrics: {
    lcp: { abs: 150, rel: 0.1 },
    fcp: { abs: 150, rel: 0.1 },
    si: { abs: 150, rel: 0.1 },
    tbt: { abs: 50, rel: 0.5 },
    cls: { abs: 0.02, rel: 0 },
    ttfb: { abs: 100, rel: 0.2 },
  },
  score: 5,
  opportunity: {
    ms: { abs: 100, rel: 0.5 },
    bytes: { abs: 10 * KIB, rel: 0.2 },
  },
};

// Evita que 0.22 - 0.2 > 0.02 por error de coma flotante (los valores ya vienen a 3 decimales).
const round3 = (value: number): number => Math.round(value * 1000) / 1000;

/** `true` si el cambio de `before` a `after` supera el umbral (en valor absoluto). */
export function exceeds(before: number, after: number, threshold: ChangeThreshold): boolean {
  return (
    Math.abs(round3(after - before)) > Math.max(threshold.abs, threshold.rel * Math.abs(before))
  );
}

/**
 * SPEC §6: una métrica cambia si el salto supera el umbral **y** los rangos min–max de
 * ambos reportes no se solapan. Todas las métricas mejoran al bajar.
 */
export function classifyMetric(
  id: MetricId,
  before: Pick<Metric, 'value' | 'min' | 'max'>,
  after: Pick<Metric, 'value' | 'min' | 'max'>,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): Change {
  if (!exceeds(before.value, after.value, thresholds.metrics[id])) return 'unchanged';
  if (before.min <= after.max && after.min <= before.max) return 'unchanged';
  return after.value < before.value ? 'improved' : 'regressed';
}

/** La puntuación mejora al subir; no tiene rango, solo el umbral en puntos. */
export function classifyScore(
  before: number,
  after: number,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): Change {
  if (Math.abs(after - before) <= thresholds.score) return 'unchanged';
  return after > before ? 'improved' : 'regressed';
}

export function median(values: number[]): number {
  if (values.length === 0) throw new RangeError('median() de una lista vacía');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const hi = sorted[mid] as number;
  return sorted.length % 2 === 1 ? hi : ((sorted[mid - 1] as number) + hi) / 2;
}
