// Generate PWA icons as PNG files using Canvas
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function generateIcon(size, outputPath) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#0e1117');
  grad.addColorStop(1, '#1a6b4a');
  ctx.fillStyle = grad;

  // Rounded rect
  const r = size * 0.2;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.fill();

  // Wave symbol
  ctx.strokeStyle = '#25d47a';
  ctx.lineWidth = size * 0.045;
  ctx.lineCap = 'round';

  const cx = size / 2;
  const cy = size / 2;

  for (let i = 0; i < 3; i++) {
    const offset = (i - 1) * size * 0.13;
    const amplitude = size * 0.08;
    const startX = size * 0.25;
    const endX = size * 0.75;

    ctx.beginPath();
    for (let x = startX; x <= endX; x++) {
      const progress = (x - startX) / (endX - startX);
      const y = cy + offset + Math.sin(progress * Math.PI * 2) * amplitude;
      if (x === startX) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // "W" letter
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size * 0.3}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('W', cx, cy);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`Created: ${outputPath}`);
}

const iconsDir = path.join(__dirname, '..', 'client', 'icons');
generateIcon(192, path.join(iconsDir, 'icon-192.png'));
generateIcon(512, path.join(iconsDir, 'icon-512.png'));
