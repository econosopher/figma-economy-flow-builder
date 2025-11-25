/**
 * Bridge between Figma plugin and deep research Python script
 * This module handles the communication with the external research system
 */

// Declare fetch to satisfy TypeScript in Node test environment (ts-jest)
// Figma provides fetch at runtime, and tests mock it on global
declare const fetch: any;

type CacheResponse = { success: boolean; cache?: ResearchCache; error?: string };
type EconomyResponse = { success: boolean; json?: any; error?: string };

async function fetchWithTimeout(url: string, options: any = {}, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function tryFetchJson<T>(url: string, options: any, timeoutMs: number, retries = 1): Promise<T> {
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, options, timeoutMs);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return (await res.json()) as T;
    } catch (e: any) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 800));
    }
  }
  throw lastErr;
}

export interface ResearchRequest {
  gameName: string;
  depth: number;
  apiKey?: string;
  provider?: 'gemini' | 'claude';
}

interface ResearchCache {
  game: string;
  depth: number;
  timestamp: string;
  prompt_version: string;
  instructions: string;
  research_phases?: {
    phase1?: string;
    phase2?: string;
    phase3?: string;
  };
}

export async function generateResearchCache(request: ResearchRequest): Promise<ResearchCache> {
  try {
    const data = await tryFetchJson<CacheResponse>(
      'http://localhost:5001/api/research/cache',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameName: request.gameName, depth: request.depth })
      },
      30000,
      1
    );
    if (data.success && data.cache) return data.cache;
    throw new Error(data.error || 'Failed to generate cache');
  } catch (error) {
    console.error('Error calling API (cache):', error);

    // Fallback to local generation if API is unavailable
    const cache: ResearchCache = {
      game: request.gameName,
      depth: request.depth,
      timestamp: new Date().toISOString(),
      prompt_version: "1.0",
      instructions: `Research the economy of ${request.gameName} at depth level ${request.depth}`,
      research_phases: {}
    };

    // Add depth-specific instructions
    switch (request.depth) {
      case 1:
        cache.instructions += " - Focus on core loops and basic economy structure";
        break;
      case 2:
        cache.instructions += " - Include detailed resource flows and progression systems";
        break;
      case 3:
        cache.instructions += " - Comprehensive analysis with optimization paths and monetization";
        break;
    }

    return cache;
  }
}

export async function generateEconomyJSON(request: ResearchRequest): Promise<any> {
  // Validate API key
  if (!request.apiKey) {
    throw new Error('API key is required to generate economy JSON');
  }

  try {
    const data = await tryFetchJson<EconomyResponse>(
      'http://localhost:5001/api/research/generate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameName: request.gameName,
          depth: request.depth,
          provider: request.provider || 'gemini',
          apiKey: request.apiKey
        })
      },
      60000,
      1
    );
    if (data.success && data.json) {
      return repairEconomyJSON(data.json);
    }
    throw new Error(data.error || 'Failed to generate economy JSON');
  } catch (error) {
    console.error('Error calling API (economy):', error);
    throw new Error(
      `Failed to generate economy JSON: ${(error as Error)?.message || 'Unknown error'}`
    );
  }
}

/**
 * Repair and sanitize economy JSON from LLM
 */
