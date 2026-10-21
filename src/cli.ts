import { CommanderError } from 'commander';
import { buildProgram, EXIT_CODES } from './program.js';

try {
  await buildProgram().parseAsync(process.argv);
} catch (error) {
  if (error instanceof CommanderError) {
    process.exitCode = error.exitCode === 0 ? EXIT_CODES.ok : EXIT_CODES.usage;
  } else {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = EXIT_CODES.runtime;
  }
}
