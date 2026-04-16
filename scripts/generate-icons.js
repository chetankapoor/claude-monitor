// Generate Claude Monitor icons using Canvas API (Node.js)
// Run: node scripts/generate-icons.js
// Requires: npm install canvas

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const sizes = [16, 32, 48, 96, 128, 256];
const outDir = path.join(__dirname, '..', 'icons');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

for (const size of sizes) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background: rounded rectangle, dark purple
  const radius = size * 0.2;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fillStyle = '#7c6bd4';
  ctx.fill();

  // Letter "M" in white
  const fontSize = size * 0.55;
  ctx.font = `bold ${fontSize}px -apple-system, Arial, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('M', size / 2, size / 2 + size * 0.03);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), buffer);
  console.log(`Generated icon${size}.png (${buffer.length} bytes)`);
}

console.log('Done — all icons generated');
