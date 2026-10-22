// Evaluación de las skills. Comprueba, sin LLM, la respuesta de una skill:
//
//   node dist/experiments/skill-eval.js figures <respuesta.md> <reporte.json>...
//       Cifras de la respuesta que no salen de los reportes (ni de su comparación, si son dos y
//       comparables). Sale con código 1 si hay alguna.
//   node dist/experiments/skill-eval.js recall <respuesta.md>
//       Cuáles de los 7 problemas de demo/site/ISSUES.md menciona la respuesta.
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { compareReports } from '../compare.js';
import { UsageError } from '../errors.js';
import { ReportSchema, type Report } from '../schema.js';

const KIB = 1024;
const MIB = 1024 * 1024;

/** Los 7 problemas catalogados (`demo/site/ISSUES.md`) y las marcas con que una respuesta los nombra. */
export const DEMO_ISSUES: readonly { n: number; name: string; markers: RegExp }[] = [
  { n: 1, name: 'Imagen hero enorme', markers: /image-delivery-insight|hero\.jpg|srcset/i },
  {
    n: 2,
    name: 'Imágenes sin width/height (CLS)',
    markers: /unsized-images|cls-culprits-insight/i,
  },
  { n: 3, name: 'CSS y JS bloqueantes', markers: /render-blocking(-insight|-resources)?/i },
  { n: 4, name: 'Librería JS sin usar', markers: /unused-javascript/i },
  { n: 5, name: 'Fuentes sin font-display', markers: /font-display/i },
  { n: 6, name: 'Imágenes sin loading="lazy"', markers: /loading=["']?lazy|lazy[- ]?load/i },
  {
    n: 7,
    name: 'Tarea larga en el hilo principal (TBT)',
    markers: /bootup-time|mainthread-work-breakdown|long-tasks?/i,
  },
];

export interface RecallResult {
  found: number[];
  missing: number[];
}

export function recallOf(markdown: string): RecallResult {
  const found = DEMO_ISSUES.filter((i) => i.markers.test(markdown)).map((i) => i.n);
  const missing = DEMO_ISSUES.filter((i) => !found.includes(i.n)).map((i) => i.n);
  return { found, missing };
}

/** Todos los números del JSON (hojas) más los derivados que una respuesta suele mostrar. */
export function allowedValues(source: unknown): Set<number> {
  const raw = new Set<number>();
  const walk = (node: unknown): void => {
    if (typeof node === 'number' && Number.isFinite(node)) raw.add(Math.abs(node));
    else if (typeof node === 'string') {
      // Cifras dentro de textos de Lighthouse (`displayValue`: "20 long tasks found").
      for (const n of extractNumbers(node)) for (const r of n.readings) raw.add(r.value);
    } else if (Array.isArray(node)) {
      raw.add(node.length);
      node.forEach(walk);
    } else if (node !== null && typeof node === 'object') Object.values(node).forEach(walk);
  };
  walk(source);

  // Constantes de conversión que una respuesta cita al explicar sus unidades.
  const all = new Set<number>([KIB, 1000, MIB]);
  for (const v of raw) {
    all.add(v);
    all.add(v / 1000); // ms → s
    all.add(v / KIB);
    all.add(v / MIB);
    all.add(v * 100); // fracción → %
    all.add(v / 1000 / KIB); // KB decimales
  }
  return all;
}

const MAX_UNITLESS = 10;
const UNIT = /^\s*(ms|s\b|kib|mib|kb|mb|b\b|%|puntos|bytes)/i;

/** ¿Algún valor permitido se redondea a `n` con sus decimales? */
function matches(n: number, decimals: number, allowed: Set<number>): boolean {
  const tolerance = 0.5 * 10 ** -decimals + 1e-9;
  for (const v of allowed) if (Math.abs(v - n) <= tolerance) return true;
  return false;
}

/** Quita lo que lleva dígitos pero no es una cifra medida: ids, fechas, commits, versiones, enlaces. */
function stripNonMeasures(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\d{4}-\d{2}-\d{2}T[\d-]+Z(-\w+)?/g, ' ') // ids de reporte
    .replace(/\b\d{2}[-:]\d{2}[-:]\d{2}Z\b/g, ' ') // ids abreviados (`19-42-38Z`) y horas
    .replace(/\S*(?:[?&]\w+=|\/[\w.-]*\d[\w.-]*\/|\/[\w.-]*\d[\w.*-]*\.\w+)\S*/g, ' ') // URLs, rutas y chunks
    .replace(/\b\d+-\*\.\w+/g, ' ') // chunks `709-*.js`
    .replace(/\d{4}-\d{2}-\d{2}/g, ' ') // fechas
    .replace(/\b[0-9a-f]{7,40}\b/g, ' ') // commits
    .replace(/\bv?\d+\.\d+\.\d+(\.\d+)?\b/g, ' ') // versiones
    .replace(/:\d{4}\b/g, ' ') // puertos
    .replace(/\]\([^)]*\)/g, ']') // destinos de enlaces
    .replace(/`[^`]*[a-z][^`]*-[^`]*`/gi, ' ') // ids como `lcp-discovery-insight`
    .replace(/\b[\w.-]*\d[\w.-]*\.(jpg|js|css|woff2|html|png|json|md)\b/gi, ' ') // nombres de fichero
    .replace(/\b(?:lighthouse|chrome)\s+\d+\b/gi, ' ')
    .replace(/\b[qw]=\d+\b/g, ' ') // parámetros que se proponen (`q=75`), no medidas
    .replace(/\bcore web vitals\b/gi, ' ')
    .replace(/^\s*\d+[.)]\s/gm, ' ') // listas numeradas
    .replace(/^\|\s*\d+\s*\|/gm, '| ') // columna "#" de tablas
    .replace(/(?<![\d.,])#\d+\b/g, ' ') // "#3"
    .replace(/^#{1,6}\s*\d+\.\s/gm, ' ') // "### 1. Título"
    .replace(/\bphase \d+|\bfase \d+/gi, ' ');
}

/** Números con formato español (`40 728`, `2.495`, `0,291`) o inglés (`2,495`, `0.291`). */
const NUMBER = /(?<![\w.,])[−-]?\d{1,3}(?:[\s\u00a0.,]\d{3})+(?:[.,]\d+)?|[−-]?\d+(?:[.,]\d+)?/g;

interface Reading {
  value: number;
  decimals: number;
}

export interface ParsedNumber {
  text: string;
  /** Lecturas posibles: `2,495` es 2495 (miles) o 2,495 (decimal). */
  readings: Reading[];
  unit: boolean;
}

function readNumber(token: string): Reading[] {
  const t = token.replace(/^[−-]/, '');
  const groups = t.split(/[\s\u00a0.,]/);
  const lastDecimals = groups.at(-1)?.length ?? 0;
  const asDecimal = (): Reading => ({
    value: Number(t.replace(/[,]/, '.')),
    decimals: lastDecimals,
  });
  const asThousands = (): Reading => ({ value: Number(groups.join('')), decimals: 0 });

  if (groups.length === 1) return [{ value: Number(t), decimals: 0 }];
  // Mezcla de miles y decimales (`1 234,5`, `1.234,56`): el último grupo es la parte decimal.
  if (groups.length > 2 && lastDecimals !== 3) {
    return [
      {
        value: Number(`${groups.slice(0, -1).join('')}.${groups.at(-1)}`),
        decimals: lastDecimals,
      },
    ];
  }
  const thousandsLike = groups.slice(1).every((g) => g.length === 3);
  if (!thousandsLike) return [asDecimal()];
  if (/[\s\u00a0]/.test(t) || groups.length > 2) return [asThousands()];
  // Un solo separador y tres dígitos detrás: ambiguo, salvo `0,291` (decimal).
  return groups[0] === '0' ? [asDecimal()] : [asThousands(), asDecimal()];
}

/** Marca con la que una respuesta declara que una cifra no sale del CLI: código, fichero, curl o un cálculo propio. */
export const CODE_SOURCE_MARK = /fuente:\s*(código|fichero|curl|cálculo|page-check)/i;

export function extractNumbers(markdown: string): ParsedNumber[] {
  const text = stripNonMeasures(markdown);
  const out: ParsedNumber[] = [];
  for (const m of text.matchAll(NUMBER)) {
    const token = m[0];
    const after = text.slice(m.index + token.length, m.index + token.length + 12);
    out.push({ text: token, readings: readNumber(token), unit: UNIT.test(after) });
  }
  return out;
}

/**
 * Cifras de `markdown` que no salen de `source`. Un entero pequeño sin unidad (≤ 10) se admite
 * como recuento o numeración; con unidad (`3 s`, `5 puntos`), no. Las líneas marcadas con
 * "fuente: código" (o "fichero") se excluyen: declaran que la cifra viene de leer el repo.
 */
export function unverifiedFigures(markdown: string, source: unknown): string[] {
  const allowed = allowedValues(source);
  const measured = markdown
    .split('\n')
    .filter((line) => !CODE_SOURCE_MARK.test(line))
    .join('\n');
  return extractNumbers(measured)
    .filter(
      (n) => !(!n.unit && n.readings.every((r) => r.decimals === 0 && r.value <= MAX_UNITLESS)),
    )
    .filter((n) => !n.readings.some((r) => matches(r.value, r.decimals, allowed)))
    .map((n) => n.text);
}

function tryCompare(a: Report, b: Report): unknown {
  try {
    return compareReports(a, b);
  } catch (error) {
    if (error instanceof UsageError) return undefined; // distinto device, red o throttling
    throw error;
  }
}

async function loadReport(path: string): Promise<Report> {
  return ReportSchema.parse(JSON.parse(await readFile(path, 'utf8')));
}

if (import.meta.main) {
  const { positionals } = parseArgs({ allowPositionals: true });
  const [command, file, ...reports] = positionals;
  if (command === 'figures' && file && reports.length >= 1) {
    const loaded = await Promise.all(reports.map(loadReport));
    const [a, b] = loaded;
    // Con dos reportes comparables también valen las cifras de su comparación.
    const comparison = loaded.length === 2 && a && b ? tryCompare(a, b) : undefined;
    const source = comparison ? [...loaded, comparison] : loaded;
    const bad = unverifiedFigures(await readFile(file, 'utf8'), source);
    console.log(
      bad.length === 0 ? 'Todas las cifras salen del JSON.' : `Sin origen: ${bad.join(', ')}`,
    );
    process.exitCode = bad.length === 0 ? 0 : 1;
  } else if (command === 'recall' && file && reports.length === 0) {
    const { found, missing } = recallOf(await readFile(file, 'utf8'));
    console.log(
      `Recall ${found.length}/${DEMO_ISSUES.length}; faltan: ${missing.join(', ') || '-'}`,
    );
  } else {
    console.error(
      'Uso: skill-eval figures <respuesta.md> <reporte.json>... | recall <respuesta.md>',
    );
    process.exitCode = 2;
  }
}
