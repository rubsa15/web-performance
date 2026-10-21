import { z } from 'zod';
import { RuntimeError } from './errors.js';
import { compareOpportunities, impactOf, median, rate } from './rules.js';
import { NETWORK_PRESETS } from './network.js';
import type {
  Category,
  Device,
  Lcp,
  MetricId,
  Metric,
  Network,
  Opportunity,
  Report,
} from './schema.js';
import { METRIC_IDS } from './schema.js';

/*
 * Único módulo que conoce el formato del LHR de Lighthouse. Solo se validan los campos
 * que se leen, así un cambio ajeno a ellos no rompe la normalización y uno relevante
 * falla con un mensaje claro.
 */

const AuditSchema = z.looseObject({
  title: z.string(),
  score: z.number().nullable(),
  scoreDisplayMode: z.string(),
  numericValue: z.number().optional(),
  displayValue: z.string().optional(),
  metricSavings: z.record(z.string(), z.number()).optional(),
  details: z
    .looseObject({
      type: z.string().optional(),
      items: z.unknown().optional(),
      overallSavingsMs: z.number().optional(),
      overallSavingsBytes: z.number().optional(),
    })
    .optional(),
});

const LhrSchema = z.looseObject({
  lighthouseVersion: z.string(),
  finalDisplayedUrl: z.string().optional(),
  finalUrl: z.string().optional(),
  runtimeError: z.looseObject({ code: z.string(), message: z.string() }).optional(),
  runWarnings: z.array(z.string()).default([]),
  environment: z.looseObject({ hostUserAgent: z.string() }),
  configSettings: z.looseObject({
    throttlingMethod: z.string(),
    formFactor: z.string(),
    throttling: z
      .looseObject({ rttMs: z.number().optional(), throughputKbps: z.number().optional() })
      .optional(),
  }),
  audits: z.record(z.string(), AuditSchema),
  categories: z.looseObject({
    performance: z.looseObject({
      score: z.number().nullable(),
      auditRefs: z.array(z.looseObject({ id: z.string(), group: z.string().optional() })),
    }),
  }),
});

type Lhr = z.infer<typeof LhrSchema>;
type Audit = z.infer<typeof AuditSchema>;

export interface NormalizeMeta {
  url: string;
  device: Device;
  /** Perfil de red con que se lanzó la auditoría; sin indicar, `default`. */
  network?: Network | undefined;
  label?: string | undefined;
  createdAt: Date;
  git?: { commit: string; dirty: boolean } | undefined;
}

const roundMs = (value: number): number => Math.round(value);
const round3 = (value: number): number => Math.round(value * 1000) / 1000;

interface MetricSource {
  unit: 'ms' | '';
  round: (value: number) => number;
  read: (lhr: Lhr) => number | undefined;
}

const auditValue = (id: string) => (lhr: Lhr) => lhr.audits[id]?.numericValue;

const METRIC_SOURCES: Record<MetricId, MetricSource> = {
  lcp: { unit: 'ms', round: roundMs, read: auditValue('largest-contentful-paint') },
  fcp: { unit: 'ms', round: roundMs, read: auditValue('first-contentful-paint') },
  tbt: { unit: 'ms', round: roundMs, read: auditValue('total-blocking-time') },
  cls: { unit: '', round: round3, read: auditValue('cumulative-layout-shift') },
  si: { unit: 'ms', round: roundMs, read: auditValue('speed-index') },
  ttfb: {
    unit: 'ms',
    round: roundMs,
    read: (lhr) => {
      const items = lhr.audits['metrics']?.details?.items;
      const first: unknown = Array.isArray(items) ? items[0] : undefined;
      const fromMetrics = z.looseObject({ timeToFirstByte: z.number() }).safeParse(first);
      return fromMetrics.success
        ? fromMetrics.data.timeToFirstByte
        : auditValue('server-response-time')(lhr);
    },
  },
};

