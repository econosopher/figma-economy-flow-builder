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

## Project-Specific Settings

- **Auto Version Increment**: Enabled - Patch version bumps on every build
- **Version Format**: Semantic versioning (MAJOR.MINOR.PATCH)
- **Version Updates**: Both package.json and ui.html are updated
- **Build Command**: The version increment happens automatically when running `npm run build`

## Usage

The version will automatically increment when you run:
```bash
npm run build
```

To build without incrementing the version, you can run the compile and bundle steps separately:
```bash
npm run compile && npm run bundle
```