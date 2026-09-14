export interface ConventionViolation {
  code: string;
  message: string;
  cardId?: string;
  edgeId?: string;
}

export interface ConventionCheckResult {
  ready: boolean;
  violations: ConventionViolation[];
}

interface StructuralCard {
  id: string;
  label: string;
  stageId?: string;
  kind: string;
  inputRole?: unknown;
  notes: string;
}

interface StructuralEdge {
  id: string;
  from: string;
  to: string;
  feedback: boolean;
  label: string;
}

function objectValue(value: unknown): { [key: string]: unknown } | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as { [key: string]: unknown }
    : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeCards(graph: { [key: string]: unknown }): StructuralCard[] {
  const source = Array.isArray(graph.cards)
    ? graph.cards
    : [
        ...(Array.isArray(graph.inputs) ? graph.inputs : []),
        ...(Array.isArray(graph.nodes) ? graph.nodes : []),
      ];
  return source.reduce<StructuralCard[]>((cards, value) => {
    const card = objectValue(value);
    if (!card || typeof card.id !== 'string') return cards;
    const cameFromInputs =
      Array.isArray(graph.inputs) && graph.inputs.indexOf(value) !== -1;
    cards.push({
      id: card.id,
      label: text(card.label),
      stageId: typeof card.stageId === 'string' ? card.stageId : undefined,
      kind: text(card.kind) || (cameFromInputs ? 'initial_sink_node' : 'action'),
      inputRole: card.inputRole,
      notes: text(card.notes),
    });
    return cards;
  }, []);
}

function normalizeEdges(graph: { [key: string]: unknown }): StructuralEdge[] {
  if (!Array.isArray(graph.edges)) return [];
  return graph.edges.reduce<StructuralEdge[]>((edges, value, index) => {
    if (Array.isArray(value)) {
      if (typeof value[0] === 'string' && typeof value[1] === 'string')
        edges.push({
          id: `edge-${index}`,
          from: value[0],
          to: value[1],
          feedback: false,
          label: '',
        });
      return edges;
    }
    const edge = objectValue(value);
    if (!edge || typeof edge.from !== 'string' || typeof edge.to !== 'string')
      return edges;
    edges.push({
      id: typeof edge.id === 'string' ? edge.id : `edge-${index}`,
      from: edge.from,
      to: edge.to,
      feedback: edge.feedback === true,
      label: text(edge.label),
    });
    return edges;
  }, []);
}

function roleFor(card: StructuralCard): 'time' | 'money' | undefined {
  if (card.inputRole === 'time' || card.inputRole === 'money')
    return card.inputRole;
  if (card.inputRole !== undefined) return undefined;
  if (card.label === 'Spend Time') return 'time';
  if (card.label === 'Spend Money') return 'money';
  return undefined;
}

function hasNotApplicableExplanation(notes: string): boolean {
  return /^\s*not applicable\s*(?::|-|\u2013|\u2014)\s*\S+/i.test(notes);
}

/**
 * Checks the conventions required for a released economy diagram. It accepts
 * v2 `nodes`, v3 `cards`, or a normalized `inputs` + `nodes` graph and never
 * throws for malformed structural input.
 */
