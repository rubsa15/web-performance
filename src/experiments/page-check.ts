// Evaluación de `perf-fix`: ¿la página sigue funcionando tras un arreglo?
//
//   node dist/experiments/page-check.js snapshot <url> <salida.json> [captura.png]
//       Abre la URL en Chrome (viewport móvil), recorre la página para disparar la carga diferida y
//       guarda texto visible, imágenes, errores de consola, peticiones fallidas y el tamaño del
//       índice de búsqueda de la demo.
//   node dist/experiments/page-check.js diff <antes.json> <después.json>
//       Lista lo que se ha roto entre dos instantáneas. Sale con código 1 si hay algo.
//
// No juzga el aspecto: la captura se revisa a mano. Comprueba invariantes que un arreglo de
// rendimiento no debe cambiar (el contenido, que todo cargue y que el JS siga haciendo su trabajo).
import { writeFile } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { launch } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

export interface PageSnapshot {
  url: string;
  title: string;
  /** `innerText` del body con los espacios normalizados. */
  text: string;
  images: { src: string; loaded: boolean }[];
  consoleErrors: string[];
  failedRequests: string[];
  /** Longitud de `window.searchIndex` (la demo lo construye tras el primer pintado); `null` si no existe. */
  searchIndexLength: number | null;
}

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

async function load(path: string): Promise<PageSnapshot> {
  return JSON.parse(await readFile(path, 'utf8')) as PageSnapshot;
}

if (import.meta.main) {
  const [command, a, b, c] = process.argv.slice(2);
  if (command === 'snapshot' && a && b) {
    const snapshot = await takeSnapshot(a, c);
    await writeFile(b, `${JSON.stringify(snapshot, null, 2)}\n`);
    console.log(
      `${snapshot.images.length} imágenes, ${snapshot.consoleErrors.length} errores de consola, ` +
        `${snapshot.failedRequests.length} peticiones fallidas, índice: ${snapshot.searchIndexLength ?? 'ausente'}`,
    );
  } else if (command === 'diff' && a && b) {
    const problems = pageRegressions(await load(a), await load(b));
    console.log(problems.length === 0 ? 'La página sigue íntegra.' : problems.join('\n'));
    process.exitCode = problems.length === 0 ? 0 : 1;
  } else {
    console.error(
      'Uso: page-check snapshot <url> <salida.json> [captura.png] | diff <antes.json> <después.json>',
    );
    process.exitCode = 2;
  }
}
