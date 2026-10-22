// Servidor estático de la demo: `node demo/serve.ts [site|site-fixed] [--port 4173] [--latency 300] [--root <dir>]`.
// Sirve texto comprimido (gzip) y cabeceras de caché largas para que los únicos problemas que
// detecte Lighthouse sean los catalogados en demo/site/ISSUES.md. La latencia (ms) se aplica solo a
// imágenes y fuentes, como si vinieran de un CDN: sin ella en localhost llegarían antes del primer
// pintado y ni el CLS ni el retraso de las fuentes serían reproducibles.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.svg']);
const DELAYED = new Set(['.jpg', '.woff2']);

export interface DemoOptions {
  /** Carpeta de `demo/` que se sirve. */
  site: 'site' | 'site-fixed';
  /** Puerto; 0 deja que el sistema elija uno libre. */
  port: number;
  /** Latencia (ms) añadida a imágenes y fuentes. */
  latency: number;
  /** Carpeta absoluta a servir en lugar de `site` (copias de trabajo de la evaluación de `perf-fix`). */
  root?: string;
}

export function startDemoServer({ site, port, latency, root: dir }: DemoOptions): Promise<Server> {
  const root = dir ? resolve(dir) : resolve(import.meta.dirname, site);

  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
      const relative = normalize(pathname.endsWith('/') ? `${pathname}index.html` : pathname);
      const file = join(root, relative);
      if (!file.startsWith(root + sep)) {
        res.writeHead(403).end('Forbidden');
        return;
      }
      const info = await stat(file);
      if (!info.isFile()) throw new Error('not a file');

      const ext = extname(file);
      if (latency > 0 && DELAYED.has(ext)) await new Promise((done) => setTimeout(done, latency));

      const headers: Record<string, string> = {
        'content-type': MIME[ext] ?? 'application/octet-stream',
        'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
      };
      if (COMPRESSIBLE.has(ext) && String(req.headers['accept-encoding']).includes('gzip')) {
        res.writeHead(200, { ...headers, 'content-encoding': 'gzip', vary: 'accept-encoding' });
        await pipeline(createReadStream(file), createGzip(), res);
      } else {
        res.writeHead(200, { ...headers, 'content-length': String(info.size) });
        await pipeline(createReadStream(file), res);
      }
    } catch {
      if (!res.headersSent) res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('Not found');
    }
  });

  return new Promise((done) => server.listen(port, '127.0.0.1', () => done(server)));
}

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

// Solo arranca al ejecutarlo directamente, no al importarlo desde los tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  const site = arg === 'site-fixed' ? 'site-fixed' : 'site';
  const port = Number(option('port', site === 'site-fixed' ? '4174' : '4173'));
  const latency = Number(option('latency', '300'));
  const root = process.argv.includes('--root') ? option('root', '') : undefined;
  const server = await startDemoServer({ site, port, latency, ...(root && { root }) });
  const { port: actual } = server.address() as AddressInfo;
  console.log(`${root ?? `demo/${site}`} en http://127.0.0.1:${actual}/ (latencia ${latency} ms)`);
}