// Categoría por id de auditoría de Lighthouse 13. Las ids desconocidas caen en `other`.
const CATEGORY_BY_AUDIT: Record<string, Category> = {
  'cache-insight': 'network',
  'modern-http-insight': 'network',
  'network-dependency-tree-insight': 'network',
  'lcp-discovery-insight': 'network',
  'third-parties-insight': 'network',
  'total-byte-weight': 'network',
  redirects: 'network',
  'document-latency-insight': 'server',
  'server-response-time': 'server',
  'image-delivery-insight': 'images',
  'unsized-images': 'images',
  'duplicated-javascript-insight': 'javascript',
  'legacy-javascript-insight': 'javascript',
  'forced-reflow-insight': 'javascript',
  'unused-javascript': 'javascript',
  'unminified-javascript': 'javascript',
  'bootup-time': 'javascript',
  'mainthread-work-breakdown': 'javascript',
  'long-tasks': 'javascript',
  'unused-css-rules': 'css',
  'unminified-css': 'css',
  'font-display-insight': 'fonts',
  'render-blocking-insight': 'rendering',
  'cls-culprits-insight': 'rendering',
  'lcp-breakdown-insight': 'rendering',
  'dom-size-insight': 'rendering',
  'viewport-insight': 'rendering',
  'non-composited-animations': 'rendering',
};

const METRIC_KEYS: Record<string, MetricId> = {
  LCP: 'lcp',
  FCP: 'fcp',
  TBT: 'tbt',
  CLS: 'cls',
  SI: 'si',
};
/** Métricas en ms cuyo ahorro estimado puede dar `metricSavings` (CLS no es ms). */
const MS_SAVINGS_KEYS = ['LCP', 'FCP', 'TBT', 'INP'];

const PASSING_SCORE = 0.9;
const MAX_ITEMS = 10;

function parseLhr(raw: unknown, index: number): Lhr {
  const parsed = LhrSchema.safeParse(raw);
  if (!parsed.success) {
    throw new RuntimeError(
      `La ejecución ${index + 1} no tiene el formato de LHR esperado:\n${z.prettifyError(parsed.error)}`,
    );
  }
  const lhr = parsed.data;
  if (lhr.runtimeError) {
    throw new RuntimeError(
      `Lighthouse falló en la ejecución ${index + 1} (${lhr.runtimeError.code}): ${lhr.runtimeError.message}`,
    );
  }
  return lhr;
}

function readScore(lhr: Lhr, index: number): number {
  const score = lhr.categories.performance.score;
  if (score === null) {
    throw new RuntimeError(`La ejecución ${index + 1} no tiene puntuación de rendimiento.`);
  }
  return Math.round(score * 100);
}

function readMetric(lhr: Lhr, id: MetricId, index: number): number {
  const source = METRIC_SOURCES[id];
  const value = source.read(lhr);
  if (value === undefined) {
    throw new RuntimeError(`La ejecución ${index + 1} no incluye la métrica ${id}.`);
  }
  return source.round(value);
}

function aggregateMetric(id: MetricId, values: number[]): Metric {
  const { unit, round } = METRIC_SOURCES[id];
  const value = round(median(values));
  return {
    value,
    unit,
    min: Math.min(...values),
    max: Math.max(...values),
    rating: rate(id, value),
  };
}

/** Índice de la ejecución cuya puntuación está más cerca de la mediana (la primera si empatan). */
function pickRepresentative(scores: number[]): number {
  const mid = median(scores);
  let best = 0;
  scores.forEach((score, i) => {
    if (Math.abs(score - mid) < Math.abs((scores[best] as number) - mid)) best = i;
  });
  return best;
}

function isApplicable(audit: Audit): boolean {
  return !['notApplicable', 'error', 'manual'].includes(audit.scoreDisplayMode);
}

function isFailing(audit: Audit): boolean {
  return (
    ['binary', 'numeric', 'metricSavings'].includes(audit.scoreDisplayMode) &&
    audit.score !== null &&
    audit.score < PASSING_SCORE
  );
}

const EMPTY_AUDIT: Audit = { title: '', score: null, scoreDisplayMode: 'notApplicable' };

