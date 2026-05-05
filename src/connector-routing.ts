import { Line, Point } from './collision';
import { Act, ConnectorMagnet, Input } from './types';

export type ConnectorOrientation = 'horizontal-first' | 'vertical-first';

export interface ConnectorEndpointCounts {
  outgoing: Map<string, number>;
  incoming: Map<string, number>;
}

export interface ConnectorRoutingSpec {
  startMagnet: ConnectorMagnet;
  endMagnet: ConnectorMagnet;
  dashPattern?: number[];
  strokeColor?: string;
  strokeOpacity?: number;
  mode: 'auto' | 'deterministic';
}

export function countConnectorEndpoints(edges: [string, string][]): ConnectorEndpointCounts {
  const outgoing = new Map<string, number>();
  const incoming = new Map<string, number>();

  edges.forEach(([fromId, toId]) => {
    if (fromId) {
      outgoing.set(fromId, (outgoing.get(fromId) || 0) + 1);
    }
    if (toId) {
      incoming.set(toId, (incoming.get(toId) || 0) + 1);
    }
  });

  return { outgoing, incoming };
}

export function buildConnectorRoutingSpec(
  fromId: string,
  toId: string,
  nodeDataMap: Map<string, Input | Act>,
  counts: ConnectorEndpointCounts
): ConnectorRoutingSpec {
  const hasFanOut = (counts.outgoing.get(fromId) || 0) > 1;
  const hasFanIn = (counts.incoming.get(toId) || 0) > 1;
  const usesAutoRouting = hasFanOut || hasFanIn;
  const targetNode = nodeDataMap.get(toId);
  const isFinalGood = targetNode?.kind === 'final_good';

  return {
    startMagnet: usesAutoRouting ? 'AUTO' : 'RIGHT',
    endMagnet: usesAutoRouting ? 'AUTO' : 'LEFT',
    dashPattern: isFinalGood ? [10, 10] : undefined,
    mode: usesAutoRouting ? 'auto' : 'deterministic'
  };
}

export function buildConnectorSegments(
  start: Point,
  end: Point,
  orientation: ConnectorOrientation = 'horizontal-first'
): Line[] {
  if (Math.abs(start.x - end.x) < 1 && Math.abs(start.y - end.y) < 1) {
    return [];
  }

  if (Math.abs(start.y - end.y) < 1 || Math.abs(start.x - end.x) < 1) {
    return [{ start, end }];
  }

  if (orientation === 'vertical-first') {
    const turn: Point = { x: start.x, y: end.y };
    return [
      { start, end: turn },
      { start: turn, end }
    ].filter(segment =>
      Math.abs(segment.start.x - segment.end.x) > 0.5 ||
      Math.abs(segment.start.y - segment.end.y) > 0.5
    );
  }

  const midX = start.x + (end.x - start.x) / 2;
  return [
    { start, end: { x: midX, y: start.y } },
    { start: { x: midX, y: start.y }, end: { x: midX, y: end.y } },
    { start: { x: midX, y: end.y }, end }
  ].filter(segment =>
    Math.abs(segment.start.x - segment.end.x) > 0.5 ||
    Math.abs(segment.start.y - segment.end.y) > 0.5
  );
}
