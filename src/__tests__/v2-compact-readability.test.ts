import * as fs from 'fs';
import * as path from 'path';

import { CollisionDetector } from '../collision';
import { V2Graph } from '../types';
import { layoutV2Graph, routeV2Edges } from '../v2-layout';

function loadExample(fileName: string): V2Graph {
  const filePath = path.join(__dirname, '..', '..', 'examples', fileName);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

describe('v2 compact readability', () => {
  const diceThrone = loadExample('dice_throne_digital.json');

  it('shrinks Dice Throne width by at least 25 percent from the literal v2 grid baseline', () => {
    const literalGridBaselineWidth = 1564;
    const layout = layoutV2Graph(diceThrone);

    expect(layout.bounds.width).toBeLessThanOrEqual(literalGridBaselineWidth * 0.75);
  });

  it('keeps final-good nodes in the terminal stage and vertically near their incoming sources', () => {
    const layout = layoutV2Graph(diceThrone);
    const terminalStageId = diceThrone.stages[diceThrone.stages.length - 1].id;
    const finalGoodIds = new Set(diceThrone.nodes.filter(node => node.kind === 'final_good').map(node => node.id));

    for (const finalGoodId of finalGoodIds) {
      const target = layout.nodes.get(finalGoodId)!;
      const incoming = diceThrone.edges
        .filter(edge => edge.to === finalGoodId)
        .map(edge => layout.nodes.get(edge.from)!)
        .filter(Boolean);
      const incomingCenters = incoming.map(node => node.rect.y + node.rect.height / 2);
      const averageIncomingCenter = incomingCenters.reduce((sum, y) => sum + y, 0) / incomingCenters.length;
      const targetCenter = target.rect.y + target.rect.height / 2;

      expect(target.stageId).toBe(terminalStageId);
      expect(Math.abs(targetCenter - averageIncomingCenter)).toBeLessThanOrEqual(260);
    }
  });

  it('routes repeated fan-out sources through deterministic shared junctions', () => {
    const layout = layoutV2Graph(diceThrone);
    const routes = routeV2Edges(diceThrone, layout);

    for (const sourceId of ['spend_time', 'purchase_crown_coin_packs', 'unlock_heroes']) {
      const outgoingRoutes = routes.filter(route => route.from === sourceId);
      const junctionIds = new Set(outgoingRoutes.map(route => (route as any).junctionId).filter(Boolean));

      expect(outgoingRoutes.length).toBeGreaterThanOrEqual(3);
      expect(junctionIds).toEqual(new Set([`junction:${sourceId}`]));
    }
  });

  it('keeps compact Dice Throne routes away from non-endpoint cards', () => {
    const layout = layoutV2Graph(diceThrone);
    const routes = routeV2Edges(diceThrone, layout);

    for (const route of routes) {
      const endpoints = new Set([route.from, route.to]);
      for (const node of layout.nodes.values()) {
        if (endpoints.has(node.id)) continue;

        const intersects = route.segments.some(segment =>
          CollisionDetector.lineIntersectsRectangle(segment, node.rect, 0).collides
        );
        expect(intersects).toBe(false);
      }
    }
  });
});
