// Genera els icons PWA (icon-192.png / icon-512.png) amb Node pur (zlib).
// Dibuixa un quadrat arrodonit navy (#042149) amb una "P" taronja (#FF6B00).
// Ús: node scripts/generate-icons.cjs  (des de portal/)

const zlib = require('node:zlib');
const fs = require('node:fs');
const path = require('node:path');

function crc32(buf) {
  if (!crc32.table) {
    crc32.table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crc32.table[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crc32.table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function png(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const NAVY = [4, 33, 73, 255];
const ORANGE = [255, 107, 0, 255];
const P_BITMAP = ['1111111', '1000001', '1000001', '1111110', '1000000', '1000000', '1000000', '1000000'];

function draw(size) {
  const buf = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.max(radius - x, x - (size - 1 - radius), 0);
      const dy = Math.max(radius - y, y - (size - 1 - radius), 0);
      const inside = dx * dx + dy * dy <= radius * radius;
      const i = (y * size + x) * 4;
      if (inside) {
        buf[i] = NAVY[0];
        buf[i + 1] = NAVY[1];
        buf[i + 2] = NAVY[2];
        buf[i + 3] = NAVY[3];
      } else {
        buf[i] = 0;
        buf[i + 1] = 0;
        buf[i + 2] = 0;
        buf[i + 3] = 0;
      }
    }
  }
  const rows = P_BITMAP.length;
  const cols = P_BITMAP[0].length;
  const cell = Math.floor((size * 0.6) / cols);
  const pWidth = cols * cell;
  const pHeight = rows * cell;
  const ox = Math.floor((size - pWidth) / 2);
  const oy = Math.floor((size - pHeight) / 2);
  for (let py = 0; py < rows; py++) {
    for (let px = 0; px < cols; px++) {
      if (P_BITMAP[py][px] === '0') continue;
      for (let dy = 0; dy < cell; dy++) {
        for (let dx = 0; dx < cell; dx++) {
          const x = ox + px * cell + dx;
          const y = oy + py * cell + dy;
          if (x < 0 || y < 0 || x >= size || y >= size) continue;
          const i = (y * size + x) * 4;
          buf[i] = ORANGE[0];
          buf[i + 1] = ORANGE[1];
          buf[i + 2] = ORANGE[2];
          buf[i + 3] = ORANGE[3];
        }
      }
    }
  }
  return png(size, size, buf);
}

const dir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'icon-192.png'), draw(192));
fs.writeFileSync(path.join(dir, 'icon-512.png'), draw(512));
console.log('icons generats a', dir);