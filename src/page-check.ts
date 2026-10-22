// Comprobación de integridad de la página (`wperf check`): ¿sigue funcionando tras un arreglo?
//
// `takeSnapshot` abre la URL en Chrome (viewport móvil), recorre la página para disparar la carga
// diferida y recoge texto visible, imágenes, errores de consola y peticiones fallidas.
// `pageRegressions` lista lo que se ha roto entre dos instantáneas.
//
// No juzga el aspecto: la captura se revisa a mano. Comprueba invariantes que un arreglo de
// rendimiento no debe cambiar (el contenido, que todo cargue y que el JS siga haciendo su trabajo).
import { launch } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import { z } from 'zod';

export const PageSnapshotSchema = z.object({
  url: z.string(),
  title: z.string(),
  /** `innerText` del body con los espacios normalizados. */
  text: z.string(),
  images: z.array(z.object({ src: z.string(), loaded: z.boolean() })),
  consoleErrors: z.array(z.string()),
  failedRequests: z.array(z.string()),
  /** Longitud de `window.searchIndex` (la demo lo construye tras el primer pintado); `null` si no existe. */
  searchIndexLength: z.number().nullable(),
});

export type PageSnapshot = z.infer<typeof PageSnapshotSchema>;

interface BrowserData {
  title: string;
  text: string;
  images: PageSnapshot['images'];
  searchIndexLength: number | null;
}

/** Quita el origen: antes y después pueden servirse en puertos distintos. */
const withoutOrigin = (text: string): string => text.replace(/https?:\/\/[^/\s]+/g, '');

const normalize = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** Diferencias que indican que el arreglo rompió algo; vacío si la página sigue igual de sana. */
export function pageRegressions(before: PageSnapshot, after: PageSnapshot): string[] {
  const problems: string[] = [];
  if (before.title !== after.title)
    problems.push(`El título cambió: "${before.title}" → "${after.title}"`);
  if (before.text !== after.text) problems.push('El texto visible de la página cambió');

  const broken = after.images.filter((i) => !i.loaded).map((i) => i.src);
  if (broken.length > 0) problems.push(`Imágenes que no cargan: ${broken.join(', ')}`);
  if (after.images.length < before.images.length) {
    problems.push(`Hay menos imágenes: ${before.images.length} → ${after.images.length}`);
  }

  const knownErrors = new Set(before.consoleErrors.map(withoutOrigin));
  for (const e of after.consoleErrors.filter((e) => !knownErrors.has(withoutOrigin(e)))) {
    problems.push(`Error de consola nuevo: ${e}`);
  }
  const knownFailures = new Set(before.failedRequests.map(withoutOrigin));
  for (const f of after.failedRequests.filter((f) => !knownFailures.has(withoutOrigin(f)))) {
    problems.push(`Petición fallida nueva: ${f}`);
  }
  if (before.searchIndexLength !== after.searchIndexLength) {
    problems.push(
      `El índice de búsqueda cambió: ${before.searchIndexLength ?? 'ausente'} → ${after.searchIndexLength ?? 'ausente'}`,
    );
  }
  return problems;
}

/** Abre `url`, recorre la página de arriba abajo y recoge la instantánea. */
export async function takeSnapshot(url: string, screenshotPath?: string): Promise<PageSnapshot> {
  const chrome = await launch({ chromeFlags: ['--headless=new'] });
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 412, height: 823, deviceScaleFactor: 1, isMobile: true });
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('pageerror', (e) => consoleErrors.push(String(e)));
    page.on('requestfailed', (r) => failedRequests.push(r.url()));
    page.on('response', (r) => {
      if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`);
    });

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60_000 });
    // La carga diferida (`loading="lazy"`) solo dispara al acercarse: recorre la página.
    // El código del navegador va como texto: el proyecto no incluye los tipos del DOM.
    await page.evaluate(`(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 300) {
        window.scrollTo(0, y);
        await new Promise((done) => setTimeout(done, 100));
      }
      window.scrollTo(0, 0);
    })()`);
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 30_000 });
    // El índice de búsqueda de la demo se construye tras el primer pintado y tarda 1–2 s.
    await page
      .waitForFunction("'searchIndex' in window", { timeout: 15_000 })
      .catch(() => undefined);

    const data = (await page.evaluate(`({
      title: document.title,
      text: document.body.innerText,
      images: [...document.images].map((img) => ({
        src: img.currentSrc || img.src,
        loaded: img.complete && img.naturalWidth > 0,
      })),
      searchIndexLength: Array.isArray(window.searchIndex) ? window.searchIndex.length : null,
    })`)) as BrowserData;
    if (screenshotPath)
      await page.screenshot({ path: screenshotPath as `${string}.png`, fullPage: true });
    return {
      url,
      title: data.title,
      text: normalize(data.text),
      images: data.images,
      consoleErrors,
      failedRequests,
      searchIndexLength: data.searchIndexLength,
    };
  } finally {
    await browser.disconnect();
    chrome.kill();
  }
}
