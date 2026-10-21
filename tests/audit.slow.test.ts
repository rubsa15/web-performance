import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditCommand, defaultAuditDeps } from '../src/commands/audit.js';
import { ReportSchema } from '../src/schema.js';
import { readReport, reportPath } from '../src/store.js';

// Lanza Chrome y Lighthouse reales contra un servidor local: `npm run test:slow`.
const PAGE = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Demo</title>
<script src="/blocking.js"></script></head>
<body><h1>Hola</h1><p>Página mínima para la prueba de integración.</p></body></html>`;

let server: Server;
let baseUrl: string;
let dir: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/blocking.js') {
      setTimeout(() => {
        res.writeHead(200, { 'content-type': 'text/javascript' }).end('window.ready = true;');
      }, 300);
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html' }).end(PAGE);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  dir = await mkdtemp(join(tmpdir(), 'wperf-slow-'));
});

afterAll(async () => {
  server.close();
  await rm(dir, { recursive: true, force: true });
});

describe('wperf audit con Chrome real', () => {
  it.each(['mobile', 'desktop'] as const)('guarda un reporte válido (%s)', async (device) => {
    const out: string[] = [];
    await auditCommand(
      baseUrl,
      { device, network: 'default', runs: 2, save: true, keepRaw: false, format: 'json' },
      { ...defaultAuditDeps(), baseDir: dir, out: (t) => out.push(t), log: () => {} },
    );

    const report = ReportSchema.parse(JSON.parse(out[0]!));
    expect(report).toMatchObject({ device, environment: { runs: 2, throttling: 'simulate' } });
    expect(report.metrics.fcp.value).toBeGreaterThan(0);
    expect(report.environment.lighthouseVersion).toBe('13.5.0');

    const saved = await readReport(reportPath(dir, report));
    expect(saved).toEqual(report);
  });
});
