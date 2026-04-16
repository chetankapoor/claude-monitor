const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');
const outdir = 'build/chrome';

// Clean build dir
if (fs.existsSync(outdir)) {
  fs.rmSync(outdir, { recursive: true });
}

// Copy static files
fs.mkdirSync(`${outdir}/icons`, { recursive: true });
fs.copyFileSync('src/chrome/manifest.json', `${outdir}/manifest.json`);
fs.copyFileSync('src/ui/styles.css', `${outdir}/styles.css`);

// Copy icons if they exist
const iconsDir = 'icons';
if (fs.existsSync(iconsDir)) {
  for (const file of fs.readdirSync(iconsDir)) {
    fs.copyFileSync(`${iconsDir}/${file}`, `${outdir}/icons/${file}`);
  }
}

const buildOptions = {
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  minify: false,
  sourcemap: false,
};

async function build() {
  // Content script — bundles core + ui + bridge-client
  await esbuild.build({
    ...buildOptions,
    entryPoints: ['src/chrome/content-script.js'],
    outfile: `${outdir}/content-script.js`,
  });

  // Bridge script — runs in page context, must be standalone
  await esbuild.build({
    ...buildOptions,
    entryPoints: ['src/core/bridge.js'],
    outfile: `${outdir}/bridge.js`,
  });

  // Background service worker
  await esbuild.build({
    ...buildOptions,
    entryPoints: ['src/chrome/background.js'],
    outfile: `${outdir}/background.js`,
  });

  console.log('Build complete → build/chrome/');
}

if (isWatch) {
  const chokidar = require('chokidar');
  chokidar.watch('src', { ignoreInitial: true }).on('all', () => {
    build().catch(console.error);
  });
  build().catch(console.error);
  console.log('Watching for changes...');
} else {
  build().catch(console.error);
}
