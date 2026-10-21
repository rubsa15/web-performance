/** Dependencias de los comandos que solo leen `.perf/` (`compare` e `history`). */
export interface ReadDeps {
  /** Carpeta que contiene `.perf/`. */
  baseDir: string;
  /** Salida del resultado (stdout). */
  out: (text: string) => void;
  /** Mensajes auxiliares (stderr), para que stdout quede limpio con `--format json`. */
  log: (text: string) => void;
  color: boolean;
}

export function defaultReadDeps(): ReadDeps {
  return {
    baseDir: process.cwd(),
    out: (text) => process.stdout.write(`${text}\n`),
    log: (text) => process.stderr.write(`${text}\n`),
    color: Boolean(process.stdout.isTTY) && !process.env['NO_COLOR'],
  };
}
