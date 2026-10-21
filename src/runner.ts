import { launch, type LaunchedChrome } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { RuntimeError } from './errors.js';
import type { Device } from './schema.js';

export interface RunOptions {
  url: string;
  device: Device;
  runs: number;
  onProgress?: (run: number, total: number) => void;
}

/** Costuras para sustituir Chrome y Lighthouse en los tests. */
export interface RunnerDeps {
  launchChrome: () => Promise<Pick<LaunchedChrome, 'port' | 'kill'>>;
  runLighthouse: (url: string, device: Device, port: number) => Promise<unknown>;
}

async function launchChrome(): Promise<LaunchedChrome> {
  try {
    return await launch({ chromeFlags: ['--headless=new'] });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new RuntimeError(
      `No se pudo iniciar Chrome: ${detail}\nInstala Chrome o indica su ruta con CHROME_PATH.`,
    );
  }
}

async function runLighthouse(url: string, device: Device, port: number): Promise<unknown> {
  const flags = {
    port,
    output: 'json' as const,
    logLevel: 'error' as const,
    onlyCategories: ['performance'],
  };
  const result = await lighthouse(url, flags, device === 'desktop' ? desktopConfig : undefined);
  if (!result) throw new RuntimeError('Lighthouse no devolvió ningún resultado.');
  return result.lhr;
}

const defaultDeps: RunnerDeps = { launchChrome, runLighthouse };

/**
 * Lanza Chrome una vez y ejecuta Lighthouse `runs` veces seguidas sobre la URL.
 * Devuelve los LHR crudos; interpretarlos es trabajo del normalizer.
 */
export async function runAudit(
  options: RunOptions,
  deps: RunnerDeps = defaultDeps,
): Promise<unknown[]> {
  const chrome = await deps.launchChrome();
  const lhrs: unknown[] = [];
  try {
    for (let run = 1; run <= options.runs; run++) {
      options.onProgress?.(run, options.runs);
      try {
        lhrs.push(await deps.runLighthouse(options.url, options.device, chrome.port));
      } catch (error) {
        if (error instanceof RuntimeError) throw error;
        const detail = error instanceof Error ? error.message : String(error);
        throw new RuntimeError(
          `Lighthouse falló en la ejecución ${run}/${options.runs}: ${detail}`,
        );
      }
    }
  } finally {
    await chrome.kill();
  }
  return lhrs;
}
