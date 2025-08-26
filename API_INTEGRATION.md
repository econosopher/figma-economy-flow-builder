# Research API Integration

The Figma plugin integrates with the deep research economy Python API for advanced game economy analysis.

## Quick Start

1. Start the API server:
```bash
cd ../deep_research_economy
PORT=5001 python3 api_server.py
```

2. Build and run the Figma plugin:
```bash
npm run build
```

3. Use the Research Panel in the plugin:
   - Enter game name
   - Select depth (1-3)
   - Click "Generate Cache" for prompt building
   - Click "Generate Economy JSON" for full analysis (requires API key)

## Testing

Run integration tests:
```bash
node test-api-integration.js
```

## API Endpoints

- `GET /health` - Health check
- `POST /api/research/cache` - Generate research cache
- `POST /api/research/generate` - Generate economy JSON
- `POST /api/research/validate` - Validate JSON structure
- `GET /api/templates` - List available templates

## Configuration

The API runs on port 5001 by default (to avoid conflicts with macOS AirPlay).

To use a different port:
1. Set environment variable: `PORT=5002`
2. Update `research-bridge.ts` URLs

## API Keys

For economy generation, provide API keys either:
- In the UI when generating
- As environment variables:
  - `GEMINI_API_KEY` 
  - `ANTHROPIC_API_KEY`