function auditItems(audit: Audit): Record<string, unknown>[] {
  const items = audit.details?.items;
  if (!Array.isArray(items)) return [];
  return items.filter((it): it is Record<string, unknown> => typeof it === 'object' && it !== null);
}

function numberField(item: Record<string, unknown>, key: string): number | undefined {
  const value = item[key];
  return typeof value === 'number' ? Math.round(value) : undefined;
}

function savingsMsOf(audit: Audit): number {
  if (audit.details?.overallSavingsMs !== undefined) return roundMs(audit.details.overallSavingsMs);
  const values = MS_SAVINGS_KEYS.map((key) => audit.metricSavings?.[key] ?? 0);
  return roundMs(Math.max(0, ...values));
}

function savingsBytesOf(audit: Audit): number {
  if (audit.details?.overallSavingsBytes !== undefined) {
    return Math.round(audit.details.overallSavingsBytes);
  }
  return Math.round(
    auditItems(audit).reduce((sum, it) => sum + (numberField(it, 'wastedBytes') ?? 0), 0),
  );
}

function affectedMetricsOf(audit: Audit): MetricId[] {
  const entries = Object.entries(audit.metricSavings ?? {}).flatMap(([key, saving]) => {
    const id = METRIC_KEYS[key];
    return id ? [{ id, saving }] : [];
  });
  const withSavings = entries.filter((e) => e.saving > 0);
  return (withSavings.length > 0 ? withSavings : entries).map((e) => e.id);
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;

/** `src` del snippet, si está completo (Lighthouse trunca con `…`); relativo a la página. */
function resourceUrlOf(snippet: string, base: string): string | undefined {
  const src = /\ssrc="([^"]+)"/.exec(snippet)?.[1];
  if (!src || src.includes('…') || src.startsWith('data:')) return undefined;
  try {
    return new URL(src, base).href;
  } catch {
    return undefined;
  }
}

const BREAKDOWN_KEYS = {
  timeToFirstByte: 'ttfb',
  resourceLoadDelay: 'loadDelay',
  resourceLoadDuration: 'loadDuration',
  elementRenderDelay: 'renderDelay',
} as const;

/** Elemento LCP, desglose y descubrimiento de `lcp-breakdown-insight` y `lcp-discovery-insight`. */
function extractLcp(lhr: Lhr): Lcp | undefined {
  const breakdownEntries = auditItems(lhr.audits['lcp-breakdown-insight'] ?? EMPTY_AUDIT);
  const discoveryEntries = auditItems(lhr.audits['lcp-discovery-insight'] ?? EMPTY_AUDIT);
  const node = [...breakdownEntries, ...discoveryEntries].find((e) => e['type'] === 'node');
  const selector = node?.['selector'];
  const snippet = node?.['snippet'];
  if (!node || typeof selector !== 'string' || typeof snippet !== 'string') return undefined;

  const nodeLabel = node['nodeLabel'];
  const url = resourceUrlOf(snippet, lhr.finalDisplayedUrl ?? lhr.finalUrl ?? '');

  const subparts = Object.fromEntries(
    breakdownEntries
      .filter((e) => e['type'] === 'table')
      .flatMap((e) => (Array.isArray(e['items']) ? e['items'] : []))
      .flatMap((row) => {
        const r = asRecord(row);
        const key = BREAKDOWN_KEYS[r?.['subpart'] as keyof typeof BREAKDOWN_KEYS];
        const duration = r?.['duration'];
        return key && typeof duration === 'number' ? [[key, roundMs(duration)]] : [];
      }),
  ) as Partial<NonNullable<Lcp['breakdown']>>;
  const breakdown =
    subparts.ttfb !== undefined &&
    subparts.loadDelay !== undefined &&
    subparts.loadDuration !== undefined &&
    subparts.renderDelay !== undefined
      ? {
          ttfb: subparts.ttfb,
          loadDelay: subparts.loadDelay,
          loadDuration: subparts.loadDuration,
          renderDelay: subparts.renderDelay,
        }
      : undefined;

  const checklist = asRecord(discoveryEntries.find((e) => e['type'] === 'checklist')?.['items']);
  const flag = (key: string): boolean | undefined => {
    const value = asRecord(checklist?.[key])?.['value'];
    return typeof value === 'boolean' ? value : undefined;
  };
  const [priorityHinted, requestDiscoverable, eagerlyLoaded] = [
    flag('priorityHinted'),
    flag('requestDiscoverable'),
    flag('eagerlyLoaded'),
  ];
  const discovery =
    priorityHinted !== undefined && requestDiscoverable !== undefined && eagerlyLoaded !== undefined
      ? { priorityHinted, requestDiscoverable, eagerlyLoaded }
      : undefined;

  return {
    element: {
      selector,
      snippet,
      ...(typeof nodeLabel === 'string' && { nodeLabel }),
      ...(url !== undefined && { url }),
    },
    ...(breakdown && { breakdown }),
    ...(discovery && { discovery }),
  };
}

