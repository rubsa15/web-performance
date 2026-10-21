// Experimento de ruido (SPEC §9, PLAN fase 3). Se ejecuta compilado, con la demo en marcha:
//
//   node dist/experiments/noise.js run <url> <carpeta> [--audits 10] [--runs 3]
//       Audita N veces seguidas la URL (mobile, como `wperf audit`) y guarda cada Report en
//       <carpeta>/NN.json.
//   node dist/experiments/noise.js analyze <carpeta>...
//       Lee esos Reports (sin Chrome) y escribe en stdout, en Markdown, la dispersión por métrica
//       y cuántos pares de auditorías idénticas marcaría `wperf compare` como cambio.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';
import { compareReports } from '../compare.js';
import { normalize } from '../normalizer.js';
import { DEFAULT_THRESHOLDS, median, type Thresholds } from '../rules.js';
import { runAudit } from '../runner.js';
import { METRIC_IDS, ReportSchema, type Report } from '../schema.js';

const stdev = (values: number[]): number => {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1));
};

const fmt = (n: number): string =>
  Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000);
const mean = (values: number[]): number => values.reduce((a, b) => a + b, 0) / values.length;
const pairsOf = <T>(items: T[]): [T, T][] =>
  items.flatMap((a, i) => items.slice(i + 1).map((b): [T, T] => [a, b]));

/**
 * Tablas Markdown con la dispersión de `reports` (auditorías idénticas de la misma página) y los
 * falsos positivos de `compareReports` sobre todos los pares posibles, con los `thresholds` dados.
 */
export function analyzeNoise(
  name: string,
  reports: Report[],
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): string {
  if (reports.length < 2) throw new RangeError('Hacen falta al menos dos auditorías.');
  const pairs = pairsOf(reports);
  const comparisons = pairs.map(([a, b]) => compareReports(a, b, thresholds));
  const scores = reports.map((r) => r.score);

  const lines = [
    `### ${name}`,
    '',
    `${reports.length} auditorías de ${reports[0]?.environment.runs} ejecuciones. Puntuación: ` +
      `mediana ${fmt(median(scores))}, rango ${Math.min(...scores)}–${Math.max(...scores)}.`,
    '',
    '| Métrica | Mediana de medianas | Rango entre medianas | Desv. típica | Rango min–max dentro de una auditoría (media) | Umbral (sobre la mediana) | Pares marcados |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const id of METRIC_IDS) {
    const values = reports.map((r) => r.metrics[id].value);
    const med = median(values);
    const t = thresholds.metrics[id];
    const flagged = comparisons.filter((c) => c.metrics[id].change !== 'unchanged').length;
    lines.push(
      `| ${id} | ${fmt(med)} | ${fmt(Math.max(...values) - Math.min(...values))} | ${fmt(stdev(values))} | ${fmt(mean(reports.map((r) => r.metrics[id].max - r.metrics[id].min)))} | ${fmt(Math.max(t.abs, t.rel * med))} | ${flagged}/${pairs.length} |`,
    );
  }
  lines.push(
    '',
    `Puntuación marcada en ${comparisons.filter((c) => c.score.change !== 'unchanged').length}/${pairs.length} pares; ` +
      `veredicto distinto de \`unchanged\` en ${comparisons.filter((c) => c.verdict !== 'unchanged').length}/${pairs.length}.`,
    '',
  );

  const ids = [...new Set(reports.flatMap((r) => r.opportunities.map((o) => o.id)))].sort();
  lines.push(
    '| Oportunidad | Presente en | Ahorro ms (min–max) | Ahorro KiB (min–max) | Pares con estado ≠ same |',
    '| --- | ---: | ---: | ---: | ---: |',
  );
  for (const id of ids) {
    const ops = reports.map((r) => r.opportunities.find((o) => o.id === id));
    const ms = ops.map((o) => o?.savingsMs ?? 0);
    const kib = ops.map((o) => Math.round((o?.savingsBytes ?? 0) / 1024));
    const changed = comparisons.filter(
      (c) => c.opportunities.find((o) => o.id === id)?.status !== 'same',
    ).length;
    lines.push(
      `| ${id} | ${ops.filter(Boolean).length}/${reports.length} | ${fmt(Math.min(...ms))}–${fmt(Math.max(...ms))} | ${fmt(Math.min(...kib))}–${fmt(Math.max(...kib))} | ${changed}/${pairs.length} |`,
    );
  }
  return lines.join('\n');
}

async function loadReports(dir: string): Promise<Report[]> {
  const names = (await readdir(dir)).filter((n) => n.endsWith('.json')).sort();
  return Promise.all(
    names.map(async (n) => ReportSchema.parse(JSON.parse(await readFile(join(dir, n), 'utf8')))),
  );
}

async function runExperiment(
  url: string,
  dir: string,
  audits: number,
  runs: number,
): Promise<void> {
  await mkdir(dir, { recursive: true });
  for (let i = 1; i <= audits; i++) {
    const lhrs = await runAudit({ url, device: 'mobile', runs });
    const report = normalize(lhrs, {
      url,
      device: 'mobile',
      label: `ruido ${i}/${audits}`,
      createdAt: new Date(),
    });
    await writeFile(
      join(dir, `${String(i).padStart(2, '0')}.json`),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    console.error(`auditoría ${i}/${audits}: score ${report.score}`);
  }
}

if (import.meta.main) {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { audits: { type: 'string', default: '10' }, runs: { type: 'string', default: '3' } },
  });
  const [command, ...args] = positionals;
  if (command === 'run' && args.length === 2) {
    await runExperiment(args[0]!, args[1]!, Number(values.audits), Number(values.runs));
  } else if (command === 'analyze' && args.length > 0) {
    const sections = await Promise.all(
      args.map(async (dir) => analyzeNoise(basename(dir), await loadReports(dir))),
    );
    console.log(sections.join('\n\n'));
  } else {
    console.error(
      'Uso: noise run <url> <carpeta> [--audits 10] [--runs 3] | noise analyze <carpeta>...',
    );
    process.exitCode = 2;
  }
}
