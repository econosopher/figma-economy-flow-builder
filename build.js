const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
  
  // Add file contents to hash
  const glob = require('glob');
  sourceFiles.forEach(pattern => {
    const files = glob.sync(pattern, { cwd: __dirname });
    files.sort().forEach(file => {
      try {
        let content = fs.readFileSync(path.join(__dirname, file), 'utf8');
        
        // For package.json and ui.html, exclude version numbers from hash
        if (file === 'package.json') {
          // Remove version field from content for hashing
          const pkg = JSON.parse(content);
          delete pkg.version;
          content = JSON.stringify(pkg);
        } else if (file === 'ui.html') {
          // Remove version strings from content for hashing
          content = content.replace(/v\d+\.\d+\.\d+/g, 'vX.X.X');
        }
        
        hash.update(file + content);
      } catch (e) {
        // File might not exist
      }
    });
  });
  
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