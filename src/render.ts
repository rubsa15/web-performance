import { styleText } from 'node:util';
import {
  METRIC_IDS,
  RATINGS,
  type Impact,
  type Metric,
  type MetricId,
  type Opportunity,
  type Rating,
  type Report,
} from './schema.js';

export type Format = 'text' | 'json' | 'md';

export interface RenderOptions {
  /** Colorea la salida de terminal con ANSI. */
  color?: boolean;
  /** Máximo de mejoras que se listan en el formato `text`. */
  top?: number;
}

const METRIC_LABELS: Record<MetricId, string> = {
  lcp: 'LCP',
  fcp: 'FCP',
  tbt: 'TBT',
  cls: 'CLS',
  si: 'Speed Index',
  ttfb: 'TTFB',
};

const DEFAULT_TOP = 10;
const MAX_MD_ITEMS = 3;

const formatNumber = (value: number): string => new Intl.NumberFormat('en-US').format(value);

function formatValue(metric: Metric, value: number): string {
  return metric.unit === 'ms' ? `${formatNumber(value)} ms` : String(value);
}

function formatBytes(bytes: number): string {
  const kib = bytes / 1024;
  return kib >= 1024 ? `${(kib / 1024).toFixed(1)} MiB` : `${Math.round(kib)} KiB`;
}

function formatSavings(op: Opportunity): string {
  const parts: string[] = [];
  if (op.savingsMs > 0) parts.push(`${formatNumber(op.savingsMs)} ms`);
  if (op.savingsBytes > 0) parts.push(formatBytes(op.savingsBytes));
  return parts.length > 0 ? parts.join(' · ') : 'sin ahorro estimado';
}

function formatRange(metric: Metric): string {
  return metric.min === metric.max
    ? 'sin dispersión'
    : `${formatValue(metric, metric.min)} – ${formatValue(metric, metric.max)}`;
}

function subtitle(report: Report): string {
  const runs = report.environment.runs;
  return [
    report.finalUrl,
    report.device,
    `${runs} ${runs === 1 ? 'ejecución' : 'ejecuciones'}`,
    `Lighthouse ${report.environment.lighthouseVersion}`,
  ].join(' · ');
}

export function renderJson(report: Report): string {
  return JSON.stringify(report, null, 2);
}

export function renderText(report: Report, options: RenderOptions = {}): string {
  const paint = (format: Parameters<typeof styleText>[0], text: string): string =>
    options.color ? styleText(format, text, { validateStream: false }) : text;
  const ratingColor: Record<Rating, 'green' | 'yellow' | 'red'> = {
    good: 'green',
    'needs-improvement': 'yellow',
    poor: 'red',
  };
  const impactColor: Record<Impact, 'red' | 'yellow' | 'gray'> = {
    high: 'red',
    medium: 'yellow',
    low: 'gray',
  };

  const lines: string[] = [paint('bold', subtitle(report))];
  if (report.label) lines.push(`Etiqueta: ${report.label}`);
  if (report.git)
    lines.push(
      `Commit: ${report.git.commit}${report.git.dirty ? ' (con cambios sin commitear)' : ''}`,
    );
  lines.push(
    '',
    `Puntuación: ${paint('bold', `${report.score}/100`)}`,
    '',
    paint('bold', 'Métricas (mediana)'),
  );

  const labelWidth = Math.max(...METRIC_IDS.map((id) => METRIC_LABELS[id].length));
  const valueWidth = Math.max(
    ...METRIC_IDS.map((id) => formatValue(report.metrics[id], report.metrics[id].value).length),
  );
  const ratingWidth = Math.max(...RATINGS.map((r) => r.length));
  for (const id of METRIC_IDS) {
    const metric = report.metrics[id];
    const rating = metric.rating.padEnd(ratingWidth);
    lines.push(
      `  ${METRIC_LABELS[id].padEnd(labelWidth)}  ${formatValue(metric, metric.value).padStart(valueWidth)}  ${paint(ratingColor[metric.rating], rating)}  ${formatRange(metric)}`,
    );
  }

  const top = options.top ?? DEFAULT_TOP;
  const shown = report.opportunities.slice(0, top);
  lines.push('', paint('bold', `Mejoras (${shown.length} de ${report.opportunities.length})`));
  if (shown.length === 0) lines.push('  Lighthouse no encontró mejoras pendientes.');
  shown.forEach((op, i) => {
    const impact = `[${op.impact}]`.padEnd('[medium]'.length);
    lines.push(
      `  ${String(i + 1).padStart(2)}. ${paint(impactColor[op.impact], impact)} ${op.title}`,
    );
    lines.push(`      ${formatSavings(op)} · ${op.category} · ${op.id}`);
  });

  for (const warning of report.warnings) lines.push('', `Aviso: ${warning}`);
  return lines.join('\n');
}

