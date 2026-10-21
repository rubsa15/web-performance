import { describe, expect, it, vi } from 'vitest';
import { RuntimeError } from '../src/errors.js';
import { runAudit, type RunnerDeps } from '../src/runner.js';

function fakeDeps(runLighthouse: RunnerDeps['runLighthouse']) {
  const kill = vi.fn(async () => {});
  const deps: RunnerDeps = {
    launchChrome: async () => ({ port: 9222, kill }),
    runLighthouse,
  };
  return { deps, kill };
}

describe('runAudit', () => {
  it('pasa el perfil de red a Lighthouse', async () => {
    const run = vi.fn<RunnerDeps['runLighthouse']>(async () => ({ lhr: 1 }));
    const { deps } = fakeDeps(run);
    await runAudit({ url: 'https://example.com/', device: 'mobile', network: '3g', runs: 1 }, deps);
    expect(run).toHaveBeenCalledWith('https://example.com/', 'mobile', 9222, '3g');
  });

  it('ejecuta Lighthouse N veces con el perfil y el puerto y cierra Chrome', async () => {
    const run = vi.fn<RunnerDeps['runLighthouse']>(async () => ({ lhr: 1 }));
    const { deps, kill } = fakeDeps(run);
    const progress = vi.fn();

    const lhrs = await runAudit(
      { url: 'https://example.com/', device: 'desktop', runs: 3, onProgress: progress },
      deps,
    );

    expect(lhrs).toHaveLength(3);
    expect(run).toHaveBeenCalledTimes(3);
    expect(run).toHaveBeenCalledWith('https://example.com/', 'desktop', 9222, 'default');
    expect(progress.mock.calls).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
    expect(kill).toHaveBeenCalledOnce();
  });

  it('cierra Chrome y envuelve el error si una ejecución falla', async () => {
    const run = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('timeout'));
    const { deps, kill } = fakeDeps(run);

    await expect(
      runAudit({ url: 'https://example.com/', device: 'mobile', runs: 3 }, deps),
    ).rejects.toThrow(new RuntimeError('Lighthouse falló en la ejecución 2/3: timeout'));
    expect(run).toHaveBeenCalledTimes(2);
    expect(kill).toHaveBeenCalledOnce();
  });

  it('propaga tal cual los RuntimeError', async () => {
    const { deps } = fakeDeps(async () => {
      throw new RuntimeError('sin resultado');
    });
    await expect(
      runAudit({ url: 'https://example.com/', device: 'mobile', runs: 1 }, deps),
    ).rejects.toThrow('sin resultado');
  });
});
