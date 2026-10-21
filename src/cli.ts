import { CommanderError } from 'commander';
import { UsageError } from './errors.js';
import { buildProgram, EXIT_CODES } from './program.js';

try {
  await buildProgram().parseAsync(process.argv);
} catch (error) {
  if (error instanceof CommanderError) {
    process.exitCode = error.exitCode === 0 ? EXIT_CODES.ok : EXIT_CODES.usage;
  } else if (error instanceof UsageError) {
    console.error(error.message);
    process.exitCode = EXIT_CODES.usage;
  } else {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = EXIT_CODES.runtime;
  }
}
