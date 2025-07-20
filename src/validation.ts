/// <reference types="@figma/plugin-typings" />

import { Graph, Input, Act } from './types';

export function validateGraphData(data: Partial<Graph>): string[] {
  const errors: string[] = [];
  if (!data) {
    errors.push("Data is null or undefined.");
    return errors;
  }

  const ids = new Set<string>();

  if (!Array.isArray(data.inputs)) {
    errors.push("'inputs' property must be an array.");
  } else {
    data.inputs.forEach((input: Input, i: number) => {
      if (typeof input.id !== 'string') errors.push(`Input ${i}: 'id' is missing or not a string.`);
      else ids.add(input.id);
      if (typeof input.label !== 'string') errors.push(`Input ${i}: 'label' is missing or not a string.`);
      if (typeof input.kind !== 'string') errors.push(`Input ${i}: 'kind' is missing or not a string.`);
    });
  }

  if (!Array.isArray(data.nodes)) {
    errors.push("'nodes' property must be an array.");
  } else {
    data.nodes.forEach((node: Act, i: number) => {
      if (typeof node.id !== 'string') errors.push(`Node ${i}: 'id' is missing or not a string.`);
      else ids.add(node.id);
      if (typeof node.label !== 'string') errors.push(`Node ${i}: 'label' is missing or not a string.`);
      if (node.sources && !Array.isArray(node.sources)) errors.push(`Node ${i}: 'sources' must be an array of strings.`);
      if (node.sinks && !Array.isArray(node.sinks)) errors.push(`Node ${i}: 'sinks' must be an array of strings.`);
      if (node.values && !Array.isArray(node.values)) errors.push(`Node ${i}: 'values' must be an array of strings.`);
    });
  }

  if (!Array.isArray(data.edges)) {
    errors.push("'edges' property must be an array.");
  } else {
    data.edges.forEach((edge: [string, string] | [string], i: number) => {
      if (!Array.isArray(edge) || (edge.length !== 2 && edge.length !== 1) || typeof edge[0] !== 'string') {
        errors.push(`Edge ${i}: must be an array of one or two strings.`);
      } else {
        if (!ids.has(edge[0])) errors.push(`Edge ${i}: 'from' id '${edge[0]}' not found in inputs or nodes.`);
        if (edge.length === 2 && (typeof edge[1] !== 'string' || !ids.has(edge[1]))) errors.push(`Edge ${i}: 'to' id '${edge[1]}' not found in inputs or nodes.`);
      }
    });
  }

  // Validate subsections if present
  if (data.subsections !== undefined) {
    if (!Array.isArray(data.subsections)) {
      errors.push("'subsections' property must be an array.");
    } else {
      const subsectionIds = new Set<string>();
      data.subsections.forEach((subsection: any, i: number) => {
        if (typeof subsection.id !== 'string') {
          errors.push(`Subsection ${i}: 'id' is missing or not a string.`);
        } else {
          if (subsectionIds.has(subsection.id)) {
            errors.push(`Subsection ${i}: Duplicate subsection id '${subsection.id}'.`);
          }
          subsectionIds.add(subsection.id);
        }
        if (typeof subsection.label !== 'string') {
          errors.push(`Subsection ${i}: 'label' is missing or not a string.`);
        }
        if (!Array.isArray(subsection.nodeIds)) {
          errors.push(`Subsection ${i}: 'nodeIds' must be an array of strings.`);
        } else {
          subsection.nodeIds.forEach((nodeId: any, j: number) => {
            if (typeof nodeId !== 'string') {
              errors.push(`Subsection ${i}, nodeId ${j}: Must be a string.`);
            } else if (!ids.has(nodeId)) {
              errors.push(`Subsection ${i}: Node id '${nodeId}' not found in inputs or nodes.`);
            }
          });
        }
        if (subsection.color && !isValidColor(subsection.color)) {
          errors.push(`Subsection ${i}: Invalid color format '${subsection.color}'.`);
        }
      });
    }
  }

  return errors;
}

export function isValidColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

export function validateCustomColors(colors: any): { [key: string]: string } {
  const defaultColors = {
    sink: '#DA5433',
    source: '#4CAF50',
    xp: '#EC9F53',
    final: '#F5C95C',
  };

  if (!colors || typeof colors !== 'object') {
    return defaultColors;
  }

  const validated: { [key: string]: string } = {};
  for (const [key, value] of Object.entries(defaultColors)) {
    if (colors[key] && isValidColor(colors[key])) {
      validated[key] = colors[key];
    } else {
      validated[key] = value;
    }
  }

  return validated;
}