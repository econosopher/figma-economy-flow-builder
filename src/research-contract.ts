export const RESEARCH_PROMPT_VERSION = '3.0';
export const RELEASE_CONVENTION_CHECKER = 'checkEconomyConventions';

export function buildEconomyGraphJsonSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['schemaVersion', 'stages', 'nodes', 'edges'],
    properties: {
      schemaVersion: { type: 'number', enum: [2] },
      name: { type: 'string', description: 'Optional display name for the graph.' },
      stages: {
        type: 'array',
        description: 'Ordered left-to-right stages/columns.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'label'],
          properties: {
            id: { type: 'string', description: 'Snake_case identifier.' },
            label: { type: 'string', description: 'Display label.' }
          }
        }
      },
      lanes: {
        type: 'array',
        description: 'Ordered vertical swimlanes.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'label'],
          properties: {
            id: { type: 'string' },
            label: { type: 'string' },
            color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' }
          }
        }
      },
      nodes: {
        type: 'array',
        description: 'Activities, systems, or goals inside the economy.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'label', 'stageId', 'sources', 'sinks', 'values'],
          properties: {
            id: { type: 'string', description: 'Snake_case identifier.' },
            label: { type: 'string', description: 'Display label.' },
            stageId: { type: 'string', description: 'Existing stage id.' },
            laneId: { type: 'string', description: 'Existing lane id.' },
            sources: { type: 'array', items: { type: 'string' } },
            sinks: { type: 'array', items: { type: 'string' } },
            values: { type: 'array', items: { type: 'string' } },
            kind: { type: 'string', enum: ['action', 'initial_sink_node', 'final_good'] },
            inputRole: { type: 'string', enum: ['time', 'money'] },
            notes: { type: 'string' }
          }
        }
      },
      edges: {
        type: 'array',
        description: 'Directed flow edges between existing node ids.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['from', 'to'],
          properties: {
            from: { type: 'string' },
            to: { type: 'string' },
            type: { type: 'string', enum: ['normal', 'value', 'final', 'cross-lane'] },
            feedback: { type: 'boolean' },
            label: { type: 'string' }
          }
        }
      }
    }
  };
}

function buildDepthFocus(depth: number): string[] {
  const focus = [
    'Map the core gameplay loop and the primary spendable resources.',
    'Identify which systems consume resources, which systems create spendable resources, and which systems create non-spendable progress values.'
  ];

  if (depth >= 2) {
    focus.push('Include side systems such as crafting, trading, events, guild or social loops, and time-gated systems.');
  }

  if (depth >= 3) {
    focus.push('Include monetization paths, optimization loops, end-game goals, and segmentation-relevant sinks or accelerators.');
  }

  return focus;
}

export function createResearchBrief(gameName: string, depth: number): string {
  return [
    `Research the economy and progression systems of "${gameName}".`,
    'Produce a factual research summary grounded in observed systems rather than generic mobile-game patterns.',
    ...buildDepthFocus(depth),
    'When uncertain, prefer fewer high-confidence systems over speculative detail.',
    'Organize findings around player inputs, activities, resources produced, resources consumed, and final goals.'
  ].join('\n');
}

export function createEconomyJsonPrompt(gameName: string, depth: number): string {
  return [
    `Convert research about "${gameName}" into the Economy Flow plugin JSON format.`,
    `Research depth: ${depth}.`,
    '',
    'Output requirements:',
    '- Return a single JSON object only.',
    '- Required top-level keys: "schemaVersion", "stages", "nodes", "edges". Optional: "name", "lanes".',
    '- Always set "schemaVersion": 2.',
    '- Use snake_case ids only.',
    '- Define ordered left-to-right "stages" and assign every node to a stageId.',
    '- Define ordered vertical "lanes" when they clarify the graph, and assign laneId when useful.',
    '- Every node must include arrays for "sources", "sinks", and "values", even if empty.',
    '- The first stage contains exactly two nodes and no activities: "Spend Time" and "Spend Money".',
    '- Set kind = "initial_sink_node" and inputRole = "time" on Spend Time.',
    '- Set kind = "initial_sink_node" and inputRole = "money" on Spend Money; this means real-world spending, not earned currency.',
    '- If the game has no real-money spending, keep Spend Money disconnected and add a notes explanation beginning "Not applicable:"; never invent a paid mechanic.',
    '- Final goals may use kind = "final_good".',
    '- Final-good nodes must be assigned to the last/terminal stage.',
    '- Every edge must be an object with "from" and "to" referencing existing node ids.',
    '- Every non-input node must be reachable from an applicable input using only non-feedback edges.',
    '- Every non-feedback edge must move to a strictly later stage.',
    '- A same-stage or backward edge must set feedback = true and have a short, visible, non-empty label.',
    '- Prefer a compact, high-signal graph over exhaustive low-value detail.',
    `- Treat ${RELEASE_CONVENTION_CHECKER} as a release hard gate after schema validation; repair every violation before release or export.`,
    '',
    'Semantic rules:',
    '- "sources" are spendable outputs created by a system.',
    '- "sinks" are spendable inputs consumed by a system.',
    '- "values" are accumulated progress metrics that are not directly spent elsewhere.',
    '- Use lanes to separate major economy areas such as core gameplay, monetization, progression, events, and outcomes.',
    '',
    'If your research workflow used Gemini Deep Research, treat this as a second structured conversion step from the report into JSON.'
  ].join('\n');
}
