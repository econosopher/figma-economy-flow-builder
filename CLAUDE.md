# Economy-Flow Plugin Settings

This file contains project-specific settings for the economy-flow-plugin that override or extend the global CLAUDE.md settings.

## Build Hooks

### Auto-increment Version on Build
Before each build, automatically increment the patch version number in package.json and update the version display in ui.html.

```bash
# This hook runs before npm run build
# It increments the patch version (e.g., 1.2.0 -> 1.2.1)

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")

# Split version into components
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Increment patch version
NEW_PATCH=$((PATCH + 1))
NEW_VERSION="$MAJOR.$MINOR.$NEW_PATCH"

echo "Incrementing version from $CURRENT_VERSION to $NEW_VERSION"

# Update package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Update ui.html
sed -i '' "s/v[0-9]\+\.[0-9]\+\.[0-9]\+/v$NEW_VERSION/g" ui.html

echo "Version updated to $NEW_VERSION"
```

## Git Push Hooks

### Auto-increment Version on Git Push
Before pushing to GitHub, automatically increment the version and commit the changes.

```bash
# This hook runs before git push
# It increments the patch version and commits the changes

# Check if there are uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "Error: Uncommitted changes detected. Please commit or stash them before pushing."
    exit 1
fi

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")

# Split version into components
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Increment patch version
NEW_PATCH=$((PATCH + 1))
NEW_VERSION="$MAJOR.$MINOR.$NEW_PATCH"

echo "Incrementing version from $CURRENT_VERSION to $NEW_VERSION"

# Update package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Update ui.html
sed -i '' "s/v[0-9]\+\.[0-9]\+\.[0-9]\+/v$NEW_VERSION/g" ui.html

# Update manifest.json
node -e "
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf8'));
manifest.editorType[0].version = '$NEW_VERSION';
fs.writeFileSync('./manifest.json', JSON.stringify(manifest, null, 2) + '\n');
"

# Commit the version changes
git add package.json ui.html manifest.json
git commit -m "chore: bump version to v$NEW_VERSION"

echo "Version updated to $NEW_VERSION and committed"
```

## Project-Specific Settings

- **Auto Version Increment**: Enabled - Patch version bumps on every build
- **Version Format**: Semantic versioning (MAJOR.MINOR.PATCH)
- **Version Updates**: package.json, ui.html, and manifest.json are updated
- **Build Command**: The version increment happens automatically when running `npm run build`
- **Git Push**: Version is also incremented and committed before pushing to GitHub
- **Published to Figma**: The plugin is now published in the official Figma marketplace

## Usage

### Building
The version will automatically increment when you run:
```bash
npm run build
```

To build without incrementing the version, you can run the compile and bundle steps separately:
```bash
npm run compile && npm run bundle
```

### Publishing Updates
Since the plugin is now published to the Figma marketplace:
1. Version increments should follow semantic versioning rules
2. Use patch versions (x.x.+1) for bug fixes
3. Use minor versions (x.+1.0) for new features
4. Use major versions (+1.0.0) for breaking changes
5. Remember to update the manifest.json with the production plugin ID when publishing