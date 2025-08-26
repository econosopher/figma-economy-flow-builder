/// <reference types="@figma/plugin-typings" />

import { Graph } from './types';
import { BOX_SIZE, COLOR, INITIAL_X_OFFSET } from './constants';
import { makeBox } from './node-creation';

export function extractCurrenciesByType(graph: Graph): { sinks: string[]; sources: string[]; values: string[] } {
  const sinks = new Set<string>();
  const sources = new Set<string>();
  const values = new Set<string>();

  graph.nodes.forEach(node => {
    node.sinks?.forEach(s => sinks.add(s));
    node.sources?.forEach(s => sources.add(s));
    node.values?.forEach(v => values.add(v));
  });

  return {
    sinks: Array.from(sinks).sort(),
    sources: Array.from(sources).sort(),
    values: Array.from(values).sort()
  };
}

export function createLegendSection(currencies: { sinks: string[]; sources: string[]; values: string[] }, initialSectionX: number): SectionNode | null {
  const legendNodes: SceneNode[] = [];
  const HEADER_HEIGHT = BOX_SIZE.NODE.H;
  const ITEM_SPACING = 5;
  const HEADER_MARGIN_BOTTOM = 10;
  const LEGEND_SECTION_SPACING = 50;
  const COLUMN_SPACING = BOX_SIZE.NODE.W + LEGEND_SECTION_SPACING;

  let currentX = INITIAL_X_OFFSET;
  let maxHeight = 0;

  const sections = [
    { type: 'Sinks', items: currencies.sinks, color: COLOR.INITIAL_SINK_NODE },
    { type: 'Sources', items: currencies.sources, color: COLOR.SOURCE_GREEN },
    { type: 'Stores of Value', items: currencies.values, color: COLOR.XP_ORANGE }
  ];

  sections.forEach(section => {
    if (section.items.length === 0) return;

    const headerBox = makeBox(section.type, BOX_SIZE.NODE.W, HEADER_HEIGHT, section.color);
    headerBox.x = currentX;
    headerBox.y = 0;
    legendNodes.push(headerBox);

    let currentY = HEADER_HEIGHT + HEADER_MARGIN_BOTTOM;
    section.items.forEach(item => {
      const itemBox = makeBox(item, BOX_SIZE.ATTR.W, BOX_SIZE.ATTR.H, section.color, 'LEFT');
      itemBox.x = currentX;
      itemBox.y = currentY;
      legendNodes.push(itemBox);
      currentY += BOX_SIZE.ATTR.H + ITEM_SPACING;
    });

    maxHeight = Math.max(maxHeight, currentY);
    currentX += COLUMN_SPACING;
  });

  if (legendNodes.length === 0) return null;

  const sectionPadding = { top: 80, right: 60, bottom: 60, left: 70 };
  const sectionWidth = currentX - INITIAL_X_OFFSET + sectionPadding.right;
  const sectionHeight = maxHeight + sectionPadding.top + sectionPadding.bottom;

  const legendSection = figma.createSection();
  legendSection.name = 'Legend';
  legendSection.x = initialSectionX;
  legendSection.y = 0;
  legendSection.resizeWithoutConstraints(sectionWidth, sectionHeight);

  legendNodes.forEach(node => {
    node.y += sectionPadding.top;
    legendSection.appendChild(node);
  });

  return legendSection;
}

