/// <reference types="@figma/plugin-typings" />

export interface Input { 
  id: string; 
  label: string; 
  kind: 'SINK_RED';
}

export interface Act { 
  id: string; 
  label: string; 
  sources?: string[]; 
  sinks?: string[]; 
  values?: string[]; 
  kind?: string;
}

export interface Subsection {
  id: string;
  label: string;
  nodeIds: string[]; // IDs of nodes that belong in this subsection
  color?: string; // Optional color for the subsection
}

export interface Graph { 
  inputs: Input[]; 
  nodes: Act[]; 
  edges: ([string, string] | [string])[];
  subsections?: Subsection[]; // Optional subsections
}

// UI to Plugin messages
export type DrawMessage = {
  cmd: 'draw';
  json: string;
  colors: { [key: string]: string };
};

export type ClearMessage = { cmd: 'clear' };
export type SyncMessage = { cmd: 'sync-from-canvas' };
export type PluginMessage = DrawMessage | ClearMessage | SyncMessage;

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

export type UIMessage = ReplyMessage | TemplatesMessage | SyncJSONMessage;

export type ConnectorMagnet = 'NONE' | 'AUTO' | 'TOP' | 'LEFT' | 'BOTTOM' | 'RIGHT' | 'CENTER';

export interface EconomyFlowConnectorEndpoint {
  endpointNodeId: string;
  magnet: ConnectorMagnet;
}