const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

async function generateFavicons() {
  const inputSvg = path.join(__dirname, '../public/favicon.svg');
  const outputDir = path.join(__dirname, '../public');

  // Read the SVG file
  const svgBuffer = await fs.readFile(inputSvg);

  // Define the sizes we need
  const sizes = {
    'favicon-16x16.png': 16,
    'favicon-32x32.png': 32,
    'android-icon-192x192.png': 192,
    'apple-icon.png': 180,
    'icon.png': 512,
    'favicon.png': 32  // We'll convert this to ICO
  };

  // Generate each size
  for (const [filename, size] of Object.entries(sizes)) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(outputDir, filename));
    
    console.log(`Generated ${filename}`);
  }

  // Copy SVG to safari-pinned-tab.svg
  await fs.copyFile(
    inputSvg,
    path.join(outputDir, 'safari-pinned-tab.svg')
  );
  console.log('Copied safari-pinned-tab.svg');

  // Generate og-image.png from og-image.svg
  const ogSvgBuffer = await fs.readFile(path.join(outputDir, 'og-image.svg'));
  await sharp(ogSvgBuffer)
    .resize(1200, 630)
    .png()
    .toFile(path.join(outputDir, 'og-image.png'));
  
  console.log('Generated og-image.png');

  // For favicon.ico, we'll use the 32x32 PNG we generated
  // You might want to use a tool like png2ico for better ICO support
  await fs.rename(
    path.join(outputDir, 'favicon.png'),
    path.join(outputDir, 'favicon.ico')
  );
  console.log('Created favicon.ico');
}

generateFavicons().catch(console.error); 