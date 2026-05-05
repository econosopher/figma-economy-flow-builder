import { INITIAL_X_OFFSET, INITIAL_Y_OFFSET } from './constants';
import { CollisionDetector, Line, Point, Rectangle } from './collision';
import { V2Edge, V2Graph, V2Lane, V2Node, V2Stage } from './types';

export const V2_COMPACT_SIZE = {
  NODE: { W: 126, H: 74 },
  INPUT: { W: 126, H: 74 },
  ATTR: { W: 104, H: 16 },
  FINAL_GOOD: { W: 126, H: 74 }
};

const STAGE_GAP = 82;
const NODE_STACK_GAP = 18;
const LANE_PADDING_Y = 30;
const LANE_GAP = 36;
const EXTERNAL_ROUTE_GAP = 48;
const FANOUT_THRESHOLD = 3;
const PORT_STEP = 13;

export interface V2PositionedStage extends V2Stage {
  x: number;
  width: number;
}

export interface V2PositionedLane extends V2Lane {
  y: number;
  height: number;
  activeY: number;
  activeHeight: number;
}

export interface V2PositionedNode {
  id: string;
  data: V2Node;
  stageId: string;
  laneId: string;
  rect: Rectangle;
}

export interface V2LayoutResult {
  stages: V2PositionedStage[];
  lanes: V2PositionedLane[];
  nodes: Map<string, V2PositionedNode>;
  bounds: Rectangle;
}

export interface V2EdgeRoute {
  edge: V2Edge;
  from: string;
  to: string;
  points: Point[];
  segments: Line[];
  junctionId?: string;
}

export function getV2NodeHeight(node: V2Node): number {
  if (node.kind === 'initial_sink_node' || node.kind === 'final_good') {
    return V2_COMPACT_SIZE.NODE.H;
  }

  const attrCount = (node.sources?.length || 0) + (node.sinks?.length || 0) + (node.values?.length || 0);
  return attrCount > 0
    ? V2_COMPACT_SIZE.NODE.H + (attrCount * (V2_COMPACT_SIZE.ATTR.H + 3)) + 4
    : V2_COMPACT_SIZE.NODE.H;
}

export function normalizeV2Lanes(graph: V2Graph): V2Lane[] {
  return graph.lanes && graph.lanes.length > 0
    ? graph.lanes
    : [{ id: 'main', label: 'Main' }];
}

export function layoutV2Graph(graph: V2Graph): V2LayoutResult {
  const lanes = normalizeV2Lanes(graph);
  const terminalStageId = graph.stages[graph.stages.length - 1]?.id;
  const laneHeights = new Map<string, number>();

  lanes.forEach(lane => laneHeights.set(lane.id, V2_COMPACT_SIZE.NODE.H + (LANE_PADDING_Y * 2)));

  lanes.forEach(lane => {
    const maxStageHeight = Math.max(
      ...graph.stages.map(stage => {
        const stack = graph.nodes.filter(node =>
          getEffectiveStageId(node, terminalStageId) === stage.id &&
          getEffectiveLaneId(node, lanes) === lane.id
        );
        if (stack.length === 0) return 0;
        return stack.reduce((sum, node) => sum + getV2NodeHeight(node), 0) + ((stack.length - 1) * NODE_STACK_GAP);
      }),
      0
    );
    laneHeights.set(lane.id, Math.max(laneHeights.get(lane.id) || 0, maxStageHeight + (LANE_PADDING_Y * 2)));
  });

  let currentY = INITIAL_Y_OFFSET;
  const positionedLanes: V2PositionedLane[] = lanes.map(lane => {
    const height = laneHeights.get(lane.id) || V2_COMPACT_SIZE.NODE.H + (LANE_PADDING_Y * 2);
    const positioned = { ...lane, y: currentY, height, activeY: currentY, activeHeight: height };
    currentY += height + LANE_GAP;
    return positioned;
  });

  const positionedStages: V2PositionedStage[] = graph.stages.map((stage, index) => ({
    ...stage,
    x: INITIAL_X_OFFSET + (index * (V2_COMPACT_SIZE.NODE.W + STAGE_GAP)),
    width: V2_COMPACT_SIZE.NODE.W
  }));

  const stageById = new Map(positionedStages.map(stage => [stage.id, stage]));
  const laneById = new Map(positionedLanes.map(lane => [lane.id, lane]));
  const nodes = new Map<string, V2PositionedNode>();

  positionedLanes.forEach(lane => {
    positionedStages.forEach(stage => {
      const stack = graph.nodes.filter(node =>
        getEffectiveStageId(node, terminalStageId) === stage.id &&
        getEffectiveLaneId(node, lanes) === lane.id
      );
      const stackHeight = stack.reduce((sum, node) => sum + getV2NodeHeight(node), 0) + Math.max(0, stack.length - 1) * NODE_STACK_GAP;
      let nodeY = lane.y + Math.max(LANE_PADDING_Y, (lane.height - stackHeight) / 2);

      stack.forEach(node => {
        const height = getV2NodeHeight(node);
        nodes.set(node.id, {
          id: node.id,
          data: node,
          stageId: stage.id,
          laneId: lane.id,
          rect: {
            x: stage.x,
            y: nodeY,
            width: V2_COMPACT_SIZE.NODE.W,
            height
          }
        });
        nodeY += height + NODE_STACK_GAP;
      });
    });
  });

  alignFinalGoodsNearIncomingSources(graph, nodes);
  updateLaneActiveBounds(positionedLanes, nodes);

  const nodeRects = Array.from(nodes.values()).map(node => node.rect);
  const minX = Math.min(...nodeRects.map(rect => rect.x));
  const minY = Math.min(...positionedLanes.map(lane => lane.y));
  const maxX = Math.max(...nodeRects.map(rect => rect.x + rect.width));
  const maxY = Math.max(...positionedLanes.map(lane => lane.y + lane.height));

  return {
    stages: positionedStages,
    lanes: positionedLanes,
    nodes,
    bounds: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    }
  };
}