function mdCell(text: string): string {
  return text.replaceAll('|', '\\|');
}

export function renderMarkdown(report: Report): string {
  const lines: string[] = [
    `# Auditoría de rendimiento — ${report.finalUrl}`,
    '',
    `${subtitle(report)}`,
    '',
  ];
  if (report.label) lines.push(`- **Etiqueta:** ${report.label}`);
  if (report.git)
    lines.push(
      `- **Commit:** \`${report.git.commit}\`${report.git.dirty ? ' (con cambios sin commitear)' : ''}`,
    );
  lines.push(`- **Fecha:** ${report.createdAt}`, `- **Puntuación:** ${report.score}/100`, '');

  lines.push(
    '## Métricas (mediana)',
    '',
    '| Métrica | Valor | Valoración | Rango |',
    '| --- | ---: | --- | --- |',
  );
  for (const id of METRIC_IDS) {
    const metric = report.metrics[id];
    lines.push(
      `| ${METRIC_LABELS[id]} | ${formatValue(metric, metric.value)} | ${metric.rating} | ${formatRange(metric)} |`,
    );
  }

  lines.push('', '## Mejoras', '');
  if (report.opportunities.length === 0) {
    lines.push('Lighthouse no encontró mejoras pendientes.');
  } else {
    lines.push(
      '| # | Impacto | Mejora | Ahorro estimado | Categoría | Métricas |',
      '| ---: | --- | --- | --- | --- | --- |',
    );
    report.opportunities.forEach((op, i) => {
      const metrics = op.affectedMetrics.map((m) => METRIC_LABELS[m]).join(', ') || '—';
      lines.push(
        `| ${i + 1} | ${op.impact} | ${mdCell(op.title)} (\`${op.id}\`) | ${formatSavings(op)} | ${op.category} | ${metrics} |`,
      );
    });
    for (const op of report.opportunities.filter((o) => o.items.length > 0)) {
      lines.push('', `### ${op.title}`, '');
      for (const item of op.items.slice(0, MAX_MD_ITEMS)) {
        const extras = [
          item.wastedMs !== undefined && `${formatNumber(item.wastedMs)} ms`,
          item.wastedBytes !== undefined && formatBytes(item.wastedBytes),
          item.cpuMs !== undefined && `${formatNumber(item.cpuMs)} ms de CPU`,
        ].filter(Boolean);
        lines.push(`- \`${item.url}\`${extras.length > 0 ? ` — ${extras.join(', ')}` : ''}`);
      }
    }
  }

  if (report.diagnostics.length > 0) {
    lines.push('', '## Diagnósticos', '');
    for (const d of report.diagnostics) lines.push(`- ${d.title}: ${d.displayValue}`);
  }

  lines.push(
    '',
    '## Recursos',
    '',
    `Total transferido: ${formatBytes(report.resources.totalBytes)}`,
    '',
  );
  for (const [type, bytes] of Object.entries(report.resources.byType)) {
    lines.push(`- ${type}: ${formatBytes(bytes)}`);
  }
  if (report.warnings.length > 0) {
    lines.push('', '## Avisos', '', ...report.warnings.map((w) => `- ${w}`));
  }
  return lines.join('\n');
}

export function render(report: Report, format: Format, options: RenderOptions = {}): string {
  if (format === 'json') return renderJson(report);
  return format === 'md' ? renderMarkdown(report) : renderText(report, options);
}
