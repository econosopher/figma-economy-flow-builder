# Setting Up Research API Keys

The Economy Flow Plugin can use a local research API backed by Gemini, OpenAI, or Claude/Anthropic to generate complete v2 economy JSON structures for any game.

## Quick Start

1. **Get an API Key**
   - Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Or use an OpenAI / Anthropic key supported by the local research API
   - Copy the generated key

2. **Add to Plugin**
   - Open the Figma plugin
   - Go to the "Research (Beta)" tab
   - Select Gemini, OpenAI, or Claude / Anthropic
   - Paste your API key in the API Key field
   - The key is automatically saved securely

### Optional: Make a Provider a Build-Time Default

The plugin can auto-load a default provider key during build from any of these local secret stores:
- `/Users/phillip/Documents/vibe_coding_projects/.env`
- `/Users/phillip/Documents/secrets/global.env`
- `~/.api_keys`

Supported Gemini variable names:
- `GEMINI_DEEP_RESEARCH_API_KEY`
- `GEMINI_API_KEY`
- `GOOGLE_API_KEY`

Supported OpenAI variable names:
- `OPENAI_DEEP_RESEARCH_API_KEY`
- `OPENAI_API_KEY`

Supported Claude / Anthropic variable names:
- `ANTHROPIC_DEEP_RESEARCH_API_KEY`
- `ANTHROPIC_API_KEY`
- `CLAUDE_API_KEY`

This keeps the key out of the repo while making the selected provider available by default.

3. **Generate Economy JSON**
   - Enter a game name (e.g., "Clash Royale")
   - Select research depth (1-3)
   - Click "Generate Economy JSON"
   - Wait 30-60 seconds for AI analysis
   - Use the generated `schemaVersion: 2` JSON in the Builder tab

## Features

### Secure Storage
- Your API key is stored locally in Figma's secure storage
- Never transmitted except to the configured local research API and that provider's API
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
- Make sure you've selected the correct provider and entered the matching API key
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

Limits vary by provider. Google's Gemini free tier includes:
- 1,500 requests per day
- 60 requests per minute
- No credit card required

OpenAI and Anthropic limits depend on your account, model, and billing setup.

## Privacy & Security

- API keys are stored using Figma's secure clientStorage
- Keys are only sent to the local research API and then to the selected provider
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

The plugin sends a structured conversion prompt and JSON schema alongside the generation request. If your research backend uses Gemini, OpenAI, or Claude Deep Research, the recommended implementation is:
1. Run Deep Research to gather the report
2. Run a structured JSON conversion step using the plugin v2 schema

## Support

- Plugin issues: [GitHub Issues](https://github.com/econosopher/figma-economy-flow-builder/issues)
- API key help: [Google AI Studio Documentation](https://ai.google.dev/tutorials/setup)
- Game economy questions: Check the examples folder for templates
