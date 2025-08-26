/// <reference types="@figma/plugin-typings" />

export interface Input { 
  id: string; 
  label: string; 
  kind: 'initial_sink_node';
}

export interface Act { 
  id: string; 
  label: string; 
  sources?: string[]; 
  sinks?: string[]; 
  values?: string[]; // Stores of Value 
  kind?: string;
}

export interface Subsection {
  id: string;
  label: string;
  nodeIds: string[]; // IDs of nodes that belong in this subsection
  color?: string; // Optional color for the subsection
}

export interface Graph { 
  name?: string; // Optional name for the game/economy
  inputs: Input[]; 
  nodes: Act[]; 
  edges: [string, string][];
  subsections?: Subsection[]; // Optional subsections
}

// UI to Plugin messages
export type DrawMessage = {
  cmd: 'draw';
  json: string;
  colors: { [key: string]: string };
};

export type ValidateMessage = { cmd: 'validate'; json: string };
export type ClearMessage = { cmd: 'clear' };
export type SyncMessage = { cmd: 'sync-from-canvas' };
export type GenerateCacheMessage = {
  cmd: 'generate-cache';
  gameName: string;
  depth: number;
  provider?: 'gemini' | 'claude';
  apiKey?: string;
};
export type GenerateEconomyMessage = { cmd: 'generate-economy'; gameName: string; depth: number; apiKey: string; provider?: string };
export type SaveApiKeyMessage = { cmd: 'save-api-key'; apiKey: string; validated?: boolean };
export type LoadApiKeyMessage = { cmd: 'load-api-key' };
export type ValidateApiKeyMessage = { cmd: 'validate-api-key'; apiKey: string };
export type SaveResearchInputsMessage = { cmd: 'save-research-inputs'; gameName: string; depth: number };
export type LoadResearchInputsMessage = { cmd: 'load-research-inputs' };
export type CreateGitHubPRMessage = { cmd: 'create-github-pr'; gameName: string; json: string; fileName: string };
export type PluginMessage =
  | DrawMessage
  | ValidateMessage
  | ClearMessage
  | SyncMessage
  | GenerateCacheMessage
  | GenerateEconomyMessage
  | SaveApiKeyMessage
  | LoadApiKeyMessage
  | ValidateApiKeyMessage
  | SaveResearchInputsMessage
  | LoadResearchInputsMessage
  | CreateGitHubPRMessage;

// Plugin to UI messages
export type ReplyMessage = {
  type: 'reply';
  msg: string | string[];
  ok: boolean;
};

export type TemplatesMessage = {
  type: 'templates';
  templates: any;
  colors: any;
};

export type SyncJSONMessage = {
  type: 'sync-json';
  json: string;
};

export type RestoreMessage = {
  type: 'restore';
  json?: string;
  colors?: { [key: string]: string };
};
export type ResearchResultMessage = {
  type: 'research-result';
  success: boolean;
  json?: string;
  error?: string;
};

export type CacheGeneratedMessage = {
  type: 'cache-generated';
  cache: string;
  markdown?: string;
};

export type EconomyGeneratedMessage = {
  type: 'economy-generated';
  json: string;
};

export type ApiKeyLoadedMessage = {
  type: 'api-key-loaded';
  apiKey: string;
  validated?: boolean;
};

export type ApiKeyValidationMessage = {
  type: 'api-key-validation';
  valid: boolean;
  error?: string;
};

export type ProgressUpdateMessage = {
  type: 'progress-update';
  step: number;
  percent: number;
  message: string;
};

export type ResearchInputsLoadedMessage = {
  type: 'research-inputs-loaded';
  gameName?: string;
  depth?: number;
};

export type UIMessage =
  | ReplyMessage
  | TemplatesMessage
  | SyncJSONMessage
  | RestoreMessage
  | ResearchResultMessage
  | CacheGeneratedMessage
  | EconomyGeneratedMessage
  | ApiKeyLoadedMessage
  | ApiKeyValidationMessage
  | ProgressUpdateMessage
  | ResearchInputsLoadedMessage;

export type ConnectorMagnet = 'NONE' | 'AUTO' | 'TOP' | 'LEFT' | 'BOTTOM' | 'RIGHT' | 'CENTER';

export interface EconomyFlowConnectorEndpoint {
  endpointNodeId: string;
  magnet: ConnectorMagnet;
}
