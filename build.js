const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Check if TypeScript is compiled
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  console.log('📦 Compiling TypeScript...');
  execSync('npx tsc', { stdio: 'inherit' });
}

// Read ui.html content
const uiHtml = fs.readFileSync(path.join(__dirname, 'ui.html'), 'utf-8');

// Read examples
const examplesDir = path.join(__dirname, 'examples');
const templates = {};
fs.readdirSync(examplesDir).forEach(file => {
  if (path.extname(file) === '.json') {
    const templateName = path.basename(file, '.json');
    const templateContent = fs.readFileSync(path.join(examplesDir, file), 'utf-8');
    templates[templateName] = JSON.parse(templateContent);
  }
});

console.log('📦 Bundling plugin...');

esbuild.build({
  entryPoints: ['dist/main.js'],
  bundle: true,
  outfile: 'code.js',
  platform: 'browser',
  target: 'es6',
  // Define global constants
  define: {
    '__html__': JSON.stringify(uiHtml),
    'TEMPLATES': JSON.stringify(templates),
  },
}).then(() => {
  console.log('✅ Build complete!');
}).catch((error) => {
  console.error('❌ Build failed:', error);
  process.exit(1);
}); 