export function repairEconomyJSON(json: any): any {
  if (!json || typeof json !== 'object') {
    return { inputs: [], nodes: [], edges: [] };
  }

  // Ensure arrays exist
  const inputs = Array.isArray(json.inputs) ? json.inputs : [];
  const nodes = Array.isArray(json.nodes) ? json.nodes : [];
  let edges = Array.isArray(json.edges) ? json.edges : [];

  // Helper to snake_case IDs
  const toSnakeCase = (str: string) => {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  };

  // Track valid IDs
  const validIds = new Set<string>();
  const idMapping = new Map<string, string>();

  // Repair inputs
  const repairedInputs = inputs.map((input: any) => {
    const originalId = input.id || `input_${Math.random().toString(36).substring(2, 11)}`;
    const newId = toSnakeCase(originalId);
    idMapping.set(originalId, newId);
    validIds.add(newId);

    return {
      id: newId,
      label: input.label || originalId,
      kind: 'initial_sink_node' // Enforce kind
    };
  });

  // Repair nodes
  const repairedNodes = nodes.map((node: any) => {
    const originalId = node.id || `node_${Math.random().toString(36).substring(2, 11)}`;
    const newId = toSnakeCase(originalId);
    idMapping.set(originalId, newId);
    validIds.add(newId);

    return {
      id: newId,
      label: node.label || originalId,
      sources: Array.isArray(node.sources) ? node.sources : [],
      sinks: Array.isArray(node.sinks) ? node.sinks : [],
      values: Array.isArray(node.values) ? node.values : [],
      kind: node.kind || 'node'
    };
  });

  // Repair edges
  const repairedEdges: [string, string][] = [];

  edges.forEach((edge: any) => {
    let from: string | undefined;
    let to: string | undefined;

    // Handle object style { from: 'a', to: 'b' }
    if (!Array.isArray(edge) && typeof edge === 'object') {
      from = edge.from || edge.source;
      to = edge.to || edge.target || edge.sink;
    }
    // Handle tuple style ['a', 'b']
    else if (Array.isArray(edge) && edge.length >= 2) {
      from = edge[0];
      to = edge[1];
    }

    if (from && to) {
      // Map to new snake_case IDs if possible, otherwise try snake_casing them directly
      const fromId = idMapping.get(from) || toSnakeCase(from);
      const toId = idMapping.get(to) || toSnakeCase(to);

      // Only add if both ends exist in our nodes/inputs
      if (validIds.has(fromId) && validIds.has(toId)) {
        repairedEdges.push([fromId, toId]);
      }
    }
  });

  return {
    name: json.name || 'Economy Graph',
    inputs: repairedInputs,
    nodes: repairedNodes,
    edges: repairedEdges,
    subsections: Array.isArray(json.subsections) ? json.subsections : []
  };
}

/**
 * Create a markdown file for research input
 * This matches the format expected by the deep_research_economy script
 */
export function createResearchMarkdown(gameName: string, depth: number): string {
  const sections = [];

  sections.push(`# ${gameName} Economy Research`);
  sections.push(`\n## Overview`);
  sections.push(`Research depth: Level ${depth}`);
  sections.push(`Generated: ${new Date().toISOString()}`);

  sections.push(`\n## Research Requirements`);

  if (depth >= 1) {
    sections.push(`### Core Systems`);
    sections.push(`- Primary currencies and resources`);
    sections.push(`- Core gameplay loops`);
    sections.push(`- Basic progression systems`);
  }

  if (depth >= 2) {
    sections.push(`\n### Detailed Flows`);
    sections.push(`- Resource conversion mechanics`);
    sections.push(`- Time gates and energy systems`);
    sections.push(`- Secondary activities (crafting, trading)`);
    sections.push(`- Event and seasonal content`);
  }

  if (depth >= 3) {
    sections.push(`\n### Comprehensive Analysis`);
    sections.push(`- Player segmentation (F2P, dolphins, whales)`);
    sections.push(`- Optimization paths`);
    sections.push(`- Monetization drivers`);
    sections.push(`- Social and competitive elements`);
    sections.push(`- End-game content and retention`);
  }

  sections.push(`\n## Categories to Include`);
  const categories = [
    "Core Gameplay Loop",
    "Resource Management",
    "Progression Systems",
    "Monetization",
    "Social Features",
    "Time-Limited Events",
    "Competitive Elements",
    "Collection/Completion"
  ];

  // Include more categories for higher depth
  const categoriesToInclude = categories.slice(0, Math.min(categories.length, 3 + depth * 2));
  categoriesToInclude.forEach(cat => sections.push(`- ${cat}`));

  return sections.join('\n');
}

/**
 * Parse the Python script output and extract the JSON
 */
export function parseResearchOutput(output: string): any {
  try {
    // Try to find JSON in the output
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // If no JSON found, try to parse the whole output
    return JSON.parse(output);
  } catch (error) {
    console.error('Failed to parse research output:', error);
    throw new Error('Could not parse research output as JSON');
  }
}
