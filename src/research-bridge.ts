/**
 * Bridge between Figma plugin and deep research Python script
 * This module handles the communication with the external research system
 */

import {
  buildEconomyGraphJsonSchema,
  createEconomyJsonPrompt,
  createResearchBrief,
  RESEARCH_PROMPT_VERSION
} from './research-contract';
import { V2Edge, V2Graph, V2Lane, V2Node, V2Stage } from './types';
import { validateGraphData } from './validation';

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
  provider?: 'gemini' | 'openai' | 'claude';
}

interface ResearchCache {
  game: string;
  depth: number;
  timestamp: string;
  prompt_version: string;
  instructions: string;
  conversion_prompt?: string;
  json_schema?: unknown;
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
      prompt_version: RESEARCH_PROMPT_VERSION,
      instructions: createResearchBrief(request.gameName, request.depth),
      conversion_prompt: createEconomyJsonPrompt(request.gameName, request.depth),
      json_schema: buildEconomyGraphJsonSchema(),
      research_phases: {}
    };

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
          apiKey: request.apiKey,
          promptVersion: RESEARCH_PROMPT_VERSION,
          researchBrief: createResearchBrief(request.gameName, request.depth),
          conversionPrompt: createEconomyJsonPrompt(request.gameName, request.depth),
          responseMimeType: 'application/json',
          responseJsonSchema: buildEconomyGraphJsonSchema()
        })
      },
      60000,
      1
    );
    if (data.success && data.json) {
      const repaired = repairEconomyJSON(data.json);
      const validationErrors = validateGraphData(repaired);
      if (validationErrors.length > 0) {
        throw new Error(`Returned JSON did not validate after repair: ${validationErrors.slice(0, 10).join(' | ')}`);
      }
      return repaired;
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
  // Some providers return JSON as a string (sometimes wrapped in markdown/logs).
  if (typeof json === 'string') {
    try {
      json = parseResearchOutput(json, { quiet: true });
    } catch {
      return emptyV2Graph();
    }
  }

  if (!json || typeof json !== 'object') {
    return emptyV2Graph();
  }

  const sourceNodes = Array.isArray(json.nodes) ? json.nodes : [];
  const sourceInputs = Array.isArray(json.inputs) ? json.inputs : [];
  const allSourceNodes = json.schemaVersion === 2 ? sourceNodes : [...sourceInputs, ...sourceNodes];
  const validIds = new Set<string>();
  const idMapping = new Map<string, string>();

  const stageSource = Array.isArray(json.stages) && json.stages.length > 0
    ? json.stages
    : inferLegacyStages(json);
  const repairedStages = repairStages(stageSource);
  const terminalStageId = repairedStages[repairedStages.length - 1].id;

  const laneSource = Array.isArray(json.lanes) && json.lanes.length > 0
    ? json.lanes
    : inferLegacyLanes(json);
  const repairedLanes = repairLanes(laneSource);
  const laneIds = new Set(repairedLanes.map(lane => lane.id));
  const stageIds = new Set(repairedStages.map(stage => stage.id));

  const repairedNodes: V2Node[] = allSourceNodes.map((node: any, index: number) => {
    const originalId = node.id || `node_${index + 1}`;
    const newId = toSnakeCase(String(originalId));
    idMapping.set(originalId, newId);
    validIds.add(newId);

    const kind = repairNodeKind(node.kind, sourceInputs.some((input: any) => input === node || input.id === node.id));
    const requestedStageId = typeof node.stageId === 'string' ? toSnakeCase(node.stageId) : undefined;
    const stageId = kind === 'final_good'
      ? terminalStageId
      : (requestedStageId && stageIds.has(requestedStageId) ? requestedStageId : inferLegacyStageId(json, node, repairedStages));
    const requestedLaneId = typeof node.laneId === 'string' ? toSnakeCase(node.laneId) : undefined;
    const laneId = requestedLaneId && laneIds.has(requestedLaneId)
      ? requestedLaneId
      : inferLegacyLaneId(json, node, repairedLanes);

    return {
      id: newId,
      label: node.label || originalId,
      stageId,
      laneId,
      sources: Array.isArray(node.sources) ? node.sources.filter((v: unknown) => typeof v === 'string') : [],
      sinks: Array.isArray(node.sinks) ? node.sinks.filter((v: unknown) => typeof v === 'string') : [],
      values: Array.isArray(node.values) ? node.values.filter((v: unknown) => typeof v === 'string') : [],
      kind
    };
  });

  const repairedEdges: V2Edge[] = [];
  const edges = Array.isArray(json.edges) ? json.edges : [];
  edges.forEach((edge: any) => {
    let from: string | undefined;
    let to: string | undefined;
    let edgeType: string | undefined;

    if (!Array.isArray(edge) && typeof edge === 'object') {
      from = edge.from || edge.source;
      to = edge.to || edge.target || edge.sink;
      edgeType = edge.type;
    } else if (Array.isArray(edge) && edge.length >= 2) {
      from = edge[0];
      to = edge[1];
    }

    if (from && to) {
      // Map to new snake_case IDs if possible, otherwise try snake_casing them directly
      const fromId = idMapping.get(from) || toSnakeCase(from);
      const toId = idMapping.get(to) || toSnakeCase(to);

      if (validIds.has(fromId) && validIds.has(toId)) {
        const targetNode = repairedNodes.find(node => node.id === toId);
        const repairedType = repairEdgeType(edgeType, targetNode?.kind === 'final_good');
        repairedEdges.push(repairedType ? { from: fromId, to: toId, type: repairedType } : { from: fromId, to: toId });
      }
    }
  });

  return {
    schemaVersion: 2,
    name: json.name || 'Economy Graph',
    stages: repairedStages,
    lanes: repairedLanes,
    nodes: repairedNodes,
    edges: repairedEdges
  } as V2Graph;
}

