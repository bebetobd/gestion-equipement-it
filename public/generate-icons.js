// Script de génération d'icônes — exécuter avec Node.js si besoin de regénérer
// Les icônes sont des SVG encodés en base64 intégrés dans des canvas HTML
// Pour production, remplacer par de vraies icônes PNG 192x192 et 512x512

const { createCanvas } = require('canvas');
const fs = require('fs');

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#1a6fa6';
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.2);
  ctx.fill();

  // Monitor icon
  ctx.strokeStyle = 'white';
  ctx.lineWidth = size * 0.06;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const p = size * 0.2;
  // Screen body
  ctx.strokeRect(p, p, size - p * 2, (size - p * 2) * 0.65);
  // Stand
  ctx.beginPath();
  ctx.moveTo(size * 0.4, size * 0.73);
  ctx.lineTo(size * 0.6, size * 0.73);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(size * 0.35, size * 0.82);
  ctx.lineTo(size * 0.65, size * 0.82);
  ctx.stroke();

  return canvas.toBuffer('image/png');
}

try {
  fs.writeFileSync('icon-192.png', drawIcon(192));
  fs.writeFileSync('icon-512.png', drawIcon(512));
  console.log('Icons generated');
} catch (e) {
  console.log('canvas not available, skipping icon generation');
}
