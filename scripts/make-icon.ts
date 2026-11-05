// Genera un ícono placeholder para la app sin depender de herramientas de imagen
// externas: dibuja un PNG 256x256 por manipulación de píxeles y lo convierte a
// .ico multi-tamaño con png-to-ico (dependencia ya presente vía electrobun).
//
// Uso: bun run scripts/make-icon.ts
// Reemplaza el diseño sobrescribiendo assets/icon.png con el tuyo, o deja tu
// propio assets/icon.ico y omite este script.

import { deflateSync } from "node:zlib";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pngToIco from "png-to-ico";

const SIZE = 256;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = path.join(ROOT, "assets");

type RGBA = [number, number, number, number];

const BLUE: RGBA = [37, 99, 235, 255]; // #2563eb
const BLUE_DARK: RGBA = [29, 78, 216, 255]; // #1d4ed8
const WHITE: RGBA = [255, 255, 255, 255];
const GRAY: RGBA = [148, 163, 184, 255]; // #94a3b8
const GREEN: RGBA = [16, 185, 129, 255]; // #10b981 (check)

function createCanvas(): Uint8Array {
  // RGBA, todo transparente al inicio.
  return new Uint8Array(SIZE * SIZE * 4);
}

function setPx(buf: Uint8Array, x: number, y: number, [r, g, b, a]: RGBA) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
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

function fillRoundedRect(
  buf: Uint8Array,
  x0: number,
  y0: number,
  w: number,
  h: number,
  radius: number,
  color: RGBA,
) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      // Recorte de esquinas redondeadas.
      const dxL = x0 + radius - x;
      const dxR = x - (x0 + w - 1 - radius);
      const dyT = y0 + radius - y;
      const dyB = y - (y0 + h - 1 - radius);
      let inside = true;
      if (dxL > 0 && dyT > 0) inside = dxL * dxL + dyT * dyT <= radius * radius;
      else if (dxR > 0 && dyT > 0) inside = dxR * dxR + dyT * dyT <= radius * radius;
      else if (dxL > 0 && dyB > 0) inside = dxL * dxL + dyB * dyB <= radius * radius;
      else if (dxR > 0 && dyB > 0) inside = dxR * dxR + dyB * dyB <= radius * radius;
      if (inside) setPx(buf, x, y, color);
    }
  }
}

function drawIcon(): Uint8Array {
  const buf = createCanvas();

  // Fondo redondeado (degradado vertical sutil azul).
  for (let y = 0; y < SIZE; y++) {
    const t = y / SIZE;
    const color: RGBA = [
      Math.round(BLUE[0] * (1 - t) + BLUE_DARK[0] * t),
      Math.round(BLUE[1] * (1 - t) + BLUE_DARK[1] * t),
      Math.round(BLUE[2] * (1 - t) + BLUE_DARK[2] * t),
      255,
    ];
    for (let x = 0; x < SIZE; x++) {
      // Máscara de esquina redondeada del fondo.
      const r = 48;
      const dxL = r - x;
      const dxR = x - (SIZE - 1 - r);
      const dyT = r - y;
      const dyB = y - (SIZE - 1 - r);
      let inside = true;
      if (dxL > 0 && dyT > 0) inside = dxL * dxL + dyT * dyT <= r * r;
      else if (dxR > 0 && dyT > 0) inside = dxR * dxR + dyT * dyT <= r * r;
      else if (dxL > 0 && dyB > 0) inside = dxL * dxL + dyB * dyB <= r * r;
      else if (dxR > 0 && dyB > 0) inside = dxR * dxR + dyB * dyB <= r * r;
      if (inside) setPx(buf, x, y, color);
    }
  }

  // "Hoja" de comprobante (rectángulo blanco).
  const pageX = 74;
  const pageY = 58;
  const pageW = 108;
  const pageH = 140;
  fillRoundedRect(buf, pageX, pageY, pageW, pageH, 10, WHITE);

  // Líneas de texto (grises) en la hoja.
  const lineX = pageX + 18;
  const lineW = pageW - 36;
  for (let n = 0; n < 4; n++) {
    const ly = pageY + 30 + n * 22;
    const w = n === 3 ? Math.round(lineW * 0.55) : lineW;
    fillRoundedRect(buf, lineX, ly, w, 8, 4, GRAY);
  }

  // Check verde (marca de "pagado") abajo a la derecha de la hoja.
  const cx = pageX + pageW - 34;
  const cy = pageY + pageH - 34;
  for (let i = 0; i < 16; i++) {
    // Trazo corto ascendente + trazo largo.
    setPx(buf, cx - 10 + i * 0, cy, GREEN);
  }
  // Dibujo del check con dos segmentos y grosor.
  for (let t = 0; t <= 12; t++) {
    const x = cx - 12 + t;
    const y = cy - 2 + t;
    for (let g = -2; g <= 2; g++) setPx(buf, x, y + g, GREEN);
  }
  for (let t = 0; t <= 20; t++) {
    const x = cx + t;
    const y = cy + 10 - t;
    for (let g = -2; g <= 2; g++) setPx(buf, x, y + g, GREEN);
  }

  return buf;
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

function encodePng(rgba: Uint8Array): Uint8Array {
  // IHDR
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, SIZE); // width
  dv.setUint32(4, SIZE); // height
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Datos con filtro 0 por fila.
  const raw = new Uint8Array(SIZE * (SIZE * 4 + 1));
  for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 4 + 1)] = 0; // filtro None
    raw.set(rgba.subarray(y * SIZE * 4, (y + 1) * SIZE * 4), y * (SIZE * 4 + 1) + 1);
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
  await fs.mkdir(ASSETS, { recursive: true });

  const png = encodePng(drawIcon());
  const pngPath = path.join(ASSETS, "icon.png");
  await fs.writeFile(pngPath, png);
  console.log(`✓ ${path.relative(ROOT, pngPath)} (${png.length} bytes)`);

  const ico = await pngToIco(pngPath);
  const icoPath = path.join(ASSETS, "icon.ico");
  await fs.writeFile(icoPath, ico);
  console.log(`✓ ${path.relative(ROOT, icoPath)} (${ico.length} bytes)`);
}

await main();
