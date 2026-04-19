// Generate Claude Monitor icons
// Design: circular gauge/meter with a bar chart — unique monitoring motif
// Run: node scripts/generate-icons.js

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const sizes = [16, 32, 48, 96, 128, 256];
const outDir = path.join(__dirname, '..', 'icons');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;

  ctx.clearRect(0, 0, size, size);

  // Background circle — dark charcoal
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#2A2A2A';
  ctx.fill();

  // Outer ring — terracotta
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#D97757';
  ctx.lineWidth = size * 0.04;
  ctx.stroke();

  // Arc gauge track (bottom half arc, from 150° to 390°)
  const arcRadius = r * 0.78;
  const startAngle = (140 * Math.PI) / 180;
  const endAngle = (400 * Math.PI) / 180;
  const gaugeWidth = size * 0.045;

  // Track (dim)
  ctx.beginPath();
  ctx.arc(cx, cy, arcRadius, startAngle, endAngle);
  ctx.strokeStyle = 'rgba(217,119,87,0.2)';
  ctx.lineWidth = gaugeWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Fill (bright terracotta — show ~65% filled)
  const fillAngle = startAngle + (endAngle - startAngle) * 0.65;
  ctx.beginPath();
  ctx.arc(cx, cy, arcRadius, startAngle, fillAngle);
  ctx.strokeStyle = '#D97757';
  ctx.lineWidth = gaugeWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Three vertical bars in the center (bar chart)
  const barWidth = size * 0.055;
  const barGap = size * 0.04;
  const barHeights = [0.22, 0.35, 0.28];
  const barColors = ['#E8956F', '#D97757', '#C66847'];
  const totalW = barWidth * 3 + barGap * 2;
  const barStartX = cx - totalW / 2;
  const barBaseY = cy + size * 0.12;

  for (let i = 0; i < 3; i++) {
    const x = barStartX + i * (barWidth + barGap);
    const h = size * barHeights[i];
    const y = barBaseY - h;
    const br = barWidth / 2;

    ctx.beginPath();
    ctx.moveTo(x, barBaseY);
    ctx.lineTo(x, y + br);
    ctx.arc(x + br, y + br, br, Math.PI, 0, false);
    ctx.lineTo(x + barWidth, barBaseY);
    ctx.closePath();
    ctx.fillStyle = barColors[i];
    ctx.fill();
  }

  // Small "M" letter at top of circle
  if (size >= 48) {
    const fontSize = size * 0.13;
    ctx.font = `bold ${fontSize}px -apple-system, Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('M', cx, cy - size * 0.22);
  }

  return canvas;
}

for (const size of sizes) {
  const canvas = drawIcon(size);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), buffer);
  console.log(`Generated icon${size}.png (${buffer.length} bytes)`);
}

console.log('Done — all icons generated');
