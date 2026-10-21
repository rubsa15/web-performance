import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDemoServer } from '../demo/serve.js';

let server: Server;
let base: string;

beforeAll(async () => {
  server = await startDemoServer({ site: 'site', port: 0, latency: 0 });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

describe('servidor de la demo', () => {
  it('sirve el HTML sin caché y el resto con caché larga', async () => {
    const page = await fetch(`${base}/`);
    expect(page.status).toBe(200);
    expect(page.headers.get('cache-control')).toBe('no-cache');
    expect(page.headers.get('content-type')).toContain('text/html');

    const css = await fetch(`${base}/css/styles.css`);
    expect(css.headers.get('cache-control')).toContain('immutable');
  });

  it('comprime el texto, pero no las imágenes', async () => {
    const js = await fetch(`${base}/js/app.js`);
    expect(js.headers.get('content-encoding')).toBe('gzip');

    const image = await fetch(`${base}/img/hero.jpg`);
    expect(image.headers.get('content-encoding')).toBeNull();
    expect(image.headers.get('content-type')).toBe('image/jpeg');
  });

  it('responde 404 a rutas inexistentes y no sale de la carpeta del sitio', async () => {
    expect((await fetch(`${base}/no-existe.html`)).status).toBe(404);
    const escape = await fetch(`${base}/..%2fserve.ts`);
    expect(escape.status).not.toBe(200);
  });
});

describe('contenido de la demo', () => {
  it('toda imagen y recurso referenciado en el HTML existe', async () => {
    const html = await (await fetch(`${base}/`)).text();
    const refs = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
      .map((m) => m[1]!)
      .filter((ref) => !ref.startsWith('http') && ref !== '/');
    expect(refs.length).toBeGreaterThan(5);
    for (const ref of refs) {
      expect((await fetch(`${base}/${ref}`)).status, ref).toBe(200);
    }
  });
});
