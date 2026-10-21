import { Command } from 'commander';

export const EXIT_CODES = {
  ok: 0,
  budgetExceeded: 1,
  usage: 2,
  runtime: 3,
} as const;

export function buildProgram(): Command {
  return new Command()
    .name('wperf')
    .description('Audita el rendimiento de una web, prioriza mejoras y compara auditorías.')
    .version('1.0.0', '-v, --version')
    .exitOverride()
    .configureOutput({ outputError: (str, write) => write(str) });
}
