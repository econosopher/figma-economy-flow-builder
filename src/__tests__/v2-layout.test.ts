import { CollisionDetector } from '../collision';
import { layoutV2Graph, routeV2Edges } from '../v2-layout';
import { Line } from '../collision';
import { V2Graph } from '../types';

const graph: V2Graph = {
  schemaVersion: 2,
  name: 'V2 Layout Test',
  stages: [
    { id: 'inputs', label: 'Inputs' },
    { id: 'earn', label: 'Earn' },
    { id: 'spend', label: 'Spend' },
    { id: 'outcomes', label: 'Outcomes' }
  ],
  lanes: [
    { id: 'core', label: 'Core' },
    { id: 'premium', label: 'Premium' }
  ],
  nodes: [
    { id: 'time', label: 'Spend Time', kind: 'initial_sink_node', stageId: 'inputs', laneId: 'core' },
    { id: 'money', label: 'Spend Money', kind: 'initial_sink_node', stageId: 'inputs', laneId: 'premium' },
    { id: 'play', label: 'Play Matches', stageId: 'earn', laneId: 'core', sources: ['XP'] },
    { id: 'buy', label: 'Buy Currency', stageId: 'earn', laneId: 'premium', sources: ['Coins'] },
    { id: 'upgrade', label: 'Upgrade Hero', stageId: 'spend', laneId: 'core', sinks: ['XP', 'Coins'] },
    { id: 'mastery', label: 'Master Hero', kind: 'final_good', stageId: 'outcomes', laneId: 'core' }
  ],
  edges: [
    { from: 'time', to: 'play' },
    { from: 'money', to: 'buy' },
    { from: 'play', to: 'upgrade' },
    { from: 'buy', to: 'upgrade', type: 'cross-lane' },
    { from: 'upgrade', to: 'mastery', type: 'final' }
  ]
};

describe('v2 deterministic layout', () => {
  it('places nodes in their declared stage and lane cells', () => {
    const layout = layoutV2Graph(graph);

    expect(layout.nodes.get('play')!.stageId).toBe('earn');
    expect(layout.nodes.get('play')!.laneId).toBe('core');
    expect(layout.nodes.get('buy')!.stageId).toBe('earn');
    expect(layout.nodes.get('buy')!.laneId).toBe('premium');
    expect(layout.nodes.get('buy')!.rect.y).toBeGreaterThan(layout.nodes.get('play')!.rect.y);
    expect(layout.nodes.get('upgrade')!.rect.x).toBeGreaterThan(layout.nodes.get('play')!.rect.x);
  });

  it('keeps final goods in the terminal stage', () => {
    const layout = layoutV2Graph(graph);
    const terminalStage = layout.stages[layout.stages.length - 1];

    expect(layout.nodes.get('mastery')!.stageId).toBe(terminalStage.id);
    expect(layout.nodes.get('mastery')!.rect.x).toBe(terminalStage.x);
  });
});

describe('v2 route planner', () => {
  it('routes connectors without intersecting non-endpoint node rectangles', () => {
    const layout = layoutV2Graph(graph);
    const routes = routeV2Edges(graph, layout);

    for (const route of routes) {
      const endpointIds = new Set([route.from, route.to]);
      for (const node of layout.nodes.values()) {
        if (endpointIds.has(node.id)) continue;
        const intersects = route.segments.some((segment: Line) =>
          CollisionDetector.lineIntersectsRectangle(segment, node.rect, 0).collides
        );
        expect(intersects).toBe(false);
      }
    }
  });
});