function emptyV2Graph(): V2Graph {
  return {
    schemaVersion: 2,
    name: 'Economy Graph',
    stages: [{ id: 'inputs', label: 'Inputs' }, { id: 'outcomes', label: 'Outcomes' }],
    lanes: [{ id: 'main', label: 'Main' }],
    nodes: [],
    edges: []
  };
}

function toSnakeCase(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'item';
}

function repairStages(stages: any[]): V2Stage[] {
  const seen = new Set<string>();
  const repaired = stages.map((stage, index) => {
    const base = toSnakeCase(stage?.id || stage?.label || `stage_${index + 1}`);
    const id = uniqueId(base, seen);
    return { id, label: typeof stage?.label === 'string' ? stage.label : id };
  });
  return repaired.length > 0 ? repaired : emptyV2Graph().stages;
}

function repairLanes(lanes: any[]): V2Lane[] {
  const seen = new Set<string>();
  const repaired = lanes.map((lane, index) => {
    const base = toSnakeCase(lane?.id || lane?.label || `lane_${index + 1}`);
    const id = uniqueId(base, seen);
    const out: V2Lane = { id, label: typeof lane?.label === 'string' ? lane.label : id };
    if (typeof lane?.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(lane.color)) {
      out.color = lane.color;
    }
    return out;
  });
  return repaired.length > 0 ? repaired : [{ id: 'main', label: 'Main' }];
}

function uniqueId(base: string, seen: Set<string>): string {
  let id = base;
  let index = 2;
  while (seen.has(id)) {
    id = `${base}_${index++}`;
  }
  seen.add(id);
  return id;
}

function repairNodeKind(kind: unknown, isInput: boolean): string {
  if (isInput || kind === 'initial_sink_node') return 'initial_sink_node';
  if (kind === 'finalGood' || kind === 'final-good' || kind === 'final_good') return 'final_good';
  return 'action';
}

function repairEdgeType(type: unknown, isFinal: boolean): V2Edge['type'] | undefined {
  if (isFinal) return 'final';
  return type === 'normal' || type === 'value' || type === 'cross-lane' ? type : undefined;
}

function inferLegacyStages(json: any): V2Stage[] {
  const allNodes = [...(Array.isArray(json.inputs) ? json.inputs : []), ...(Array.isArray(json.nodes) ? json.nodes : [])];
  if (allNodes.length === 0) return emptyV2Graph().stages;
  const ids = allNodes.map((node: any, index: number) => node.id || `node_${index + 1}`);
  const columns = new Map(ids.map((id: string) => [id, 0]));
  const edges = Array.isArray(json.edges) ? json.edges : [];
  let changed = true;
  let guard = 0;
  while (changed && guard++ < ids.length * ids.length) {
    changed = false;
    edges.forEach((edge: any) => {
      const from = Array.isArray(edge) ? edge[0] : edge?.from;
      const to = Array.isArray(edge) ? edge[1] : edge?.to;
      if (columns.has(from) && columns.has(to) && (columns.get(to) || 0) <= (columns.get(from) || 0)) {
        columns.set(to, (columns.get(from) || 0) + 1);
        changed = true;
      }
    });
  }
  const maxNonFinal = Math.max(...allNodes.filter((node: any) => repairNodeKind(node.kind, false) !== 'final_good').map((node: any) => columns.get(node.id) || 0), 0);
  const terminal = maxNonFinal + 1;
  const uniqueColumns = Array.from(new Set(allNodes.map((node: any) => repairNodeKind(node.kind, false) === 'final_good' ? terminal : columns.get(node.id) || 0))).sort((a, b) => a - b);
  return uniqueColumns.map((_, index) => ({
    id: index === uniqueColumns.length - 1 ? 'outcomes' : `stage_${index + 1}`,
    label: index === 0 ? 'Inputs' : (index === uniqueColumns.length - 1 ? 'Outcomes' : `Stage ${index + 1}`)
  }));
}

function inferLegacyLanes(json: any): V2Lane[] {
  if (Array.isArray(json.subsections) && json.subsections.length > 0) {
    return json.subsections.map((sub: any) => ({
      id: sub.id || sub.label,
      label: sub.label || sub.id,
      color: sub.color
    }));
  }
  return [{ id: 'main', label: 'Main' }];
}

