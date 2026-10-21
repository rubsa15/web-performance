// Genera las imágenes de la demo (solo macOS: usa `sips`). Los resultados están versionados,
// así que esto solo hace falta para regenerarlas: `node demo/generate-images.ts`.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const root = new URL('.', import.meta.url).pathname;
const original = join(root, 'site/img');
const fixed = join(root, 'site-fixed/img');
mkdirSync(original, { recursive: true });
mkdirSync(fixed, { recursive: true });

function prng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

function encodePng(width: number, height: number, rgb: Buffer): Buffer {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 1 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

interface Palette {
  base: [number, number, number];
  accent: [number, number, number];
}

/** Paisaje abstracto con ruido de grano: pesa lo que una foto sin optimizar. */
function render(width: number, height: number, palette: Palette, seed: number, grain: number) {
  const rand = prng(seed);
  const phases = Array.from({ length: 6 }, () => rand() * Math.PI * 2);
  const rgb = Buffer.alloc(width * height * 3);
  let i = 0;
  for (let y = 0; y < height; y++) {
    const v = y / height;
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const wave =
        Math.sin(u * 7 + phases[0]! + Math.sin(v * 5 + phases[1]!)) * 0.5 +
        Math.sin((u + v) * 13 + phases[2]!) * 0.25 +
        Math.sin(v * 21 + phases[3]! + u * 3) * 0.125;
      const mix = Math.min(1, Math.max(0, 0.5 + wave * 0.6 - v * 0.25));
      const noise = (rand() - 0.5) * grain;
      for (let c = 0; c < 3; c++) {
        const value = palette.base[c]! * (1 - mix) + palette.accent[c]! * mix + noise;
        rgb[i++] = Math.min(255, Math.max(0, value));
      }
    }
  }
  return encodePng(width, height, rgb);
}

const sips = (...args: string[]) => execFileSync('sips', args, { stdio: 'ignore' });
const tmp = mkdtempSync(join(tmpdir(), 'wperf-demo-img-'));

const images: { name: string; width: number; height: number; palette: Palette; grain: number }[] = [
  {
    name: 'hero',
    width: 3200,
    height: 2000,
    palette: { base: [58, 34, 20], accent: [226, 160, 90] },
    grain: 25,
  },
  {
    name: 'cafe-1',
    width: 1600,
    height: 1067,
    palette: { base: [90, 60, 35], accent: [240, 200, 140] },
    grain: 35,
  },
  {
    name: 'cafe-2',
    width: 1600,
    height: 1067,
    palette: { base: [45, 28, 18], accent: [190, 120, 70] },
    grain: 35,
  },
  {
    name: 'cafe-3',
    width: 1600,
    height: 1067,
    palette: { base: [30, 50, 45], accent: [170, 210, 180] },
    grain: 35,
  },
  {
    name: 'cafe-4',
    width: 1600,
    height: 1067,
    palette: { base: [80, 35, 30], accent: [230, 140, 110] },
    grain: 35,
  },
  {
    name: 'cafe-5',
    width: 1600,
    height: 1067,
    palette: { base: [40, 40, 70], accent: [160, 170, 230] },
    grain: 35,
  },
  {
    name: 'cafe-6',
    width: 1600,
    height: 1067,
    palette: { base: [70, 55, 20], accent: [225, 205, 110] },
    grain: 35,
  },
];

try {
  images.forEach(({ name, width, height, palette, grain }, index) => {
    const png = join(tmp, `${name}.png`);
    writeFileSync(png, render(width, height, palette, 1000 + index, grain));
    // Versión de la web "rota": JPEG casi sin comprimir y a tamaño original.
    const big = join(original, `${name}.jpg`);
    sips('-s', 'format', 'jpeg', '-s', 'formatOptions', '95', png, '--out', big);

    // Versión "arreglada": anchos adecuados y calidad razonable.
    const widths = name === 'hero' ? [480, 960, 1600] : [480, 960];
    for (const w of widths) {
      sips(
        '-Z',
        String(w),
        '-s',
        'formatOptions',
        '70',
        big,
        '--out',
        join(fixed, `${name}-${w}.jpg`),
      );
    }
  });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
