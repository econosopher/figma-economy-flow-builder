# Publishing to Figma Community

This guide covers the steps to publish the Economy-Flow Builder plugin to the Figma Community.

## Pre-Publishing Checklist

- [ ] All tests pass (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] Build completes successfully (`npm run build`)
- [ ] Plugin tested in Figma desktop app
- [ ] README.md is up to date
- [ ] Version number updated in `package.json` and `manifest.json`
- [ ] All example files work correctly

## File Structure Required for Publishing

```
economy_flow_plugin/
├── manifest.json          # Plugin manifest (required)
├── code.js               # Compiled plugin code (required)
├── ui.html               # Plugin UI (embedded in code.js)
├── README.md             # Documentation (required for community)
├── LICENSE               # MIT License
├── cover.png             # Cover image (1920x960px recommended)
├── icon.png              # Plugin icon (128x128px)
└── examples/             # Example JSON files
```

## Steps to Publish

1. **Create Plugin Assets**
   - Design a cover image (1920x960px) showing the plugin in action
   - Create an icon (128x128px) representing the plugin

2. **Update Manifest**
   ```json
   {
     "name": "Economy-Flow Builder",
     "id": "YOUR_PLUGIN_ID",
     "api": "1.0.0",
     "main": "code.js",
     "ui": "ui.html",
     "editorType": ["figjam"],
     "permissions": [],
     "relaunchButtons": []
   }
   ```

3. **Build for Production**
   ```bash
   npm run build
   ```

4. **Test in Figma**
   - Open Figma Desktop
   - Go to Plugins → Development → Import plugin from manifest
   - Select `manifest.json`
   - Test all features thoroughly

5. **Prepare Community Page**
   - Write a compelling description
   - Create example images/GIFs
   - List key features
   - Add usage instructions

6. **Submit to Community**
   - Go to [Figma Community](https://www.figma.com/community)
   - Click "Publish"
   - Select "Plugin"
   - Fill in all required fields
   - Upload assets
   - Submit for review

## Post-Publishing

1. **Monitor Feedback**
   - Check community comments regularly
   - Address user issues promptly
   - Consider feature requests

2. **Version Updates**
   - Update version in `manifest.json` and `package.json`
   - Document changes in CHANGELOG.md
   - Test thoroughly before republishing

## Marketing Tips

- Share on social media with #FigmaPlugin
- Create a demo video
- Write a blog post about the plugin
- Engage with the game design community