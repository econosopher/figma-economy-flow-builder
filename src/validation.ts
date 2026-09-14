/// <reference types="@figma/plugin-typings" />

import { V2Edge, V2Graph, V2Node } from './types';
import { COLOR } from './constants';

export function validateGraphData(data: Partial<V2Graph> | any): string[] {
  const errors: string[] = [];
  if (!data) {
    errors.push("Data is null or undefined.");
    return errors;
  }

  if (data.schemaVersion !== 2) {
    errors.push("'schemaVersion' must be 2.");
  }

  const stageIds = new Set<string>();
  const laneIds = new Set<string>();
  const nodeIds = new Set<string>();

  if (!Array.isArray(data.stages)) {
    errors.push("'stages' property must be an array.");
  } else {
    data.stages.forEach((stage: any, i: number) => {
      validateId(stage?.id, `Stage ${i}`, errors, stageIds);
      if (typeof stage?.label !== 'string') errors.push(`Stage ${i}: 'label' is missing or not a string.`);
    });
  }

  if (data.lanes !== undefined) {
    if (!Array.isArray(data.lanes)) {
      errors.push("'lanes' property must be an array.");
    } else {
      data.lanes.forEach((lane: any, i: number) => {
        validateId(lane?.id, `Lane ${i}`, errors, laneIds);
        if (typeof lane?.label !== 'string') errors.push(`Lane ${i}: 'label' is missing or not a string.`);
        if (lane?.color && !isValidColor(lane.color)) {
          errors.push(`Lane ${i}: Invalid color format '${lane.color}'.`);
        }
      });
    }
  }

  if (!Array.isArray(data.nodes)) {
    errors.push("'nodes' property must be an array.");
  } else {
    data.nodes.forEach((node: V2Node, i: number) => {
      validateId(node?.id, `Node ${i}`, errors, nodeIds);
      if (typeof node?.label !== 'string') errors.push(`Node ${i}: 'label' is missing or not a string.`);
      if (typeof node?.stageId !== 'string') {
        errors.push(`Node ${i}: 'stageId' is missing or not a string.`);
      } else if (!stageIds.has(node.stageId)) {
        errors.push(`Node ${i}: stageId '${node.stageId}' not found in stages.`);
      }
      if (node.sources && !Array.isArray(node.sources)) errors.push(`Node ${i}: 'sources' must be an array of strings.`);
      if (node.sinks && !Array.isArray(node.sinks)) errors.push(`Node ${i}: 'sinks' must be an array of strings.`);
      if (node.values && !Array.isArray(node.values)) errors.push(`Node ${i}: 'values' must be an array of strings.`);
      if (node.notes !== undefined && typeof node.notes !== 'string') errors.push(`Node ${i}: 'notes' must be a string when provided.`);
      if (node.inputRole !== undefined && !['time', 'money'].includes(node.inputRole)) {
        errors.push(`Node ${i}: inputRole must be 'time' or 'money'.`);
      }

      if (node.laneId !== undefined && typeof node.laneId !== 'string') {
        errors.push(`Node ${i}: 'laneId' must be a string when provided.`);
      } else if (node.laneId && Array.isArray(data.lanes) && data.lanes.length > 0 && !laneIds.has(node.laneId)) {
        errors.push(`Node ${i}: laneId '${node.laneId}' not found in lanes.`);
      }

    });
  }

  if (!Array.isArray(data.edges)) {
    errors.push("'edges' property must be an array.");
  } else {
    data.edges.forEach((edge: V2Edge, i: number) => {
      if (!edge || typeof edge !== 'object' || Array.isArray(edge)) {
        errors.push(`Edge ${i}: must be an object with 'from' and 'to'.`);
        return;
      }
      if (typeof edge.from !== 'string') errors.push(`Edge ${i}: 'from' is missing or not a string.`);
      else if (!nodeIds.has(edge.from)) errors.push(`Edge ${i}: 'from' id '${edge.from}' not found in nodes.`);
      if (typeof edge.to !== 'string') errors.push(`Edge ${i}: 'to' is missing or not a string.`);
      else if (!nodeIds.has(edge.to)) errors.push(`Edge ${i}: 'to' id '${edge.to}' not found in nodes.`);
      if (edge.type && !['normal', 'value', 'final', 'cross-lane'].includes(edge.type)) {
        errors.push(`Edge ${i}: type '${edge.type}' is not supported.`);
      }
      if (edge.feedback !== undefined && typeof edge.feedback !== 'boolean') {
        errors.push(`Edge ${i}: 'feedback' must be a boolean when provided.`);
      }
      if (edge.label !== undefined && typeof edge.label !== 'string') {
        errors.push(`Edge ${i}: 'label' must be a string when provided.`);
      }
    });
  }

  return errors;
}

function validateId(id: unknown, label: string, errors: string[], ids: Set<string>) {
  if (typeof id !== 'string') {
    errors.push(`${label}: 'id' is missing or not a string.`);
    return;
  }
  if (!/^[a-z0-9_]+$/.test(id)) {
    errors.push(`${label}: 'id' must be snake_case (lowercase, digits, underscores).`);
  }
  if (ids.has(id)) {
    errors.push(`${label}: Duplicate id '${id}'.`);
  }
  ids.add(id);
}

export function isValidColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

export function validateCustomColors(colors: any): { [key: string]: string } {
  const defaultColors = {
    sink: COLOR.INITIAL_SINK_NODE,
    source: COLOR.SOURCE_GREEN,
    xp: COLOR.XP_ORANGE,
    final: COLOR.FINAL_GOOD_YELLOW,
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