export function routeV2Edges(graph: V2Graph, layout: V2LayoutResult): V2EdgeRoute[] {
  const outgoingIndexes = buildPortIndexes(graph.edges, 'from');
  const incomingIndexes = buildPortIndexes(graph.edges, 'to');
  const highFanoutSources = new Set(
    Array.from(outgoingIndexes.entries())
      .filter(([, edges]) => edges.length >= FANOUT_THRESHOLD)
      .map(([nodeId]) => nodeId)
  );

  return graph.edges.map(edge => {
    const from = layout.nodes.get(edge.from);
    const to = layout.nodes.get(edge.to);
    if (!from || !to) {
      return { edge, from: edge.from, to: edge.to, points: [], segments: [] };
    }

    const start = rightPort(from.rect, outgoingIndexes.get(edge.from)?.indexOf(edge) || 0, outgoingIndexes.get(edge.from)?.length || 1);
    const end = leftPort(to.rect, incomingIndexes.get(edge.to)?.indexOf(edge) || 0, incomingIndexes.get(edge.to)?.length || 1);
    const direct = buildSegments([start, end]);
    const needsExternalRoute =
      edge.type === 'cross-lane' ||
      from.laneId !== to.laneId ||
      routeIntersectsNonEndpoint(direct, layout, edge.from, edge.to);

    const junctionId = highFanoutSources.has(edge.from) ? `junction:${edge.from}` : undefined;
    let points = junctionId
      ? buildJunctionRoutePoints(start, end, from.rect, edge, needsExternalRoute, layout)
      : needsExternalRoute
      ? buildExternalRoutePoints(start, end, layout)
      : buildInternalRoutePoints(start, end);
    if (!needsExternalRoute && routeIntersectsNonEndpoint(buildSegments(points), layout, edge.from, edge.to)) {
      points = junctionId
        ? buildJunctionRoutePoints(start, end, from.rect, edge, true, layout)
        : buildExternalRoutePoints(start, end, layout);
    }

    return {
      edge,
      from: edge.from,
      to: edge.to,
      points,
      segments: buildSegments(points),
      junctionId
    };
  });
}

function alignFinalGoodsNearIncomingSources(graph: V2Graph, nodes: Map<string, V2PositionedNode>) {
  const finalGoods = graph.nodes
    .filter(node => node.kind === 'final_good')
    .map(node => nodes.get(node.id))
    .filter((node): node is V2PositionedNode => Boolean(node));
  if (finalGoods.length === 0) return;

  const desired = finalGoods.map(node => {
    const incomingSources = graph.edges
      .filter(edge => edge.to === node.id)
      .map(edge => nodes.get(edge.from))
      .filter((source): source is V2PositionedNode => Boolean(source));
    const sourceCenters = incomingSources.map(source => source.rect.y + source.rect.height / 2);
    const averageSourceCenter = sourceCenters.length > 0
      ? sourceCenters.reduce((sum, y) => sum + y, 0) / sourceCenters.length
      : node.rect.y + node.rect.height / 2;
    return {
      node,
      desiredY: averageSourceCenter - node.rect.height / 2
    };
  }).sort((a, b) => a.desiredY - b.desiredY);

  let previousBottom = -Infinity;
  desired.forEach(item => {
    const nextY = Math.max(item.desiredY, previousBottom + NODE_STACK_GAP);
    item.node.rect.y = nextY;
    previousBottom = nextY + item.node.rect.height;
  });

  for (let i = desired.length - 2; i >= 0; i--) {
    const current = desired[i].node;
    const next = desired[i + 1].node;
    const maxY = next.rect.y - NODE_STACK_GAP - current.rect.height;
    if (current.rect.y > maxY) {
      current.rect.y = maxY;
    }
  }
}

