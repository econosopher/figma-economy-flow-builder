const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

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

esbuild.build({
  entryPoints: ['code.ts'],
  bundle: true,
  outfile: 'code.js',
  platform: 'browser',
  target: 'es6',
  // Define global constants
  define: {
    '__html__': JSON.stringify(uiHtml),
    'TEMPLATES': JSON.stringify(templates),
  },
}).catch(() => process.exit(1)); 