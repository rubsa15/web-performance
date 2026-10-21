import { mkdtemp, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDemoServer } from '../demo/serve.js';
import { auditCommand, defaultAuditDeps } from '../src/commands/audit.js';
import { ReportSchema, type Report } from '../src/schema.js';

// Audita la demo rota y la arreglada con Chrome real: `npm run test:slow`.
// Los ids esperados salen de demo/site/ISSUES.md (problemas 1-5 y 7; el 6 no tiene auditoría).
const servers: Server[] = [];
let dir: string;

async function audit(site: 'site' | 'site-fixed'): Promise<Report> {
  const server = await startDemoServer({ site, port: 0, latency: 300 });
  servers.push(server);
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  const out: string[] = [];
  await auditCommand(
    url,
    { device: 'mobile', network: 'default', runs: 1, save: false, keepRaw: false, format: 'json' },
    { ...defaultAuditDeps(), baseDir: dir, out: (t) => out.push(t), log: () => {} },
  );
  return ReportSchema.parse(JSON.parse(out[0]!));
}

let broken: Report;
let fixed: Report;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'wperf-demo-'));
  broken = await audit('site');
  fixed = await audit('site-fixed');
});

afterAll(async () => {
  for (const server of servers) server.close();
  await rm(dir, { recursive: true, force: true });
});

describe('wperf audit sobre la demo', () => {
  it.each([
    ['1', 'image-delivery-insight'],
    ['2', 'unsized-images'],
    ['2', 'cls-culprits-insight'],
    ['3', 'render-blocking-insight'],
    ['4', 'unused-javascript'],
    ['5', 'font-display-insight'],
    ['7', 'bootup-time'],
  ])('detecta el problema %s (%s) en la demo rota', (_issue, id) => {
    expect(broken.opportunities.map((o) => o.id)).toContain(id);
  });

  it('la demo rota tiene CLS y LCP en poor', () => {
    expect(broken.metrics.cls.rating).toBe('poor');
    expect(broken.metrics.lcp.rating).toBe('poor');
  });

  it('la demo arreglada ya no tiene los problemas catalogados', () => {
    const ids = fixed.opportunities.map((o) => o.id);
    for (const id of [
      'unsized-images',
      'cls-culprits-insight',
      'render-blocking-insight',
      'unused-javascript',
      'font-display-insight',
    ]) {
      expect(ids).not.toContain(id);
    }
    expect(fixed.metrics.cls.rating).toBe('good');
    expect(fixed.score).toBeGreaterThan(broken.score + 30);
  });
});
