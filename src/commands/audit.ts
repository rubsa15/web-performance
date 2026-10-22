import { RuntimeError, UsageError } from '../errors.js';
import { getGitInfo, type GitInfo } from '../git.js';
import { normalize } from '../normalizer.js';
import { render, type Format } from '../render.js';
import { runAudit } from '../runner.js';
import type { Device, Network, Report } from '../schema.js';
import { saveRawLhrs, saveReport } from '../store.js';

export interface AuditOptions {
  /** Uno o varios: se audita cada combinación dispositivo × red, en serie. */
  device: Device[];
  network: Network[];
  runs: number;
  label?: string;
  save: boolean;
  keepRaw: boolean;
  format: Format;
}

export interface AuditDeps {
  run: typeof runAudit;
  git: (cwd: string) => Promise<GitInfo | undefined>;
  now: () => Date;
  /** Carpeta que contiene `.perf/`. */
  baseDir: string;
  /** Salida del resultado (stdout). */
  out: (text: string) => void;
  /** Progreso y rutas guardadas (stderr), para que stdout quede limpio con `--format json`. */
  log: (text: string) => void;
  color: boolean;
}

export function defaultAuditDeps(): AuditDeps {
  return {
    run: runAudit,
    git: getGitInfo,
    now: () => new Date(),
    baseDir: process.cwd(),
    out: (text) => process.stdout.write(`${text}\n`),
    log: (text) => process.stderr.write(`${text}\n`),
    color: Boolean(process.stdout.isTTY) && !process.env['NO_COLOR'],
  };
}

export function parseUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new UsageError(`"${input}" no es una URL válida (usa http:// o https://).`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UsageError(`Solo se auditan URLs http(s); recibido "${url.protocol}".`);
  }
  return url.href;
}

interface Profile {
  device: Device;
  network: Network;
}

/**
 * Audita la URL en cada perfil (dispositivo × red), uno detrás de otro: dos Chrome a la vez
 * compiten por la CPU y falsean las métricas. Con un solo perfil la salida es la de siempre; con
 * varios, el progreso lleva el prefijo `[dispositivo/red]`, un perfil que falla no detiene los
 * demás y, si alguno falló, termina con `RuntimeError` después de escribir los que sí se midieron.
 */
export async function auditCommand(
  urlArg: string,
  options: AuditOptions,
  deps: AuditDeps = defaultAuditDeps(),
): Promise<void> {
  const url = parseUrl(urlArg);
  const profiles = options.device.flatMap((device) =>
    options.network.map((network): Profile => ({ device, network })),
  );

  if (profiles.length === 1) {
    const report = await auditProfile(url, profiles[0]!, options, deps, deps.log);
    deps.out(render(report, options.format, { color: deps.color }));
    return;
  }

  const reports: Report[] = [];
  const failed: string[] = [];
  for (const profile of profiles) {
    const name = `${profile.device}/${profile.network}`;
    const log = (text: string): void => deps.log(`[${name}] ${text.trimStart()}`);
    try {
      reports.push(await auditProfile(url, profile, options, deps, log));
    } catch (error) {
      if (error instanceof UsageError) throw error;
      log(`Error: ${error instanceof Error ? error.message : String(error)}`);
      failed.push(name);
    }
  }
  deps.log(
    `Terminado: ${reports.length} de ${profiles.length} perfiles medidos${failed.length > 0 ? `; fallaron ${failed.join(', ')}` : ''}.`,
  );

  if (reports.length > 0) deps.out(renderMany(reports, options.format, deps.color));
  if (failed.length > 0) {
    throw new RuntimeError(
      `Fallaron ${failed.length} de ${profiles.length} perfiles: ${failed.join(', ')}.`,
    );
  }
}

async function auditProfile(
  url: string,
  { device, network }: Profile,
  options: AuditOptions,
  deps: AuditDeps,
  log: (text: string) => void,
): Promise<Report> {
  log(
    `Auditando ${url} (${device}${network === 'default' ? '' : `, red ${network}`}, ${options.runs} ${options.runs === 1 ? 'ejecución' : 'ejecuciones'})…`,
  );

  const lhrs = await deps.run({
    url,
    device,
    network,
    runs: options.runs,
    onProgress: (run, total) => log(`  ejecución ${run}/${total}`),
  });

  const git = await deps.git(deps.baseDir);
  const report = normalize(lhrs, {
    url,
    device,
    network,
    label: options.label,
    createdAt: deps.now(),
    git,
  });

  if (options.save) log(`Reporte guardado en ${await saveReport(deps.baseDir, report)}`);
  if (options.keepRaw) {
    const paths = await saveRawLhrs(deps.baseDir, report, lhrs);
    log(`LHR crudos guardados en ${paths.length} ficheros de .perf/raw/`);
  }
  return report;
}

/** Varios reportes: un array en JSON; en texto y Markdown, uno detrás de otro. */
function renderMany(reports: Report[], format: Format, color: boolean): string {
  if (format === 'json') return JSON.stringify(reports, null, 2);
  const separator = format === 'md' ? '\n\n---\n\n' : '\n\n';
  return reports.map((r) => render(r, format, { color })).join(separator);
}
