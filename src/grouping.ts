/// <reference types="@figma/plugin-typings" />

/**
 * Reorder children of a group so connectors render behind non-connectors.
 * In Figma, earlier children are behind later ones. We move connectors first,
 * then non-connectors, by appending existing nodes which moves them to the end.
 */
export function reorderConnectorsBehind(group: GroupNode) {
  const children = [...group.children];
  const connectors = children.filter(c => c.type === 'CONNECTOR');
  const others = children.filter(c => c.type !== 'CONNECTOR');

  // Append existing nodes to reorder: connectors first (back), then others (front)
  connectors.forEach(c => group.appendChild(c));
  others.forEach(o => group.appendChild(o));
}

