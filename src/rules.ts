import type { Impact, MetricId, Opportunity, Rating } from './schema.js';

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

export function median(values: number[]): number {
  if (values.length === 0) throw new RangeError('median() de una lista vacía');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const hi = sorted[mid] as number;
  return sorted.length % 2 === 1 ? hi : ((sorted[mid - 1] as number) + hi) / 2;
}