function updateLaneActiveBounds(lanes: V2PositionedLane[], nodes: Map<string, V2PositionedNode>) {
  lanes.forEach(lane => {
    const laneNodes = Array.from(nodes.values()).filter(node => node.laneId === lane.id);
    if (laneNodes.length === 0) {
      lane.activeY = lane.y;
      lane.activeHeight = lane.height;
      return;
    }

    const minY = Math.min(...laneNodes.map(node => node.rect.y));
    const maxY = Math.max(...laneNodes.map(node => node.rect.y + node.rect.height));
    lane.activeY = minY - LANE_PADDING_Y / 2;
    lane.activeHeight = (maxY - minY) + LANE_PADDING_Y;
  });
}

function getEffectiveStageId(node: V2Node, terminalStageId: string | undefined): string {
  return node.kind === 'final_good' && terminalStageId ? terminalStageId : node.stageId;
}

function getEffectiveLaneId(node: V2Node, lanes: V2Lane[]): string {
  return node.laneId || lanes[0].id;
}

function buildPortIndexes(edges: V2Edge[], key: 'from' | 'to'): Map<string, V2Edge[]> {
  const map = new Map<string, V2Edge[]>();
  edges.forEach(edge => {
    const id = edge[key];
    const list = map.get(id) || [];
    list.push(edge);
    map.set(id, list);
  });
  return map;
}

function leftPort(rect: Rectangle, index: number, count: number): Point {
  return { x: rect.x, y: portY(rect, index, count) };
}

function rightPort(rect: Rectangle, index: number, count: number): Point {
  return { x: rect.x + rect.width, y: portY(rect, index, count) };
}

function portY(rect: Rectangle, index: number, count: number): number {
  if (count <= 1) return rect.y + rect.height / 2;
  const center = rect.y + rect.height / 2;
  const offset = (index - (count - 1) / 2) * PORT_STEP;
  const min = rect.y + 10;
  const max = rect.y + rect.height - 10;
  return Math.max(min, Math.min(max, center + offset));
}

function buildInternalRoutePoints(start: Point, end: Point): Point[] {
  if (Math.abs(start.y - end.y) < 1) {
    return [start, end];
  }

  const midX = start.x + (end.x - start.x) / 2;
  return [
    start,
    { x: midX, y: start.y },
    { x: midX, y: end.y },
    end
  ];
}

function buildExternalRoutePoints(start: Point, end: Point, layout: V2LayoutResult): Point[] {
  const routeY = start.y <= end.y
    ? layout.bounds.y - EXTERNAL_ROUTE_GAP
    : layout.bounds.y + layout.bounds.height + EXTERNAL_ROUTE_GAP;
  const startGutterX = start.x + (STAGE_GAP / 2);
  const endGutterX = end.x - (STAGE_GAP / 2);

  return [
    start,
    { x: startGutterX, y: start.y },
    { x: startGutterX, y: routeY },
    { x: endGutterX, y: routeY },
    { x: endGutterX, y: end.y },
    end
  ];
}

function buildJunctionRoutePoints(
  start: Point,
  end: Point,
  sourceRect: Rectangle,
  edge: V2Edge,
  needsExternalRoute: boolean,
  layout: V2LayoutResult
): Point[] {
  const junction = { x: sourceRect.x + sourceRect.width + STAGE_GAP * 0.34, y: sourceRect.y + sourceRect.height / 2 };
  if (needsExternalRoute || edge.type === 'final') {
    const external = buildExternalRoutePoints(junction, end, layout);
    return [start, junction, ...external.slice(1)];
  }

  return [start, junction, { x: junction.x, y: end.y }, end];
}

function buildSegments(points: Point[]): Line[] {
  const segments: Line[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (Math.abs(start.x - end.x) > 0.5 || Math.abs(start.y - end.y) > 0.5) {
      segments.push({ start, end });
    }
  }
  return segments;
}

function routeIntersectsNonEndpoint(segments: Line[], layout: V2LayoutResult, fromId: string, toId: string): boolean {
  for (const node of layout.nodes.values()) {
    if (node.id === fromId || node.id === toId) continue;
    if (segments.some(segment => CollisionDetector.lineIntersectsRectangle(segment, node.rect, 0).collides)) {
      return true;
    }
  }

  return false;
}
