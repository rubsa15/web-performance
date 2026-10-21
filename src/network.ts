import type { Network } from './schema.js';

/**
 * Parámetros de red de la simulación de Lighthouse (`throttlingMethod: simulate`) para cada perfil.
 * `default` no define nada: manda el del dispositivo. La CPU tampoco se toca, así que cada perfil
 * conserva la ralentización de su dispositivo (4× en mobile, 1× en desktop).
 *
 * Valores de `lighthouse/core/config/constants.js`: `3g` = `mobileRegular3G`, `4g` = `desktopDense4G`.
 */
export const NETWORK_PRESETS: Record<
  Network,
  { rttMs: number; throughputKbps: number } | undefined
> = {
  default: undefined,
  '3g': { rttMs: 300, throughputKbps: 700 },
  '4g': { rttMs: 40, throughputKbps: 10240 },
};