function itemsOf(id: string, audit: Audit): Opportunity['items'] {
  return auditItems(audit)
    .flatMap((it) => {
      const url = it['url'];
      if (typeof url !== 'string') return [];
      const item: Opportunity['items'][number] = { url };
      const selector = asRecord(it['node'])?.['selector'];
      if (typeof selector === 'string') item.selector = selector;
      const wastedMs = numberField(it, 'wastedMs');
      const wastedBytes = numberField(it, 'wastedBytes');
      const totalBytes = numberField(it, 'totalBytes');
      const cpuMs = id === 'bootup-time' ? numberField(it, 'total') : undefined;
      if (wastedMs !== undefined) item.wastedMs = wastedMs;
      if (wastedBytes !== undefined) item.wastedBytes = wastedBytes;
      if (totalBytes !== undefined) item.totalBytes = totalBytes;
      if (cpuMs !== undefined) item.cpuMs = cpuMs;
      return [item];
    })
    .slice(0, MAX_ITEMS);
}

/** Auditorías que Lighthouse trata como mejora: insights, diagnósticos y las de tipo `opportunity`. */
function auditCandidates(lhr: Lhr): [string, Audit][] {
  return lhr.categories.performance.auditRefs.flatMap((ref) => {
    const audit = lhr.audits[ref.id];
    if (!audit || !isApplicable(audit)) return [];
    const inScope =
      ref.group === 'insights' ||
      ref.group === 'diagnostics' ||
      audit.details?.type === 'opportunity';
    return inScope ? [[ref.id, audit]] : [];
  });
}

function extractOpportunities(lhr: Lhr): Opportunity[] {
  return auditCandidates(lhr)
    .filter(([, audit]) => isFailing(audit))
    .map(([id, audit]) => {
      const savingsMs = savingsMsOf(audit);
      const savingsBytes = savingsBytesOf(audit);
      return {
        id,
        title: audit.title,
        category: CATEGORY_BY_AUDIT[id] ?? 'other',
        savingsMs,
        savingsBytes,
        impact: impactOf(savingsMs, savingsBytes),
        affectedMetrics: affectedMetricsOf(audit),
        items: itemsOf(id, audit),
      };
    })
    .sort(compareOpportunities);
}

function extractDiagnostics(lhr: Lhr): Report['diagnostics'] {
  return auditCandidates(lhr).flatMap(([id, audit]) =>
    !isFailing(audit) && audit.displayValue
      ? [{ id, title: audit.title, displayValue: audit.displayValue.replaceAll('\u00a0', ' ') }]
      : [],
  );
}

