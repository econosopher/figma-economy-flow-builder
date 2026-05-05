/// <reference types="@figma/plugin-typings" />

import { PluginMessage, V2Graph } from './types';
import { COLOR } from './constants';
import { generateDiagram } from './diagram-renderer';
import { syncFromCanvas } from './sync';
import { loadFonts, clear, reply } from './utils';
import { validateGraphData } from './validation';
import {
  generateResearchCache,
  generateEconomyJSON,
  createResearchMarkdown,
  parseResearchOutput,
  repairEconomyJSON
} from './research-bridge';

// Repository URL used to draft PRs for presets
const REPO_URL = 'https://github.com/econosopher/figma-economy-flow-builder';

function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

function parsePossiblyWrappedJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return parseResearchOutput(raw);
  }
}

function isGraphLike(value: unknown): boolean {
  return !!value && typeof value === 'object' && ('stages' in value || 'nodes' in value || 'edges' in value);
}

// Default config will be injected by build script
declare const DEFAULT_API_KEY: string;
declare const DEFAULT_PROVIDER: string;
declare const DEFAULT_VALIDATED: boolean;

declare const TEMPLATES: { [key: string]: any };

/* ── UI ── */
figma.showUI(__html__, { width: 400, height: 720 });
figma.ui.postMessage({ type: 'templates', templates: TEMPLATES, colors: COLOR });
// Restore only colors from client storage, not the JSON (start with empty/template selection)
figma.clientStorage.getAsync('economyFlowState').then((state) => {
  if (state && typeof state === 'object') {
    // Only restore colors, not the JSON - user should select a template or paste their own
    figma.ui.postMessage({ type: 'restore', colors: state.colors });
  }
}).catch(() => { });

