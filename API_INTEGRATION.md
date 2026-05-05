# Research API Integration

The Figma plugin integrates with a local deep research economy API for advanced game economy analysis and v2 JSON conversion.

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

For economy generation, the plugin now prefers environment-backed defaults at build time and still supports manual UI entry. The Research tab can send `provider: "gemini"`, `"openai"`, or `"claude"` to the local API.

Supported Gemini key variable names:
- `GEMINI_DEEP_RESEARCH_API_KEY`
- `GEMINI_API_KEY`
- `GOOGLE_API_KEY`

Supported OpenAI key variable names:
- `OPENAI_DEEP_RESEARCH_API_KEY`
- `OPENAI_API_KEY`

Supported Claude / Anthropic key variable names:
- `ANTHROPIC_DEEP_RESEARCH_API_KEY`
- `ANTHROPIC_API_KEY`
- `CLAUDE_API_KEY`

Default lookup order:
1. `process.env`
2. `/Users/phillip/Documents/vibe_coding_projects/.env`
3. `/Users/phillip/Documents/secrets/global.env`
4. `~/.api_keys`
5. `src/default-config.ts` as a local fallback only

## Structured Output Contract

Gemini/OpenAI/Claude deep research is best treated as the report-generation step, not the final JSON emitter. The plugin now sends:
- A research brief
- A structured conversion prompt for the plugin JSON format
- A JSON schema describing the required output shape

The API should prefer a two-step flow when possible:
1. Gather/report findings with Deep Research
2. Convert those findings into the plugin `schemaVersion: 2` format with structured JSON output enabled

## Current QA Notes

- Compact v2 layout was validated in FigJam against Apex Legends and Rainbow Six Siege.
- Apex Legends: 30 cards, 34 connectors, 0 route/card intersections, 12 fan-out junction routes, 25.9% width reduction.
- Rainbow Six Siege: 13 cards, 20 connectors, 0 route/card intersections, 11 fan-out junction routes, 25.2% width reduction.
- Screenshot evidence: `/tmp/economy-flow-plugin-qa/v2-apex-compact.png` and `/tmp/economy-flow-plugin-qa/v2-rainbow-six-compact.png`.
