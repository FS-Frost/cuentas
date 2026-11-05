// Genera los íconos de la PWA (static/icon-192.png y static/icon-512.png) sin
// depender de herramientas de imagen externas: dibuja por manipulación de
// píxeles y codifica PNG a mano.
//
// Uso: bun run make:icon
// Para usar tu propio diseño, reemplaza esos dos PNG y omite este script.

import { deflateSync } from "node:zlib";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// El diseño está en coordenadas de una grilla de 256 px y se escala a cada tamaño.
const DESIGN = 256;
const SIZES = [192, 512];
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "static");

type RGBA = [number, number, number, number];

const BLUE: RGBA = [37, 99, 235, 255]; // #2563eb
const BLUE_DARK: RGBA = [29, 78, 216, 255]; // #1d4ed8
const WHITE: RGBA = [255, 255, 255, 255];
const GRAY: RGBA = [148, 163, 184, 255]; // #94a3b8
const GREEN: RGBA = [16, 185, 129, 255]; // #10b981 (check)

class Canvas {
  readonly buf: Uint8Array;
  constructor(readonly size: number) {
    // RGBA, todo transparente al inicio.
    this.buf = new Uint8Array(size * size * 4);
  }

  setPx(x: number, y: number, [r, g, b, a]: RGBA) {
    const { buf, size } = this;
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    // Composición simple sobre lo existente (alpha over).
    const sa = a / 255;
    const da = buf[i + 3] / 255;
    const outA = sa + da * (1 - sa);
    if (outA === 0) {
      buf[i] = buf[i + 1] = buf[i + 2] = buf[i + 3] = 0;
      return;
    }
    buf[i] = Math.round((r * sa + buf[i] * da * (1 - sa)) / outA);
    buf[i + 1] = Math.round((g * sa + buf[i + 1] * da * (1 - sa)) / outA);
    buf[i + 2] = Math.round((b * sa + buf[i + 2] * da * (1 - sa)) / outA);
    buf[i + 3] = Math.round(outA * 255);
  }
}

/** true si (x, y) cae dentro del rectángulo redondeado. */
function insideRounded(x: number, y: number, x0: number, y0: number, w: number, h: number, r: number) {
  if (x < x0 || y < y0 || x >= x0 + w || y >= y0 + h) return false;
  const dxL = x0 + r - x;
  const dxR = x - (x0 + w - 1 - r);
  const dyT = y0 + r - y;
  const dyB = y - (y0 + h - 1 - r);
  if (dxL > 0 && dyT > 0) return dxL * dxL + dyT * dyT <= r * r;
  if (dxR > 0 && dyT > 0) return dxR * dxR + dyT * dyT <= r * r;
  if (dxL > 0 && dyB > 0) return dxL * dxL + dyB * dyB <= r * r;
  if (dxR > 0 && dyB > 0) return dxR * dxR + dyB * dyB <= r * r;
  return true;
}

function drawIcon(size: number): Uint8Array {
  const c = new Canvas(size);
  const k = size / DESIGN; // escala diseño → píxeles
  const s = (v: number) => Math.round(v * k);

  function fillRoundedRect(x0: number, y0: number, w: number, h: number, r: number, color: RGBA) {
    const [X, Y, W, H, R] = [s(x0), s(y0), s(w), s(h), s(r)];
    for (let y = Y; y < Y + H; y++) {
      for (let x = X; x < X + W; x++) {
        if (insideRounded(x, y, X, Y, W, H, R)) c.setPx(x, y, color);
      }
    }
  }

  // Fondo redondeado (degradado vertical sutil azul).
  const R = s(48);
  for (let y = 0; y < size; y++) {
    const t = y / size;
    const color: RGBA = [
      Math.round(BLUE[0] * (1 - t) + BLUE_DARK[0] * t),
      Math.round(BLUE[1] * (1 - t) + BLUE_DARK[1] * t),
      Math.round(BLUE[2] * (1 - t) + BLUE_DARK[2] * t),
      255,
    ];
    for (let x = 0; x < size; x++) {
      if (insideRounded(x, y, 0, 0, size, size, R)) c.setPx(x, y, color);
    }
  }

  // "Hoja" de comprobante (rectángulo blanco).
  const pageX = 74;
  const pageY = 58;
  const pageW = 108;
  const pageH = 140;
  fillRoundedRect(pageX, pageY, pageW, pageH, 10, WHITE);

  // Líneas de texto (grises) en la hoja.
  const lineX = pageX + 18;
  const lineW = pageW - 36;
  for (let n = 0; n < 4; n++) {
    const ly = pageY + 30 + n * 22;
    const w = n === 3 ? Math.round(lineW * 0.55) : lineW;
    fillRoundedRect(lineX, ly, w, 8, 4, GRAY);
  }

  // Check verde (marca de "pagado") abajo a la derecha de la hoja: dos trazos con grosor.
  const cx = pageX + pageW - 34;
  const cy = pageY + pageH - 34;
  const thick = Math.max(2, s(2));
  const stroke = (x1: number, y1: number, x2: number, y2: number) => {
    const steps = Math.max(Math.abs(s(x2) - s(x1)), Math.abs(s(y2) - s(y1)));
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(s(x1) + ((s(x2) - s(x1)) * i) / steps);
      const y = Math.round(s(y1) + ((s(y2) - s(y1)) * i) / steps);
      for (let g = -thick; g <= thick; g++) c.setPx(x, y + g, GREEN);
    }
  };
  stroke(cx - 12, cy - 2, cx, cy + 10);
  stroke(cx, cy + 10, cx + 20, cy - 10);

  return c.buf;
}

// ---------------------------------------------------------------------------
// Codificación PNG
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const body = new Uint8Array(typeBytes.length + data.length);
  body.set(typeBytes, 0);
  body.set(data, typeBytes.length);
  const crc = crc32(body);
  const out = new Uint8Array(4 + body.length + 4);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set(body, 4);
  dv.setUint32(4 + body.length, crc);
  return out;
}

function encodePng(rgba: Uint8Array, size: number): Uint8Array {
  // IHDR
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, size); // width
  dv.setUint32(4, size); // height
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Datos con filtro 0 por fila.
  const raw = new Uint8Array(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filtro None
    raw.set(rgba.subarray(y * size * 4, (y + 1) * size * 4), y * (size * 4 + 1) + 1);
  }
  const idatData = deflateSync(raw); // zlib stream (lo que PNG espera)

  const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const parts = [
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", new Uint8Array(idatData)),
    chunk("IEND", new Uint8Array(0)),
  ];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

// ---------------------------------------------------------------------------

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  for (const size of SIZES) {
    const png = encodePng(drawIcon(size), size);
    const out = path.join(OUT_DIR, `icon-${size}.png`);
    await fs.writeFile(out, png);
    console.log(`✓ ${path.relative(ROOT, out)} (${png.length} bytes)`);
  }
}

await main();
