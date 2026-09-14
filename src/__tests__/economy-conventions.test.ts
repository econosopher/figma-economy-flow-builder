import { checkEconomyConventions } from '../economy-conventions';

function releaseGraph(): any {
  return {
    schemaVersion: 2,
    stages: [
      { id: 'input', label: 'Inputs' },
      { id: 'play', label: 'Play' },
      { id: 'outcome', label: 'Outcomes' },
    ],
    nodes: [
      {
        id: 'time',
        label: 'Spend Time',
        stageId: 'input',
        kind: 'initial_sink_node',
      },
      {
        id: 'money',
        label: 'Spend Money',
        stageId: 'input',
        kind: 'initial_sink_node',
      },
      { id: 'play', label: 'Play', stageId: 'play', kind: 'action' },
      {
        id: 'mastery',
        label: 'Mastery',
        stageId: 'outcome',
        kind: 'final_good',
      },
    ],
    edges: [
      { from: 'time', to: 'play' },
      { from: 'money', to: 'play' },
      { from: 'play', to: 'mastery' },
      {
        from: 'mastery',
        to: 'play',
        feedback: true,
        label: 'Replay for a higher rank',
      },
    ],
  };
}

describe('economy release conventions', () => {
  it('accepts exact legacy input labels and labeled feedback', () => {
    expect(checkEconomyConventions(releaseGraph())).toEqual({
      ready: true,
      violations: [],
    });
  });

  it('allows an explained non-monetized economy and still requires time reachability', () => {
    const graph = releaseGraph();
    graph.nodes[1] = {
      ...graph.nodes[1],
      notes: 'Not applicable: the game has no real-money purchases.',
    };
    graph.edges = graph.edges.filter((edge: { from: string }) => edge.from !== 'money');
    expect(checkEconomyConventions(graph).ready).toBe(true);
  });

  it('reports direction, feedback, reachability, and terminal-stage failures', () => {
    const graph = releaseGraph();
    graph.nodes.find((node: { id: string }) => node.id === 'mastery')!.stageId = 'play';
    graph.edges = [
      { from: 'time', to: 'play' },
      { from: 'play', to: 'money' },
      { from: 'mastery', to: 'play', feedback: true, label: '' },
    ];
    const codes = checkEconomyConventions(graph).violations.map(v => v.code);
    expect(codes).toEqual(expect.arrayContaining([
      'forward_edge_order',
      'feedback_label_required',
      'money_input_disconnected',
      'card_unreachable',
      'final_good_stage',
    ]));
  });

  it('requires canonical labels even with explicit roles and rejects roles on actions', () => {
    const graph = releaseGraph();
    graph.nodes[0].label = 'Player attention';
    graph.nodes[0].inputRole = 'time';
    graph.nodes[2].inputRole = 'money';
    const result = checkEconomyConventions(graph);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'input_label', cardId: 'time' }),
        expect.objectContaining({
          code: 'input_role_on_action',
          cardId: 'play',
        }),
      ]),
    );
    expect(result.violations.some(v =>
      v.code === 'missing_input_role' && v.cardId === 'time',
    )).toBe(false);
  });
});
