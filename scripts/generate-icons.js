// Generate Claude Monitor icons
// A Claude-style asterisk/sunburst with a bar chart in the center
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

  // Clear
  ctx.clearRect(0, 0, size, size);

  // Claude's brand terracotta/coral color for the sunburst
  const petalColor = '#D97757';

  // Draw Claude asterisk/sunburst petals
  const numPetals = 8;
  const petalLength = size * 0.38;
  const petalWidth = size * 0.09;
  const petalOffset = size * 0.22; // distance from center where petal starts

  ctx.lineCap = 'round';
  ctx.strokeStyle = petalColor;
  ctx.lineWidth = petalWidth;

  for (let i = 0; i < numPetals; i++) {
    const angle = (i * Math.PI * 2) / numPetals - Math.PI / 2;
    const startX = cx + Math.cos(angle) * petalOffset;
    const startY = cy + Math.sin(angle) * petalOffset;
    const endX = cx + Math.cos(angle) * petalLength;
    const endY = cy + Math.sin(angle) * petalLength;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }

  // Draw center circle (white background for the chart)
  const centerRadius = size * 0.2;
  ctx.beginPath();
  ctx.arc(cx, cy, centerRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  // Draw bar chart inside the circle
  const barCount = 3;
  const barWidth = size * 0.035;
  const barGap = size * 0.025;
  const barMaxHeight = size * 0.2;
  const barHeights = [0.5, 0.8, 0.6]; // relative heights
  const totalBarWidth = barCount * barWidth + (barCount - 1) * barGap;
  const barStartX = cx - totalBarWidth / 2;
  const barBaseY = cy + centerRadius * 0.5;

  for (let i = 0; i < barCount; i++) {
    const x = barStartX + i * (barWidth + barGap);
    const h = barMaxHeight * barHeights[i];
    const y = barBaseY - h;

    // Bar with gradient
    const barColors = ['#D97757', '#C66847', '#E88868'];
    ctx.fillStyle = barColors[i];

    // Rounded top
    const r = barWidth / 2;
    ctx.beginPath();
    ctx.moveTo(x, barBaseY);
    ctx.lineTo(x, y + r);
    ctx.arc(x + r, y + r, r, Math.PI, 0, false);
    ctx.lineTo(x + barWidth, barBaseY);
    ctx.closePath();
    ctx.fill();
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
