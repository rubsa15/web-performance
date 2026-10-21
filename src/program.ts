import { Command, InvalidArgumentError, Option } from 'commander';
import {
  auditCommand,
  defaultAuditDeps,
  type AuditDeps,
  type AuditOptions,
} from './commands/audit.js';
import { DEVICES } from './schema.js';

export const EXIT_CODES = {
  ok: 0,
  budgetExceeded: 1,
  usage: 2,
  runtime: 3,
} as const;

function parsePositiveInt(value: string): number {
  if (!/^\d+$/.test(value) || Number(value) < 1) {
    throw new InvalidArgumentError('Debe ser un entero mayor que 0.');
  }
  return Number(value);
}

export function buildProgram(auditDeps?: AuditDeps): Command {
  const program = new Command()
    .name('wperf')
    .description('Audita el rendimiento de una web, prioriza mejoras y compara auditorías.')
    .version('1.0.0', '-v, --version')
    .exitOverride()
    .configureOutput({ outputError: (str, write) => write(str) });

  program
    .command('audit')
    .description('Audita una URL con Lighthouse, guarda el reporte y muestra resumen y mejoras.')
    .argument('<url>', 'URL pública (http o https) a auditar')
    .addOption(
      new Option('--device <device>', 'perfil de emulación').choices(DEVICES).default('mobile'),
    )
    .option('--runs <n>', 'ejecuciones de Lighthouse; se usa la mediana', parsePositiveInt, 3)
    .option('--label <txt>', 'etiqueta libre para identificar la auditoría')
    .option('--no-save', 'no guardar el reporte en .perf/reports/')
    .addOption(
      new Option('--keep-raw', 'guardar también los LHR crudos en .perf/raw/').conflicts('save'),
    )
    .addOption(
      new Option('--format <format>', 'formato de salida')
        .choices(['text', 'json', 'md'])
        .default('text'),
    )
    .action((url: string, options: AuditOptions) =>
      auditCommand(url, options, auditDeps ?? defaultAuditDeps()),
    );

  return program;
}
