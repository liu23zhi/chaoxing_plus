/**
 * Generate PNG icons for the Chrome extension.
 * Uses only Node.js built-in modules (zlib, fs, path).
 * Creates icons at 16x16, 32x32, 48x48, and 128x128 pixels.
 */

import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../public/icons');

/** CRC32 implementation using the standard polynomial */
function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint32BE(buf, value, offset) {
  buf[offset] = (value >>> 24) & 0xff;
  buf[offset + 1] = (value >>> 16) & 0xff;
  buf[offset + 2] = (value >>> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  writeUint32BE(len, data.length, 0);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcVal = Buffer.alloc(4);
  writeUint32BE(crcVal, crc32(crcInput), 0);
  return Buffer.concat([len, typeBytes, data, crcVal]);
}

/**
 * Create a simple PNG image with a solid background and a stylized "C+" letter.
 * The icon uses Chaoxing's brand color scheme: blue (#1a73e8) background, white text.
 */
function createIconPNG(size) {
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR: width, height, bitDepth=8, colorType=2 (RGB), compression=0, filter=0, interlace=0
  const ihdrData = Buffer.alloc(13);
  writeUint32BE(ihdrData, size, 0);
  writeUint32BE(ihdrData, size, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type: RGB
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  // Build raw image data (size rows × (1 filter byte + size*3 bytes))
  const rowSize = 1 + size * 3;
  const raw = Buffer.alloc(size * rowSize, 0);

  const BG_R = 0x1a, BG_G = 0x73, BG_B = 0xe8;  // Chaoxing blue
  const FG_R = 0xff, FG_G = 0xff, FG_B = 0xff;  // white

  for (let y = 0; y < size; y++) {
    raw[y * rowSize] = 0; // filter type None
    for (let x = 0; x < size; x++) {
      const px = y * rowSize + 1 + x * 3;

      // Draw rounded corners (circle mask)
      const cx = x - size / 2 + 0.5;
      const cy = y - size / 2 + 0.5;
      const radius = size * 0.45;
      const inCircle = cx * cx + cy * cy <= radius * radius;

      if (!inCircle) {
        // Transparent-ish – use white background outside circle
        raw[px] = 0xff; raw[px + 1] = 0xff; raw[px + 2] = 0xff;
        continue;
      }

      // Default background
      raw[px] = BG_R; raw[px + 1] = BG_G; raw[px + 2] = BG_B;

      // Draw "C+" symbol
      const nx = cx / radius; // normalized -1..1
      const ny = cy / radius;

      // Draw "C" arc (left half circle, thick)
      const arcR = 0.5;
      const arcThick = 0.18;
      const distFromArc = Math.abs(Math.sqrt(nx * nx + ny * ny) - arcR);
      const inCArc =
        distFromArc < arcThick &&
        !(nx > 0.1 && Math.abs(ny) < 0.25); // gap on right side

      // Draw "+" (two bars)
      const plusH = Math.abs(ny) < 0.12 && nx > 0.25 && nx < 0.85;
      const plusV = Math.abs(nx - 0.55) < 0.12 && ny > -0.55 && ny < 0.55 && nx > 0.25 && nx < 0.85;

      if (inCArc || plusH || plusV) {
        raw[px] = FG_R; raw[px + 1] = FG_G; raw[px + 2] = FG_B;
      }
    }
  }

  const compressed = deflateSync(raw);
  const idatChunk = makeChunk('IDAT', compressed);
  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([PNG_SIG, ihdrChunk, idatChunk, iendChunk]);
}

mkdirSync(OUT_DIR, { recursive: true });

const sizes = [16, 32, 48, 128];
for (const size of sizes) {
  const png = createIconPNG(size);
  const outPath = resolve(OUT_DIR, `icon${size}.png`);
  writeFileSync(outPath, png);
  console.log(`  Generated icon${size}.png (${png.length} bytes)`);
}

console.log('✅ Icons generated in public/icons/');
