import { z } from 'zod';

export const DEVICES = ['mobile', 'desktop'] as const;
export const METRIC_IDS = ['lcp', 'fcp', 'tbt', 'cls', 'si', 'ttfb'] as const;
/** Perfiles de red: `default` es el del dispositivo (slow 4G en mobile, dense 4G en desktop). */
export const NETWORKS = ['default', '3g', '4g'] as const;
export const RATINGS = ['good', 'needs-improvement', 'poor'] as const;
export const IMPACTS = ['high', 'medium', 'low'] as const;
export const CATEGORIES = [
  'network',
  'images',
  'javascript',
  'css',
  'fonts',
  'server',
  'rendering',
  'other',
] as const;

export const DeviceSchema = z.enum(DEVICES);
export const NetworkSchema = z.enum(NETWORKS);
export const MetricIdSchema = z.enum(METRIC_IDS);
export const RatingSchema = z.enum(RATINGS);
export const ImpactSchema = z.enum(IMPACTS);
export const CategorySchema = z.enum(CATEGORIES);

const MetricSchema = z.object({
  value: z.number(),
  unit: z.enum(['ms', '']),
  min: z.number(),
  max: z.number(),
  rating: RatingSchema,
});

const OpportunityItemSchema = z.object({
  url: z.string(),
  /** Selector CSS del elemento, cuando Lighthouse lo da (útil si `url` viene vacía). */
  selector: z.string().optional(),
  wastedMs: z.number().optional(),
  wastedBytes: z.number().optional(),
  totalBytes: z.number().optional(),
  cpuMs: z.number().optional(),
});

const OpportunitySchema = z.object({
  id: z.string(),
  title: z.string(),
  category: CategorySchema,
  savingsMs: z.number().nonnegative(),
  savingsBytes: z.number().nonnegative(),
  impact: ImpactSchema,
  affectedMetrics: z.array(MetricIdSchema),
  items: z.array(OpportunityItemSchema),
});

/** Elemento LCP de la ejecución representativa y por qué tarda (insights `lcp-*` de Lighthouse). */
const LcpSchema = z.object({
  element: z.object({
    selector: z.string(),
    /** Etiqueta HTML del elemento; Lighthouse la trunca (`…`) si es larga. */
    snippet: z.string(),
    nodeLabel: z.string().optional(),
    /** Recurso (imagen o vídeo) si el `src` de `snippet` está completo; ausente si no. */
    url: z.string().optional(),
  }),
  /**
   * Subpartes del LCP en ms, medidas en la carga real de Chrome. Con `throttling: simulate` el
   * valor de la métrica es una simulación y no coincide con su suma: úsalas por proporción.
   */
  breakdown: z
    .object({
      ttfb: z.number(),
      loadDelay: z.number(),
      loadDuration: z.number(),
      renderDelay: z.number(),
    })
    .optional(),
  discovery: z
    .object({
      priorityHinted: z.boolean(),
      requestDiscoverable: z.boolean(),
      eagerlyLoaded: z.boolean(),
    })
    .optional(),
});

const DiagnosticSchema = z.object({
  id: z.string(),
  title: z.string(),
  displayValue: z.string(),
});

export const ReportSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  url: z.string(),
  finalUrl: z.string(),
  device: DeviceSchema,
  label: z.string().optional(),
  createdAt: z.iso.datetime(),
  environment: z.object({
    lighthouseVersion: z.string(),
    chromeVersion: z.string(),
    throttling: z.string(),
    /** Perfil de red; ausente en reportes anteriores a `--network` (equivale a `default`). */
    network: NetworkSchema.optional(),
    runs: z.number().int().positive(),
    /** Ejecución (1..runs) de la que salen oportunidades, diagnósticos y recursos. */
    representativeRun: z.number().int().positive(),
  }),
  git: z.object({ commit: z.string(), dirty: z.boolean() }).optional(),
  score: z.number().min(0).max(100),
  metrics: z.object({
    lcp: MetricSchema,
    fcp: MetricSchema,
    tbt: MetricSchema,
    cls: MetricSchema,
    si: MetricSchema,
    ttfb: MetricSchema,
  }),
  /** Ausente si el LCP no es un elemento (o en reportes anteriores a este campo). */
  lcp: LcpSchema.optional(),
  opportunities: z.array(OpportunitySchema),
  diagnostics: z.array(DiagnosticSchema),
  resources: z.object({
    totalBytes: z.number().nonnegative(),
    byType: z.record(z.string(), z.number().nonnegative()),
  }),
  warnings: z.array(z.string()),
});

export type Report = z.infer<typeof ReportSchema>;
export type Device = z.infer<typeof DeviceSchema>;
export type Network = z.infer<typeof NetworkSchema>;
export type MetricId = z.infer<typeof MetricIdSchema>;
export type Metric = z.infer<typeof MetricSchema>;
export type Rating = z.infer<typeof RatingSchema>;
export type Impact = z.infer<typeof ImpactSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Lcp = z.infer<typeof LcpSchema>;
export type Opportunity = z.infer<typeof OpportunitySchema>;

/** Perfil de red de un reporte; los anteriores a `--network` no lo guardan y cuentan como `default`. */
export const networkOf = (report: Pick<Report, 'environment'>): Network =>
  report.environment.network ?? 'default';
