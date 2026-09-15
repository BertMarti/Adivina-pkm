const fs = require('node:fs');
const zlib = require('node:zlib');

const size = 1024;
const cells = 32;
const scale = size / cells;
const colors = {
  bg: [18, 18, 47, 255], navy: [31, 31, 78, 255], gold: [255, 208, 0, 255], goldDark: [149, 96, 0, 255],
  yellow: [255, 221, 65, 255], yellowDark: [203, 135, 0, 255], brown: [72, 45, 24, 255], black: [20, 17, 25, 255],
  red: [235, 65, 80, 255], white: [255, 249, 226, 255], cyan: [79, 104, 232, 255],
};
const pixels = Array.from({ length: size }, () => Array.from({ length: size }, () => colors.bg));
function cell(x, y, color) { for (let py = y * scale; py < (y + 1) * scale; py += 1) for (let px = x * scale; px < (x + 1) * scale; px += 1) pixels[py][px] = colors[color]; }
function cellsPaint(list, color) { list.forEach(([x, y]) => cell(x, y, color)); }

// Pixel-art arcade badge.
for (let i = 2; i < 30; i += 1) { cell(i, 1, 'goldDark'); cell(i, 30, 'goldDark'); cell(1, i, 'goldDark'); cell(30, i, 'goldDark'); }
for (let y = 3; y < 30; y += 1) for (let x = 3; x < 30; x += 1) cell(x, y, 'navy');
cellsPaint([[25, 12], [26, 11], [27, 10], [27, 9], [28, 8], [27, 14], [26, 14], [26, 15], [25, 15]], 'gold');
cellsPaint([[10, 5], [11, 4], [12, 4], [13, 5], [13, 8], [19, 5], [20, 4], [21, 4], [22, 5], [22, 9]], 'yellow');
cellsPaint([[10, 4], [11, 4], [20, 4], [21, 4]], 'brown');
for (let y = 9; y <= 25; y += 1) for (let x = 8; x <= 24; x += 1) cell(x, y, 'yellow');
for (let y = 11; y <= 24; y += 1) { cell(7, y, 'yellowDark'); cell(8, y, 'yellow'); cell(24, y, 'yellowDark'); }
cellsPaint([[10, 13], [11, 13], [10, 14], [11, 14], [21, 13], [22, 13], [21, 14], [22, 14]], 'black');
cellsPaint([[8, 16], [9, 16], [8, 17], [9, 17], [23, 16], [24, 16], [23, 17], [24, 17]], 'red');
cellsPaint([[15, 16], [16, 16]], 'brown');
cellsPaint([[13, 19], [14, 20], [15, 20], [16, 20], [17, 19]], 'brown');
cellsPaint([[12, 24], [13, 25], [14, 25], [18, 25], [19, 25], [20, 24]], 'yellowDark');
for (let x = 4; x < 28; x += 1) { cell(x, 27, 'goldDark'); cell(x, 28, 'gold'); }

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) { crc ^= byte; for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) { const name = Buffer.from(type); const out = Buffer.alloc(12 + data.length); out.writeUInt32BE(data.length, 0); name.copy(out, 4); data.copy(out, 8); out.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length); return out; }
const raw = Buffer.alloc(size * (size * 4 + 1));
for (let y = 0; y < size; y += 1) { raw[y * (size * 4 + 1)] = 0; for (let x = 0; x < size; x += 1) Buffer.from(pixels[y][x]).copy(raw, y * (size * 4 + 1) + 1 + x * 4); }
const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
fs.writeFileSync('assets/icon.png', png);
fs.copyFileSync('assets/icon.png', 'assets/favicon.png');
console.log('assets/icon.png y assets/favicon.png generados');
