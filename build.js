const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Auto-increment version
function incrementVersion() {
  const packagePath = path.join(__dirname, 'package.json');
  const uiPath = path.join(__dirname, 'ui.html');
  
  // Read current version
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const currentVersion = pkg.version;
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  // Increment patch version
  const newVersion = `${major}.${minor}.${patch + 1}`;
  
  console.log(`📝 Incrementing version from ${currentVersion} to ${newVersion}`);
  
  // Update package.json
  pkg.version = newVersion;
  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
  
  // Update ui.html
  let uiContent = fs.readFileSync(uiPath, 'utf8');
  uiContent = uiContent.replace(/v\d+\.\d+\.\d+/g, `v${newVersion}`);
  fs.writeFileSync(uiPath, uiContent);
  
  return newVersion;
}

// Check if --no-increment flag is passed
const shouldIncrement = !process.argv.includes('--no-increment');

// Increment version before build if flag not present
let newVersion;
if (shouldIncrement) {
  newVersion = incrementVersion();
} else {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  newVersion = pkg.version;
  console.log(`📦 Building without version increment (v${newVersion})`);
}

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
  console.log(`✅ Build complete! (v${newVersion})`);
}).catch((error) => {
  console.error('❌ Build failed:', error);
  process.exit(1);
}); 