function extractResources(lhr: Lhr, warnings: string[]): Report['resources'] {
  const summary = lhr.audits['resource-summary'];
  const bytesByType = new Map<string, number>();
  for (const it of summary ? auditItems(summary) : []) {
    const type = it['resourceType'];
    const size = numberField(it, 'transferSize');
    if (typeof type === 'string' && size !== undefined) bytesByType.set(type, size);
  }
  const totalBytes = bytesByType.get('total');
  if (totalBytes === undefined) {
    warnings.push('Lighthouse no devolvió resource-summary: los recursos no están disponibles.');
    return { totalBytes: 0, byType: {} };
  }
  // `third-party` solapa con los demás tipos, así que no es un tipo más.
  bytesByType.delete('total');
  bytesByType.delete('third-party');
  return { totalBytes, byType: Object.fromEntries(bytesByType) };
}

function chromeVersionOf(lhr: Lhr): string {
  return /Chrome\/([\d.]+)/.exec(lhr.environment.hostUserAgent)?.[1] ?? 'unknown';
}

const isoSeconds = (date: Date): string => date.toISOString().replace(/\.\d{3}Z$/, 'Z');

function formatId(createdAt: Date, device: Device, network: Network): string {
  const suffix = network === 'default' ? '' : `-${network}`;
  return `${isoSeconds(createdAt).replaceAll(':', '-')}-${device}${suffix}`;
}

export function normalize(rawLhrs: unknown[], meta: NormalizeMeta): Report {
  if (rawLhrs.length === 0)
    throw new RuntimeError('No hay ejecuciones de Lighthouse que normalizar.');
  const lhrs = rawLhrs.map(parseLhr);

  lhrs.forEach((lhr, i) => {
    if (lhr.configSettings.formFactor !== meta.device) {
      throw new RuntimeError(
        `La ejecución ${i + 1} se hizo con formFactor "${lhr.configSettings.formFactor}", no "${meta.device}".`,
      );
    }
  });

  const scores = lhrs.map(readScore);
  const representativeIndex = pickRepresentative(scores);
  const representative = lhrs[representativeIndex] as Lhr;
  const network = meta.network ?? 'default';

  const metrics = Object.fromEntries(
    METRIC_IDS.map((id) => [
      id,
      aggregateMetric(
        id,
        lhrs.map((lhr, i) => readMetric(lhr, id, i)),
      ),
    ]),
  ) as Report['metrics'];

  const warnings = [...new Set(lhrs.flatMap((lhr) => lhr.runWarnings))];
  const preset = NETWORK_PRESETS[network];
  const applied = representative.configSettings.throttling;
  if (
    preset &&
    (applied?.rttMs !== preset.rttMs || applied?.throughputKbps !== preset.throughputKbps)
  ) {
    warnings.push(
      `El perfil de red "${network}" no se aplicó tal cual (Lighthouse usó rtt ${applied?.rttMs} ms y ${applied?.throughputKbps} Kbps): las cifras no corresponden a ese perfil.`,
    );
  }
  const resources = extractResources(representative, warnings);
  const lcp = extractLcp(representative);
  const selectors = new Set(lhrs.map((lhr) => extractLcp(lhr)?.element.selector ?? '(ninguno)'));
  if (selectors.size > 1) {
    warnings.push(
      `El elemento LCP no es el mismo en todas las ejecuciones (${[...selectors].join(' | ')}): se muestra el de la ejecución representativa.`,
    );
  }

  return {
    schemaVersion: 1,
    id: formatId(meta.createdAt, meta.device, network),
    url: meta.url,
    finalUrl: representative.finalDisplayedUrl ?? representative.finalUrl ?? meta.url,
    device: meta.device,
    ...(meta.label !== undefined && { label: meta.label }),
    createdAt: isoSeconds(meta.createdAt),
    environment: {
      lighthouseVersion: representative.lighthouseVersion,
      chromeVersion: chromeVersionOf(representative),
      throttling: representative.configSettings.throttlingMethod,
      network,
      runs: lhrs.length,
      representativeRun: representativeIndex + 1,
    },
    ...(meta.git && { git: meta.git }),
    score: Math.round(median(scores)),
    metrics,
    ...(lcp && { lcp }),
    opportunities: extractOpportunities(representative),
    diagnostics: extractDiagnostics(representative),
    resources,
    warnings,
  };
}