export function checkEconomyConventions(graph: unknown): ConventionCheckResult {
  const violations: ConventionViolation[] = [];
  const data = objectValue(graph);
  if (!data) {
    return {
      ready: false,
      violations: [{
        code: 'invalid_graph',
        message: 'The economy diagram must be an object.',
      }],
    };
  }

  const stages = Array.isArray(data.stages)
    ? data.stages.reduce<string[]>((ids, value) => {
        const stage = objectValue(value);
        if (stage && typeof stage.id === 'string') ids.push(stage.id);
        return ids;
      }, [])
    : [];
  const firstStageId = stages[0];
  const lastStageId = stages.length ? stages[stages.length - 1] : undefined;
  const stageIndex = new Map<string, number>();
  stages.forEach((stageId, index) => stageIndex.set(stageId, index));
  const cards = normalizeCards(data);
  const cardById = new Map<string, StructuralCard>();
  cards.forEach(card => cardById.set(card.id, card));
  const edges = normalizeEdges(data);
  const initialCards = cards.filter(card => card.kind === 'initial_sink_node');
  const firstStageCards = firstStageId === undefined
    ? initialCards
    : cards.filter(card => card.stageId === firstStageId);
  const firstStageInputs = firstStageCards.filter(
    card => card.kind === 'initial_sink_node',
  );

  if (stages.length === 0) {
    violations.push({
      code: 'missing_stages',
      message: 'Add ordered stages so release direction can be checked.',
    });
  }
  if (firstStageInputs.length !== 2) {
    violations.push({
      code: 'initial_input_count',
      message: `The first stage must contain exactly two initial inputs; found ${firstStageInputs.length}.`,
    });
  }
  firstStageCards.forEach(card => {
    if (card.kind !== 'initial_sink_node')
      violations.push({
        code: 'first_stage_action',
        cardId: card.id,
        message: `Move “${card.label}” after the input stage. Only player inputs belong in the first stage.`,
      });
  });
  initialCards.forEach(card => {
    if (firstStageId !== undefined && card.stageId !== firstStageId)
      violations.push({
        code: 'initial_input_stage',
        cardId: card.id,
        message: `Move initial input “${card.label}” to the first stage.`,
      });
  });

  const roleCards: { time?: StructuralCard; money?: StructuralCard } = {};
  firstStageInputs.forEach(card => {
    if (
      card.inputRole !== undefined &&
      card.inputRole !== 'time' &&
      card.inputRole !== 'money'
    ) {
      violations.push({
        code: 'invalid_input_role',
        cardId: card.id,
        message: `Initial input “${card.label}” has an invalid inputRole. Use “time” or “money”.`,
      });
      return;
    }
    const role = roleFor(card);
    if (!role) {
      violations.push({
        code: 'missing_input_role',
        cardId: card.id,
        message: `Identify “${card.label}” as the time or real-money input. Labels infer a role only when exactly “Spend Time” or “Spend Money”.`,
      });
      return;
    }
    const expectedLabel = role === 'time' ? 'Spend Time' : 'Spend Money';
    if (card.label !== expectedLabel)
      violations.push({
        code: 'input_label',
        cardId: card.id,
        message: `Rename the ${role} input to “${expectedLabel}”. Release input labels are canonical.`,
      });
    if (roleCards[role]) {
      violations.push({
        code: 'duplicate_input_role',
        cardId: card.id,
        message: `The first stage has more than one ${role} input. Keep one time input and one real-money input.`,
      });
      return;
    }
    roleCards[role] = card;
  });
  (['time', 'money'] as Array<'time' | 'money'>).forEach(role => {
    if (!roleCards[role])
      violations.push({
        code: `missing_${role}_input`,
        message: `Add one ${role === 'time' ? 'time' : 'real-money'} input to the first stage.`,
      });
  });
  cards.forEach(card => {
    if (card.kind !== 'initial_sink_node' && card.inputRole !== undefined)
      violations.push({
        code: 'input_role_on_action',
        cardId: card.id,
        message: `Remove inputRole from “${card.label}”. Only initial input cards may declare it.`,
      });
  });

  const forwardEdges: StructuralEdge[] = [];
  edges.forEach(edge => {
    const from = cardById.get(edge.from);
    const to = cardById.get(edge.to);
    if (!from || !to) return;
    if (edge.feedback) {
      if (!edge.label.trim())
        violations.push({
          code: 'feedback_label_required',
          edgeId: edge.id,
          message: `Label the return pipe from “${from.label}” to “${to.label}” so its feedback meaning is visible.`,
        });
      return;
    }
    const fromStage = from.stageId === undefined
      ? undefined
      : stageIndex.get(from.stageId);
    const toStage = to.stageId === undefined
      ? undefined
      : stageIndex.get(to.stageId);
    if (
      fromStage === undefined ||
      toStage === undefined ||
      fromStage >= toStage
    ) {
      violations.push({
        code: 'forward_edge_order',
        edgeId: edge.id,
        message: `Move “${to.label}” to a later stage than “${from.label}”, or mark this pipe as labeled feedback.`,
      });
      return;
    }
    forwardEdges.push(edge);
  });

  const incomingForward = new Set<string>();
  edges.forEach(edge => {
    if (!edge.feedback) incomingForward.add(edge.to);
  });
  const outgoing = new Map<string, string[]>();
  cards.forEach(card => outgoing.set(card.id, []));
  forwardEdges.forEach(edge => {
    const targets = outgoing.get(edge.from);
    if (targets) targets.push(edge.to);
  });
  initialCards.forEach(card => {
    if (incomingForward.has(card.id))
      violations.push({
        code: 'initial_input_incoming',
        cardId: card.id,
        message: `Remove forward pipes into initial input “${card.label}”. Player inputs must be roots.`,
      });
  });

  const time = roleCards.time;
  const money = roleCards.money;
  if (time && (outgoing.get(time.id) || []).length === 0)
    violations.push({
      code: 'time_input_disconnected',
      cardId: time.id,
      message: 'Connect the time input to at least one card in a later stage.',
    });
  const moneyNotApplicable = !!money && hasNotApplicableExplanation(money.notes);
  if (money) {
    const moneyConnections = (outgoing.get(money.id) || []).length;
    const moneyOutgoingEdges = edges.filter(edge => edge.from === money.id);
    if (moneyConnections === 0 && !moneyNotApplicable)
      violations.push({
        code: 'money_input_disconnected',
        cardId: money.id,
        message: 'Connect the real-money input, or add a note such as “Not applicable: this game has no real-money spending.”',
      });
    if (moneyOutgoingEdges.length > 0 && moneyNotApplicable)
      violations.push({
        code: 'money_input_not_applicable_conflict',
        cardId: money.id,
        message: 'Remove the real-money pipes or remove the Not applicable note; both cannot describe the same input.',
      });
  }

  const reachable = new Set<string>();
  const queue: string[] = [];
  if (time) queue.push(time.id);
  if (money && !moneyNotApplicable) queue.push(money.id);
  while (queue.length) {
    const id = queue.shift()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    (outgoing.get(id) || []).forEach(target => {
      if (!reachable.has(target)) queue.push(target);
    });
  }
  cards.forEach(card => {
    if (card.kind !== 'initial_sink_node' && !reachable.has(card.id))
      violations.push({
        code: 'card_unreachable',
        cardId: card.id,
        message: `Connect “${card.label}” to a strictly forward path from an applicable player input.`,
      });
    if (
      card.kind === 'final_good' &&
      lastStageId !== undefined &&
      card.stageId !== lastStageId
    )
      violations.push({
        code: 'final_good_stage',
        cardId: card.id,
        message: `Move final good “${card.label}” to the last stage.`,
      });
  });

  return { ready: violations.length === 0, violations };
}
