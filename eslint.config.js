import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['dist/', 'node_modules/', '.perf/', 'coverage/']),
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
);
