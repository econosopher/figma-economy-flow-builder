/**
 * Default configuration template
 * 
 * SETUP INSTRUCTIONS:
 * 1. Prefer environment-based loading via one of these files:
 *    - /Users/phillip/Documents/vibe_coding_projects/.env
 *    - /Users/phillip/Documents/secrets/global.env
 *    - ~/.api_keys
 * 2. Supported variable names:
 *    - GEMINI_DEEP_RESEARCH_API_KEY
 *    - GEMINI_API_KEY
 *    - GOOGLE_API_KEY
 * 3. Only use this file as a local fallback for development.
 * 4. NEVER commit default-config.ts to git (it's in .gitignore)
 * 
 * For production builds, leave apiKey empty.
 * For development, you can add your personal API key.
 */

export const DEFAULT_CONFIG = {
  apiKey: '', // Add your API key here for development
  validated: false
};
