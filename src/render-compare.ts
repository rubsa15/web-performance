import type { Comparison, OpportunityStatus } from './compare.js';
import type { History, HistoryEntry } from './history.js';
import {
  formatBytes,
  formatNumber,
  formatSavings,
  formatValue,
  mdCell,
  METRIC_LABELS,
  painter,
  type Format,
  type Paint,
  type RenderOptions,
} from './render.js';
import { METRIC_IDS, type MetricId } from './schema.js';
import type { Change } from './rules.js';

type Color = 'green' | 'red' | 'gray';

const CHANGE_COLOR: Record<Change, Color> = {
  improved: 'green',
  regressed: 'red',
  unchanged: 'gray',
};
const STATUS_COLOR: Record<OpportunityStatus, Color> = {
  new: 'red',
  worse: 'red',
  resolved: 'green',
  better: 'green',
  same: 'gray',
};

const sign = (value: number): string => (value > 0 ? '+' : value < 0 ? '-' : '');

function formatDelta(unit: 'ms' | '', delta: number): string {
  const abs = Math.abs(delta);
  return `${sign(delta)}${unit === 'ms' ? `${formatNumber(abs)} ms` : abs}`;
}

const formatPct = (pct: number | null): string =>
  pct === null ? '' : `${sign(pct)}${Math.abs(Math.round(pct * 100))}%`;

const pctSuffix = (m: { delta: number; deltaPct: number | null }): string =>
  m.deltaPct === null || Math.round(m.deltaPct * 100) === 0 ? '' : ` (${formatPct(m.deltaPct)})`;

const formatBytesDelta = (delta: number): string => `${sign(delta)}${formatBytes(Math.abs(delta))}`;

/** Alinea las columnas con el texto plano y pinta después, para que el ANSI no descuadre el ancho. */
function textTable(
  rows: string[][],
  options: { right?: number[]; paint?: (column: number, cell: string, row: number) => string } = {},
): string[] {
  const widths = (rows[0] ?? []).map((_, c) => Math.max(...rows.map((r) => (r[c] ?? '').length)));
  return rows.map((row, r) =>
    row
      .map((cell, c) => {
        const padded = options.right?.includes(c)
          ? cell.padStart(widths[c]!)
          : cell.padEnd(widths[c]!);
        return options.paint ? options.paint(c, padded, r) : padded;
      })
      .join('  ')
      .trimEnd(),
  );
}

function describeRef(ref: Comparison['before']): string {
  return [
    ref.id,
    ref.url,
    ref.network === 'default' ? undefined : `red ${ref.network}`,
    `${ref.runs} ${ref.runs === 1 ? 'ejecución' : 'ejecuciones'}`,
    ref.git && `commit ${ref.git.commit}${ref.git.dirty ? '*' : ''}`,
    ref.label && `"${ref.label}"`,
  ]
    .filter(Boolean)
    .join(' · ');
}

const ratingShift = (before: string, after: string): string =>
  before === after ? before : `${before} → ${after}`;

function savingsSide(side: { savingsMs: number; savingsBytes: number } | undefined): string {
  return side ? formatSavings(side) : '—';
}

export function renderComparisonJson(comparison: Comparison): string {
  return JSON.stringify(comparison, null, 2);
}

