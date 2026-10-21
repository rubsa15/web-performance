import { UsageError } from '../errors.js';
import { getGitInfo, type GitInfo } from '../git.js';
import { normalize } from '../normalizer.js';
import { render, type Format } from '../render.js';
import { runAudit } from '../runner.js';
import type { Device } from '../schema.js';
import { saveRawLhrs, saveReport } from '../store.js';

export interface AuditOptions {
  device: Device;
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

export async function auditCommand(
  urlArg: string,
  options: AuditOptions,
  deps: AuditDeps = defaultAuditDeps(),
): Promise<void> {
  const url = parseUrl(urlArg);
  deps.log(
    `Auditando ${url} (${options.device}, ${options.runs} ${options.runs === 1 ? 'ejecución' : 'ejecuciones'})…`,
  );

  const lhrs = await deps.run({
    url,
    device: options.device,
    runs: options.runs,
    onProgress: (run, total) => deps.log(`  ejecución ${run}/${total}`),
  });

  const git = await deps.git(deps.baseDir);
  const report = normalize(lhrs, {
    url,
    device: options.device,
    label: options.label,
    createdAt: deps.now(),
    git,
  });

  if (options.save) deps.log(`Reporte guardado en ${await saveReport(deps.baseDir, report)}`);
  if (options.keepRaw) {
    const paths = await saveRawLhrs(deps.baseDir, report, lhrs);
    deps.log(`LHR crudos guardados en ${paths.length} ficheros de .perf/raw/`);
  }

  deps.out(render(report, options.format, { color: deps.color }));
}