function inferLegacyStageId(json: any, node: any, stages: V2Stage[]): string {
  if (json.schemaVersion === 2 && typeof node.stageId === 'string') {
    const requested = toSnakeCase(node.stageId);
    if (stages.some(stage => stage.id === requested)) return requested;
  }

  const inputIds = new Set((Array.isArray(json.inputs) ? json.inputs : []).map((input: any) => input.id));
  if (inputIds.has(node.id)) return stages[0].id;
  return stages[Math.min(1, stages.length - 1)].id;
}

function inferLegacyLaneId(json: any, node: any, lanes: V2Lane[]): string {
  if (json.schemaVersion === 2 && typeof node.laneId === 'string') {
    const requested = toSnakeCase(node.laneId);
    if (lanes.some(lane => lane.id === requested)) return requested;
  }

  for (const sub of Array.isArray(json.subsections) ? json.subsections : []) {
    if (Array.isArray(sub.nodeIds) && sub.nodeIds.includes(node.id)) {
      const id = toSnakeCase(sub.id || sub.label || '');
      if (lanes.some(lane => lane.id === id)) return id;
    }
  }

  return lanes[0].id;
}

/**
 * Create a markdown file for research input
 * This matches the format expected by the deep_research_economy script
 */
export function createResearchMarkdown(gameName: string, depth: number): string {
  const sections = [];
  const schema = JSON.stringify(buildEconomyGraphJsonSchema(), null, 2);

  sections.push(`# ${gameName} Economy Research`);
  sections.push(`\n## Overview`);
  sections.push(`Research depth: Level ${depth}`);
  sections.push(`Generated: ${new Date().toISOString()}`);
  sections.push(`Prompt version: ${RESEARCH_PROMPT_VERSION}`);

  sections.push(`\n## Research Brief`);
  sections.push(createResearchBrief(gameName, depth));

  sections.push(`\n## Structured Conversion Prompt`);
  sections.push(createEconomyJsonPrompt(gameName, depth));

  sections.push(`\n## Output JSON Schema`);
  sections.push('```json');
  sections.push(schema);
  sections.push('```');

  return sections.join('\n');
}

/**
 * Parse the Python script output and extract the JSON
 */
export function parseResearchOutput(output: string, options: { quiet?: boolean } = {}): any {
  try {
    const candidates: string[] = [];

    // Prefer fenced code blocks first (common for ChatGPT/Gemini responses).
    const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
    let fenceMatch: RegExpExecArray | null;
    while ((fenceMatch = fenceRegex.exec(output)) !== null) {
      candidates.push(fenceMatch[1]);
    }

    // Always try the full output as a fallback.
    candidates.push(output);

    let fallback: unknown;

    for (const candidate of candidates) {
      const trimmed = candidate.trim();
      if (!trimmed) continue;

      // Try direct parse first.
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        const unwrapped = unwrapJsonString(parsed);
        if (looksLikeEconomyGraph(unwrapped)) return unwrapped;
        if (fallback === undefined) fallback = unwrapped;
      } catch {
        // continue to extraction
      }

      const extractedValues = extractJsonValues(trimmed);
      for (const extracted of extractedValues) {
        try {
          const parsed = JSON.parse(extracted) as unknown;
          const unwrapped = unwrapJsonString(parsed);
          if (looksLikeEconomyGraph(unwrapped)) return unwrapped;
          if (fallback === undefined) fallback = unwrapped;
        } catch {
          // continue
        }
      }
    }

    if (fallback !== undefined) return fallback;

    throw new Error('Could not parse research output as JSON');
  } catch (error) {
    if (!options.quiet) {
      console.error('Failed to parse research output:', error);
    }
    throw new Error('Could not parse research output as JSON');
  }
}

export function looksLikeEconomyGraph(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const obj = value as any;
  return (
    Array.isArray(obj.stages) && Array.isArray(obj.nodes) && Array.isArray(obj.edges)
  ) || (
    Array.isArray(obj.inputs) && Array.isArray(obj.nodes) && Array.isArray(obj.edges)
  );
}

function unwrapJsonString(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function extractJsonValues(text: string): string[] {
  const results: string[] = [];

  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch !== '{' && ch !== '[') continue;

    const end = findMatchingBracketEnd(text, i);
    if (end !== null) {
      results.push(text.slice(i, end + 1));
      // Continue scanning after this start; don't skip to end because nested JSON could exist,
      // and we want the earliest valid parse even if earlier fragments are non-JSON.
    }
  }

  return results;
}

function findMatchingBracketEnd(text: string, startIndex: number): number | null {
  const open = text[startIndex];
  const close = open === '{' ? '}' : open === '[' ? ']' : null;
  if (!close) return null;

  const stack: string[] = [close];
  let inString = false;
  let escape = false;

  for (let i = startIndex + 1; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0) return i;
    }
  }

  return null;
}