export function renderComparisonText(comparison: Comparison, options: RenderOptions = {}): string {
  const paint = painter(options.color);
  const { score } = comparison;
  const lines: string[] = [
    paint(
      'bold',
      `Comparación de rendimiento — ${paint(verdictColor(comparison), comparison.verdict)}`,
    ),
    `  Antes:   ${describeRef(comparison.before)}`,
    `  Después: ${describeRef(comparison.after)}`,
    '',
    `Puntuación: ${score.before} → ${score.after} (${sign(score.delta)}${Math.abs(score.delta)})  ${paint(CHANGE_COLOR[score.change], score.change)}`,
    '',
    paint('bold', 'Métricas (mediana)'),
  ];

  const metricRows = METRIC_IDS.map((id) => {
    const m = comparison.metrics[id];
    return [
      METRIC_LABELS[id],
      formatValue(m, m.before),
      '→',
      formatValue(m, m.after),
      `${formatDelta(m.unit, m.delta)}${pctSuffix(m)}`,
      ratingShift(m.ratingBefore, m.ratingAfter),
      m.change,
    ];
  });
  lines.push(
    ...textTable(metricRows, {
      right: [1, 3, 4],
      paint: (column, cell, row) =>
        column === 6
          ? paint(CHANGE_COLOR[comparison.metrics[METRIC_IDS[row]!].change], cell)
          : cell,
    }).map((line) => `  ${line}`),
  );

  const changed = comparison.opportunities.filter((o) => o.status !== 'same');
  const same = comparison.opportunities.length - changed.length;
  lines.push('', paint('bold', `Mejoras (${changed.length} con cambios, ${same} sin cambios)`));
  if (changed.length === 0) lines.push('  Ninguna oportunidad ha cambiado.');
  const oppRows = changed.map((o) => [
    o.status,
    `[${(o.after ?? o.before)!.impact}]`,
    o.title,
    `${savingsSide(o.before)} → ${savingsSide(o.after)}`,
    o.id,
  ]);
  lines.push(
    ...textTable(oppRows, {
      paint: (column, cell, row) =>
        column === 0 ? paint(STATUS_COLOR[changed[row]!.status], cell) : cell,
    }).map((line) => `  ${line}`),
  );

  const resourceRows = comparison.resources
    .filter((r) => r.delta !== 0)
    .map((r) => [
      r.type,
      `${formatBytes(r.before)} → ${formatBytes(r.after)}`,
      formatBytesDelta(r.delta),
    ]);
  lines.push('', paint('bold', 'Recursos transferidos'));
  if (resourceRows.length === 0) lines.push('  Sin cambios.');
  lines.push(...textTable(resourceRows, { right: [2] }).map((line) => `  ${line}`));

  for (const warning of comparison.warnings) lines.push('', `Aviso: ${warning}`);
  return lines.join('\n');
}

function verdictColor(comparison: Comparison): 'green' | 'red' | 'yellow' | 'gray' {
  return comparison.verdict === 'mixed' ? 'yellow' : CHANGE_COLOR[comparison.verdict];
}

export function renderComparisonMarkdown(comparison: Comparison): string {
  const { score } = comparison;
  const lines: string[] = [
    '# Comparación de rendimiento',
    '',
    `- **Resultado:** ${comparison.verdict}`,
    `- **Antes:** ${describeRef(comparison.before)}`,
    `- **Después:** ${describeRef(comparison.after)}`,
    `- **Puntuación:** ${score.before} → ${score.after} (${sign(score.delta)}${Math.abs(score.delta)}) — ${score.change}`,
    '',
    '## Métricas (mediana)',
    '',
    '| Métrica | Antes | Después | Cambio | Valoración | Resultado |',
    '| --- | ---: | ---: | ---: | --- | --- |',
  ];
  for (const id of METRIC_IDS) {
    const m = comparison.metrics[id];
    lines.push(
      `| ${METRIC_LABELS[id]} | ${formatValue(m, m.before)} | ${formatValue(m, m.after)} | ${formatDelta(m.unit, m.delta)}${pctSuffix(m)} | ${ratingShift(m.ratingBefore, m.ratingAfter)} | ${m.change} |`,
    );
  }

  const changed = comparison.opportunities.filter((o) => o.status !== 'same');
  lines.push('', '## Mejoras', '');
  if (changed.length === 0) {
    lines.push('Ninguna oportunidad ha cambiado.');
  } else {
    lines.push(
      '| Estado | Impacto | Mejora | Ahorro (antes → después) |',
      '| --- | --- | --- | --- |',
    );
    for (const o of changed) {
      lines.push(
        `| ${o.status} | ${(o.after ?? o.before)!.impact} | ${mdCell(o.title)} (\`${o.id}\`) | ${savingsSide(o.before)} → ${savingsSide(o.after)} |`,
      );
    }
  }
  const same = comparison.opportunities.length - changed.length;
  if (same > 0) lines.push('', `${same} oportunidades sin cambios.`);

  const resources = comparison.resources.filter((r) => r.delta !== 0);
  lines.push('', '## Recursos transferidos', '');
  if (resources.length === 0) {
    lines.push('Sin cambios.');
  } else {
    lines.push('| Tipo | Antes | Después | Cambio |', '| --- | ---: | ---: | ---: |');
    for (const r of resources) {
      lines.push(
        `| ${r.type} | ${formatBytes(r.before)} | ${formatBytes(r.after)} | ${formatBytesDelta(r.delta)} |`,
      );
    }
  }

  if (comparison.warnings.length > 0) {
    lines.push('', '## Avisos', '', ...comparison.warnings.map((w) => `- ${w}`));
  }
  return lines.join('\n');
}

export function renderComparison(
  comparison: Comparison,
  format: Format,
  options: RenderOptions = {},
): string {
  if (format === 'json') return renderComparisonJson(comparison);
  return format === 'md'
    ? renderComparisonMarkdown(comparison)
    : renderComparisonText(comparison, options);
}

