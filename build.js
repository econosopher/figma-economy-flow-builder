const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// Check if source files have changed since last build
function hasSourceChanges() {
  const lastBuildFile = path.join(__dirname, '.last-build-hash');
  const sourceFiles = [
    'src/**/*.ts',
    'ui.html',
    'examples/**/*.json',
    'manifest.json'
  ];
  
  // Get current hash of source files
  const crypto = require('crypto');
  const hash = crypto.createHash('md5');
  
  // Add file contents to hash (without glob; manual walk)
  const addFile = (relPath) => {
    try {
      let content = fs.readFileSync(path.join(__dirname, relPath), 'utf8');
      if (relPath === 'package.json') {
        const pkg = JSON.parse(content);
        delete pkg.version;
        content = JSON.stringify(pkg);
      } else if (relPath === 'ui.html') {
        content = content.replace(/v\d+\.\d+\.\d+/g, 'vX.X.X');
      }
      hash.update(relPath + content);
    } catch (e) {}
  };

  const walk = (dir, exts) => {
    try {
      fs.readdirSync(path.join(__dirname, dir)).forEach((name) => {
        const full = path.join(__dirname, dir, name);
        const rel = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          walk(rel, exts);
        } else {
          const ok = exts.length === 0 || exts.indexOf(path.extname(name)) !== -1;
          if (ok) addFile(rel);
        }
      });
    } catch (e) {}
  };

  // src/**/*.ts
  walk('src', ['.ts']);
  // examples/**/*.json
  walk('examples', ['.json']);
  // single files
  addFile('ui.html');
  addFile('manifest.json');
  
  const currentHash = hash.digest('hex');
  
  // Compare with last build hash
  let lastHash = '';
  try {
    lastHash = fs.readFileSync(lastBuildFile, 'utf8');
  } catch (e) {
    // First build
  }
  
  const hasChanges = currentHash !== lastHash;
  
  // Save current hash for next comparison
  fs.writeFileSync(lastBuildFile, currentHash);
  
  return hasChanges;
}

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
const forceNoIncrement = process.argv.includes('--no-increment');
const forceIncrement = process.argv.includes('--force-increment');

// Determine if we should increment
let shouldIncrement = false;
if (forceIncrement) {
  shouldIncrement = true;
} else if (!forceNoIncrement) {
  // Check if source files have changed
  shouldIncrement = hasSourceChanges();
}

// Get or increment version
let newVersion;
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
if (shouldIncrement) {
  newVersion = incrementVersion();
} else {
  newVersion = pkg.version;
  console.log(`📦 No source changes detected. Building with current version (v${newVersion})`);
}

// Determine entry point: prefer compiled JS if present, otherwise bundle TS directly
const distDir = path.join(__dirname, 'dist');
const entryTs = path.join(__dirname, 'src', 'main.ts');
const entryJs = path.join(distDir, 'main.js');
const entryPoints = fs.existsSync(entryJs) ? [entryJs] : [entryTs];
console.log(`📦 Using entry: ${path.relative(__dirname, entryPoints[0])}`);

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

// Load default config if it exists (from compiled dist)
let defaultConfig = { apiKey: '', validated: false };
try {
  const configModule = require('./dist/default-config');
  defaultConfig = configModule.DEFAULT_CONFIG || defaultConfig;
  console.log(`📋 Including default config (key: ${defaultConfig.apiKey ? defaultConfig.apiKey.substring(0, 10) + '...' : 'none'})`);
} catch (e) {
  console.log('📋 No default config found (production mode)');
}

console.log('📦 Bundling plugin...');

esbuild.build({
  entryPoints,
  bundle: true,
  outfile: 'code.js',
  platform: 'browser',
  target: 'es6',
  loader: { '.ts': 'ts' },
  // Define global constants
  define: {
    '__html__': JSON.stringify(uiHtml),
    'TEMPLATES': JSON.stringify(templates),
    'DEFAULT_API_KEY': JSON.stringify(defaultConfig.apiKey || ''),
    'DEFAULT_VALIDATED': JSON.stringify(defaultConfig.validated || false),
  },
}).then(() => {
  console.log(`✅ Build complete! (v${newVersion})`);
}).catch((error) => {
  console.error('❌ Build failed:', error);
  process.exit(1);
}); 
