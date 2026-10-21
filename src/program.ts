import { Command, InvalidArgumentError, Option } from 'commander';
import {
  auditCommand,
  defaultAuditDeps,
  type AuditDeps,
  type AuditOptions,
} from './commands/audit.js';
import { compareCommand, type CompareOptions } from './commands/compare.js';
import { historyCommand, type HistoryOptions } from './commands/history.js';
import type { ReadDeps } from './commands/read-deps.js';
import { DEVICES, METRIC_IDS, NETWORKS } from './schema.js';

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

const FORMATS = ['text', 'json', 'md'] as const;

const formatOption = (): Option =>
  new Option('--format <format>', 'formato de salida').choices(FORMATS).default('text');

export function buildProgram(auditDeps?: AuditDeps, readDeps?: ReadDeps): Command {
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
    .addOption(
      new Option(
        '--network <network>',
        'perfil de red: default (el del dispositivo), 3g (300 ms, 700 Kbps) o 4g (40 ms, 10 Mbps)',
      )
        .choices(NETWORKS)
        .default('default'),
    )
    .option('--runs <n>', 'ejecuciones de Lighthouse; se usa la mediana', parsePositiveInt, 3)
    .option('--label <txt>', 'etiqueta libre para identificar la auditoría')
    .option('--no-save', 'no guardar el reporte en .perf/reports/')
    .addOption(
      new Option('--keep-raw', 'guardar también los LHR crudos en .perf/raw/').conflicts('save'),
    )
    .addOption(formatOption())
    .action((url: string, options: AuditOptions) =>
      auditCommand(url, options, auditDeps ?? defaultAuditDeps()),
    );

  program
    .command('compare')
    .description(
      'Compara dos reportes y clasifica cada cambio como improved, regressed o unchanged (ruido).',
    )
    .argument('[a]', 'reporte "antes" (ruta o id)')
    .argument('[b]', 'reporte "después" (ruta o id)')
    .option('--url <url>', 'sin reportes explícitos: compara los dos últimos de esta URL')
    .addOption(
      new Option(
        '--network <network>',
        'sin reportes explícitos: solo reportes de este perfil de red',
      ).choices(NETWORKS),
    )
    .addOption(formatOption())
    .action((a: string | undefined, b: string | undefined, options: CompareOptions) =>
      compareCommand(a, b, options, readDeps),
    );

  program
    .command('history')
    .description('Lista las auditorías guardadas de una URL y la evolución de sus métricas.')
    .argument('<url>', 'URL cuyas auditorías se listan')
    .addOption(new Option('--device <device>', 'solo este dispositivo').choices(DEVICES))
    .addOption(new Option('--network <network>', 'solo este perfil de red').choices(NETWORKS))
    .addOption(
      new Option('--metric <metric>', 'centra la salida en una métrica').choices(METRIC_IDS),
    )
    .addOption(formatOption())
    .action((url: string, options: HistoryOptions) => historyCommand(url, options, readDeps));

  return program;
}
