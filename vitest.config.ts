import { configDefaults, defineConfig } from 'vitest/config';

// Los tests `*.slow.test.ts` lanzan Chrome real: solo corren con `npm run test:slow`.
const runSlow = process.env['WPERF_SLOW'] === '1';

export default defineConfig({
  test: {
    exclude: runSlow ? configDefaults.exclude : [...configDefaults.exclude, '**/*.slow.test.ts'],
    testTimeout: runSlow ? 180_000 : 5_000,
  },
});
