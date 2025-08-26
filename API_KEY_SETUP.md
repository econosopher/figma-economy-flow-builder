# Setting Up Your Gemini API Key

The Economy Flow Plugin can use Google's Gemini AI to automatically generate complete economy JSON structures for any game. This requires a free API key from Google.

## Quick Start

1. **Get Your Free API Key**
   - Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Sign in with your Google account
   - Click "Create API Key"
   - Copy the generated key

2. **Add to Plugin**
   - Open the Figma plugin
   - Go to the "Research (Beta)" tab
   - Paste your API key in the "Gemini API Key" field
   - The key is automatically saved securely

3. **Generate Economy JSON**
   - Enter a game name (e.g., "Clash Royale")
   - Select research depth (1-3)
   - Click "Generate Economy JSON"
   - Wait 30-60 seconds for AI analysis
   - Use the generated JSON in the Builder tab

## Features

### Secure Storage
- Your API key is stored locally in Figma's secure storage
- Never transmitted except to Google's API
- Persists between plugin sessions
- Never visible to other users or plugins

### Research Depth Levels

**Level 1 - Basic Economy**
- Core currencies and resources
- Main gameplay loops
- Basic progression systems

**Level 2 - Detailed Economy (Recommended)**
- All currency types and exchange rates
- Secondary activities (crafting, trading)
- Time-gated content
- Social features

**Level 3 - Comprehensive Analysis**
- Player segmentation strategies
- Optimization paths for different playstyles
- Detailed monetization mechanics
- End-game economy loops

## Workflow Options

### Option 1: Full AI Generation
1. Enter game name and API key
2. Click "Generate Economy JSON"
3. Review generated JSON
4. Click "Use in Builder" to visualize

### Option 2: Cache-Based Research
1. Click "Generate Cache" for research prompts
2. Copy cache for external processing
3. Paste results back when ready
4. Use in Builder

### Option 3: Manual Creation
1. Use the Builder tab directly
2. Enter JSON manually or load templates
3. Visualize without AI assistance

## Troubleshooting

### "API key is required"
- Make sure you've entered your Gemini API key
- Check that the key was copied completely
- Get a new key if yours was revoked

### "Failed to generate economy"
- Check your internet connection
- Verify the API server is running (for local development)
- Try a simpler game name or lower depth level
- Ensure your API key is valid

### Generation takes too long
- Complex games at depth 3 can take 60+ seconds
- Try depth 2 for faster results
- Check if the API server is responding

## API Limits

Google's free tier includes:
- 1,500 requests per day
- 60 requests per minute
- No credit card required

This is more than enough for regular plugin usage.

## Privacy & Security

- API keys are stored using Figma's secure clientStorage
- Keys are only sent to Google's official API endpoints
- No data is collected or stored by the plugin authors
- Each user needs their own API key

## Local Development

If running the research API locally:

1. Start the Flask server:
```bash
cd ../deep_research_economy
PORT=5001 python3 api_server.py
```

2. The plugin will automatically connect to localhost:5001

## Support

- Plugin issues: [GitHub Issues](https://github.com/YOUR_USERNAME/economy_flow_plugin/issues)
- API key help: [Google AI Studio Documentation](https://ai.google.dev/tutorials/setup)
- Game economy questions: Check the examples folder for templates