/* ── main handler ── */
figma.ui.onmessage = async (m: PluginMessage) => {
  // Handle API key storage
  if (m.cmd === 'save-api-key') {
    const { apiKey, provider, validated } = m;
    if (provider) {
      await figma.clientStorage.setAsync('research-provider', provider);
    }
    if (apiKey) {
      await figma.clientStorage.setAsync('gemini-api-key', apiKey);
      if (validated) {
        await figma.clientStorage.setAsync('gemini-api-key-validated', 'true');
      }
      reply('API key saved securely', true);
    } else if (provider) {
      reply('Research provider saved', true);
    }
    return;
  }

  if (m.cmd === 'save-research-inputs') {
    const { gameName, depth } = m as any;
    await figma.clientStorage.setAsync('researchInputs', { gameName, depth });
    return;
  }

  if (m.cmd === 'load-research-inputs') {
    const inputs = (await figma.clientStorage.getAsync('researchInputs')) as any;
    figma.ui.postMessage({
      type: 'research-inputs-loaded',
      gameName: inputs?.gameName,
      depth: inputs?.depth
    });
    return;
  }

  if (m.cmd === 'load-api-key') {
    let apiKey = await figma.clientStorage.getAsync('gemini-api-key');
    let validated = await figma.clientStorage.getAsync('gemini-api-key-validated');
    let provider = await figma.clientStorage.getAsync('research-provider');

    if (!apiKey && DEFAULT_API_KEY) {
      apiKey = DEFAULT_API_KEY;
      provider = DEFAULT_PROVIDER || 'gemini';
      validated = DEFAULT_VALIDATED ? 'true' : 'false';
      await figma.clientStorage.setAsync('gemini-api-key', apiKey);
      await figma.clientStorage.setAsync('research-provider', provider);
      if (validated === 'true') {
        await figma.clientStorage.setAsync('gemini-api-key-validated', 'true');
      }
    }

    figma.ui.postMessage({
      type: 'api-key-loaded',
      apiKey: apiKey || '',
      provider: provider || DEFAULT_PROVIDER || 'gemini',
      validated: validated === 'true'
    });
    return;
  }

  if (m.cmd === 'validate-api-key') {
    const { apiKey, provider } = m;
    if (!apiKey) {
      figma.ui.postMessage({
        type: 'api-key-validation',
        valid: false,
        error: 'No API key provided'
      });
      return;
    }

    try {
      const response = await fetch('http://localhost:5001/api/research/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, provider: provider || 'gemini' })
      }).catch(() => null);

      if (response && response.ok) {
        const result = await response.json();
        figma.ui.postMessage({
          type: 'api-key-validation',
          valid: result.valid,
          error: result.error
        });
      } else {
        const isValidFormat = isValidApiKeyFormat(apiKey, provider || 'gemini');
        figma.ui.postMessage({
          type: 'api-key-validation',
          valid: isValidFormat,
          error: isValidFormat ? undefined : `Invalid ${provider || 'gemini'} API key format. Ensure you copied the complete key.`
        });
      }

      if (response?.ok) {
        await figma.clientStorage.setAsync('gemini-api-key-validated', 'true');
      }
    } catch (error) {
      figma.ui.postMessage({
        type: 'api-key-validation',
        valid: false,
        error: `Validation failed: ${(error as Error).message}`
      });
    }

    return;
  }

  if (m.cmd === 'clear') {
    clear();
    reply('Canvas cleared', true);
    return;
  }

  if (m.cmd === 'sync-from-canvas') {
    syncFromCanvas();
    return;
  }

  if (m.cmd === 'validate') {
    try {
      const parsed = parsePossiblyWrappedJson(m.json);
      const errors = validateGraphData(parsed as any);

      if (errors.length === 0) {
        reply('JSON is valid.', true);
        return;
      }

      if (!isGraphLike(parsed)) {
        reply(errors, false);
        return;
      }

      reply(errors, false);
    } catch (e: any) {
      reply(['Invalid JSON:', e.message], false);
    }
    return;
  }

  if (m.cmd === 'generate-cache') {
    const { gameName, depth } = m;
    await figma.clientStorage.setAsync('researchInputs', { gameName, depth });

    try {
      const cache = await generateResearchCache({ gameName, depth });
      const markdown = createResearchMarkdown(gameName, depth);
      figma.ui.postMessage({
        type: 'cache-generated',
        cache: JSON.stringify(cache, null, 2),
        markdown
      });
    } catch (error) {
      console.error('Failed to generate cache:', error);
      figma.ui.postMessage({
        type: 'research-result',
        success: false,
        error: `Failed to generate cache: ${(error as Error).message}`
      });
    }

    return;
  }

  if (m.cmd === 'generate-economy') {
    const { gameName, depth, apiKey, provider } = m;
    await figma.clientStorage.setAsync('researchInputs', { gameName, depth });

    if (!apiKey) {
      figma.ui.postMessage({
        type: 'research-result',
        success: false,
        error: 'API key is required to generate economy JSON'
      });
      return;
    }

    try {
      figma.ui.postMessage({
        type: 'progress-update',
        step: 2,
        percent: 20,
        message: `Researching ${gameName} economy systems...`
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      figma.ui.postMessage({
        type: 'progress-update',
        step: 3,
        percent: 40,
        message: 'AI is analyzing game mechanics and resource flows...'
      });

      const economyJson = await generateEconomyJSON({
        gameName,
        depth,
        apiKey,
        provider: (provider as any) || 'gemini'
      });
      const validationErrors = validateGraphData(economyJson);
      if (validationErrors.length > 0) {
        figma.ui.postMessage({
          type: 'research-result',
          success: false,
          error: `Validation failed (first 10):\n${validationErrors.slice(0, 10).join('\n')}`
        });
        return;
      }

      figma.ui.postMessage({
        type: 'progress-update',
        step: 4,
        percent: 80,
        message: 'Structuring economy model...'
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      figma.ui.postMessage({
        type: 'economy-generated',
        json: JSON.stringify(economyJson, null, 2)
      });
    } catch (error) {
      console.error('Failed to generate economy:', error);
      figma.ui.postMessage({
        type: 'research-result',
        success: false,
        error: `Failed to generate economy: ${(error as Error).message}`
      });
    }

    return;
  }

  if (m.cmd === 'create-github-pr') {
    const { gameName, json, fileName, comment } = m as any;

    const safe = sanitizeFileName(gameName || 'new_preset');
    const finalFile = fileName && String(fileName).trim().length > 0 ? String(fileName).trim() : `${safe}.json`;
    const filePath = `examples/${finalFile}`;

    try {
      const draftUrl = `${REPO_URL}/new/main?filename=${encodeURIComponent(filePath)}&value=${encodeURIComponent(json)}`;
      // @ts-ignore
      figma.openExternal(draftUrl);
    } catch { }

    const prInstructions = [
      'To submit this as a preset:',
      `1. Fork the repository: ${REPO_URL}`,
      `2. Create a new file: ${filePath}`,
      '3. Paste the JSON content',
      '4. Create a pull request with the title:',
      `   "Add ${gameName} economy preset"`,
    ];
    if (comment) {
      prInstructions.push('', '5. In your PR description, include:', `   "${comment}"`);
    }
    prInstructions.push('', 'A draft page has been opened in your browser (if allowed).');

    figma.ui.postMessage({ type: 'research-result', success: false, error: prInstructions.join('\n') });
    return;
  }

  if (m.cmd !== 'draw') return;

  let data: V2Graph;
  let normalized = false;
  try {
    data = parsePossiblyWrappedJson(m.json) as V2Graph;
  } catch (e: any) {
    const errorMsg = [
      'JSON Parsing Error:',
      e.message,
      "This usually means there's a syntax error in your JSON.",
      'Common mistakes include:',
      '• A trailing comma (,) after the last item in an array or object.',
      '• Missing commas (,) between items.',
      '• Unmatched brackets [ ] or braces { }.',
      '• Using single quotes instead of double quotes for keys and string values.',
      '• Properties with no value (e.g. `"sources":,` should be `"sources": []`).'
    ];
    reply(errorMsg, false);
    return;
  }

  const errors = validateGraphData(data);
  if (errors.length > 0) {
    if (!isGraphLike(data)) {
      reply(errors, false);
      return;
    }

    reply(errors, false);
    return;
  }

  try {
    await loadFonts();
  } catch (error) {
    reply(['Font loading error:', (error as Error).message], false);
    return;
  }

  try {
    await figma.clientStorage.setAsync('economyFlowState', { json: JSON.stringify(data), colors: m.colors });
  } catch { }

  clear();
  await generateDiagram(data, m.colors, { normalized });
};

function isValidApiKeyFormat(apiKey: string, provider: string): boolean {
  if (provider === 'gemini') {
    return apiKey.startsWith('AIza') && apiKey.length >= 30;
  }
  if (provider === 'openai') {
    return /^sk-(proj-|svcacct-)?[A-Za-z0-9_-]{20,}$/.test(apiKey);
  }
  if (provider === 'claude') {
    return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(apiKey) || apiKey.length >= 32;
  }
  return apiKey.length >= 20;
}
