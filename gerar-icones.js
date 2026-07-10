// Gera os ícones PNG do PWA sem dependências externas
const fs = require('fs');
const zlib = require('zlib');

function crc32(buf) {
  const table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const lenBuf = Buffer.allocUnsafe(4);
  lenBuf.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(td));
  return Buffer.concat([lenBuf, td, crcBuf]);
}

function solidPNG(size, r, g, b) {
  // Row = filter_byte(0) + size * RGB
  const row = Buffer.allocUnsafe(1 + size * 3);
  row[0] = 0;
  for (let x = 0; x < size; x++) {
    row[1 + x * 3] = r;
    row[2 + x * 3] = g;
    row[3 + x * 3] = b;
  }
  const rows = Buffer.concat(Array.from({ length: size }, () => row));
  const compressed = zlib.deflateSync(rows, { level: 6 });

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const publicDir = './client/public';
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

// Cor primária: #7C3AED → rgb(124, 58, 237)
const [R, G, B] = [124, 58, 237];

const icons = [
  { size: 192, file: 'icon-192.png' },
  { size: 512, file: 'icon-512.png' },
  { size: 180, file: 'apple-touch-icon.png' },
];

for (const { size, file } of icons) {
  fs.writeFileSync(`${publicDir}/${file}`, solidPNG(size, R, G, B));
  console.log(`✅ ${file} (${size}×${size}px)`);
}

console.log('\n✅ Ícones criados em client/public/');
