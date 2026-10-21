import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalize } from '../src/normalizer.js';
import { impactOf, rate } from '../src/rules.js';
import {
  METRIC_IDS,
  type Device,
  type Network,
  type Metric,
  type MetricId,
  type Opportunity,
  type Report,
} from '../src/schema.js';

/** Solo los campos del LHR que los tests modifican; el resto pasa tal cual. */
export interface LhrFixture {
  audits: Record<string, { numericValue?: number; details?: unknown }>;
  categories: { performance: { score: number | null } };
  configSettings: { formFactor: string };
  [key: string]: unknown;
}

export function loadLhr(name: 'lhr-bbc-mobile' | 'lhr-wikipedia-desktop'): LhrFixture {
  const path = fileURLToPath(new URL(`./fixtures/${name}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8')) as LhrFixture;
}

/** Copia de un LHR con otras métricas y puntuación, para simular otra ejecución. */
export function variant(
  lhr: LhrFixture,
  changes: { score?: number; lcp?: number; tbt?: number; cls?: number },
): LhrFixture {
  const copy = structuredClone(lhr);
  const set = (id: string, value: number | undefined) => {
    const audit = copy.audits[id];
    if (value !== undefined && audit) audit.numericValue = value;
  };
  if (changes.score !== undefined) copy.categories.performance.score = changes.score;
  set('largest-contentful-paint', changes.lcp);
  set('total-blocking-time', changes.tbt);
  set('cumulative-layout-shift', changes.cls);
  return copy;
}

export interface ReportChanges {
  url?: string;
  device?: Device;
  network?: Network;
  createdAt?: string;
  label?: string;
  throttling?: string;
  lighthouseVersion?: string;
  chromeVersion?: string;
  runs?: number;
  score?: number;
  /** `value` sin `min`/`max` los iguala a `value` (sin dispersión); la valoración se recalcula. */
  metrics?: Partial<Record<MetricId, Partial<Metric>>>;
  opportunities?: Opportunity[];
  resources?: Report['resources'];
}

/** Reporte sintético a partir del fixture de BBC, con solo lo que el test necesita cambiar. */
export function makeReport(changes: ReportChanges = {}): Report {
  const base = normalize([loadLhr('lhr-bbc-mobile')], {
    url: changes.url ?? 'https://example.com/',
    device: 'mobile',
    createdAt: new Date(changes.createdAt ?? '2026-10-21T10:00:00Z'),
    ...(changes.label !== undefined && { label: changes.label }),
  });
  const report = structuredClone(base);
  report.device = changes.device ?? report.device;
  const network = changes.network ?? 'default';
  report.environment.network = network;
  report.id = `${report.createdAt.replaceAll(':', '-')}-${report.device}${network === 'default' ? '' : `-${network}`}`;
  if (changes.throttling) report.environment.throttling = changes.throttling;
  if (changes.lighthouseVersion) report.environment.lighthouseVersion = changes.lighthouseVersion;
  if (changes.chromeVersion) report.environment.chromeVersion = changes.chromeVersion;
  report.environment.runs = changes.runs ?? 3;
  if (changes.score !== undefined) report.score = changes.score;
  if (changes.opportunities) report.opportunities = changes.opportunities;
  if (changes.resources) report.resources = changes.resources;
  for (const id of METRIC_IDS) {
    const patch = changes.metrics?.[id];
    if (!patch) continue;
    const metric = report.metrics[id];
    const value = patch.value ?? metric.value;
    report.metrics[id] = {
      ...metric,
      value,
      min: patch.min ?? (patch.value !== undefined ? value : metric.min),
      max: patch.max ?? (patch.value !== undefined ? value : metric.max),
      rating: patch.rating ?? rate(id, value),
    };
  }
  return report;
}

export function makeOpportunity(id: string, savingsMs: number, savingsBytes = 0): Opportunity {
  return {
    id,
    title: `Título de ${id}`,
    category: 'other',
    savingsMs,
    savingsBytes,
    impact: impactOf(savingsMs, savingsBytes),
    affectedMetrics: [],
    items: [],
  };
}
