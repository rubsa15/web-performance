import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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