// ── history ──────────────────────────────────────────────────────────────

const SPARK = '▁▂▃▄▅▆▇█';

/** Una barra por valor, escalada entre el mínimo y el máximo de la serie. */
export function sparkline(values: number[]): string {
  const [min, max] = [Math.min(...values), Math.max(...values)];
  return values
    .map((v) => SPARK[max === min ? 0 : Math.round(((v - min) / (max - min)) * (SPARK.length - 1))])
    .join('');
}

/** Flecha del sentido del cambio, solo si es significativo. */
const arrow = (delta: number, change: Change): string =>
  change === 'unchanged' ? '' : delta > 0 ? ' ↑' : ' ↓';

function historyCells(entry: HistoryEntry, metric: MetricId | undefined): string[] {
  const commit = entry.git ? `${entry.git.commit}${entry.git.dirty ? '*' : ''}` : '—';
  const label = entry.label ?? '';
  if (metric) {
    const m = entry.metrics[metric];
    const prev = entry.vsPrevious?.metrics[metric];
    return [
      entry.id,
      formatValue(m, m.value),
      m.min === m.max ? '—' : `${formatValue(m, m.min)} – ${formatValue(m, m.max)}`,
      m.rating,
      prev ? `${formatDelta(m.unit, prev.delta)}${arrow(prev.delta, prev.change)}` : '—',
      commit,
      label,
    ];
  }
  const cell = (id: MetricId): string => {
    const m = entry.metrics[id];
    const prev = entry.vsPrevious?.metrics[id];
    return `${formatValue(m, m.value)}${prev ? arrow(prev.delta, prev.change) : ''}`;
  };
  const score = entry.vsPrevious
    ? `${entry.score}${arrow(entry.vsPrevious.score.delta, entry.vsPrevious.score.change)}`
    : String(entry.score);
  return [entry.id, score, cell('lcp'), cell('tbt'), cell('cls'), commit, label];
}

function historyHeader(metric: MetricId | undefined): string[] {
  return metric
    ? ['ID', METRIC_LABELS[metric], 'Rango', 'Valoración', 'Δ anterior', 'Commit', 'Etiqueta']
    : ['ID', 'Score', 'LCP', 'TBT', 'CLS', 'Commit', 'Etiqueta'];
}

const LEGEND =
  '↑/↓: cambio significativo respecto al reporte anterior del mismo perfil (SPEC §6); sin flecha = unchanged. * = árbol con cambios sin commitear.';

export function renderHistoryJson(history: History): string {
  return JSON.stringify(history, null, 2);
}

export function renderHistoryText(
  history: History,
  metric?: MetricId,
  options: RenderOptions = {},
): string {
  const paint: Paint = painter(options.color);
  const rows = [historyHeader(metric), ...history.entries.map((e) => historyCells(e, metric))];
  const table = textTable(rows, {
    right: metric ? [1, 4] : [1, 2, 3, 4],
    paint: (_column, cell, row) => (row === 0 ? paint('bold', cell) : cell),
  });
  const lines = [
    paint('bold', `Historial de ${history.url} (${history.entries.length} auditorías)`),
    '',
    ...table.map((line) => `  ${line}`),
  ];
  if (metric) {
    const values = history.entries.map((e) => e.metrics[metric].value);
    lines.push('', `  Evolución de ${METRIC_LABELS[metric]}: ${sparkline(values)}`);
  }
  lines.push('', LEGEND);
  return lines.join('\n');
}

export function renderHistoryMarkdown(history: History, metric?: MetricId): string {
  const header = historyHeader(metric);
  const align = metric ? [1, 4] : [1, 2, 3, 4];
  const lines = [
    `# Historial de ${history.url}`,
    '',
    `${history.entries.length} auditorías.`,
    '',
    `| ${header.join(' | ')} |`,
    `| ${header.map((_, i) => (align.includes(i) ? '---:' : '---')).join(' | ')} |`,
  ];
  for (const entry of history.entries) {
    lines.push(`| ${historyCells(entry, metric).map(mdCell).join(' | ')} |`);
  }
  if (metric) {
    const values = history.entries.map((e) => e.metrics[metric].value);
    lines.push('', `Evolución de ${METRIC_LABELS[metric]}: ${sparkline(values)}`);
  }
  lines.push('', LEGEND);
  return lines.join('\n');
}

export function renderHistory(
  history: History,
  format: Format,
  metric?: MetricId,
  options: RenderOptions = {},
): string {
  if (format === 'json') return renderHistoryJson(history);
  return format === 'md'
    ? renderHistoryMarkdown(history, metric)
    : renderHistoryText(history, metric, options);
}
