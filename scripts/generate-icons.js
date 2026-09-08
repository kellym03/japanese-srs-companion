const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generate() {
  const svgPath = path.join(__dirname, '../public/icons/icon.svg');
  const svgBuffer = fs.readFileSync(svgPath);

  const iconsDir = path.join(__dirname, '../public/icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  // 1. 192x192
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(iconsDir, 'icon-192x192.png'));
  console.log('Created icon-192x192.png');

  // 2. 512x512
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(iconsDir, 'icon-512x512.png'));
  console.log('Created icon-512x512.png');

  // 3. Maskable icon (with safe zone padding)
  await sharp(svgBuffer)
    .resize(410, 410)
    .extend({
      top: 51,
      bottom: 51,
      left: 51,
      right: 51,
      background: '#09090b',
    })
    .png()
    .toFile(path.join(iconsDir, 'icon-maskable.png'));
  console.log('Created icon-maskable.png');

  // 4. Apple Touch Icon (180x180)
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(__dirname, '../public/apple-touch-icon.png'));
  console.log('Created apple-touch-icon.png');

  // 5. Favicon (32x32 & 48x48)
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(__dirname, '../public/favicon.png'));
  console.log('Created favicon.png');
}

generate().catch(console.error);
