import { LayoutEngine } from '../layout';
import { BOX_SIZE, INITIAL_X_OFFSET } from '../constants';
import { CollisionEngine, CollisionDetector, Rectangle, Line, Point } from '../collision';

const collisionEngine = new CollisionEngine({ margin: 14 });

function buildSegments(start: Point, end: Point, mode: 'horizontal-first' | 'vertical-first'): Line[] {
  if (start.x === end.x || start.y === end.y) {
    return [{ start, end }];
  }

  if (mode === 'vertical-first') {
    const verticalTurn: Point = { x: start.x, y: end.y };
    const segments: Line[] = [];
    if (start.x !== verticalTurn.x || start.y !== verticalTurn.y) {
      segments.push({ start, end: verticalTurn });
    }
    if (verticalTurn.x !== end.x || verticalTurn.y !== end.y) {
      segments.push({ start: verticalTurn, end });
    }
    return segments.length > 0 ? segments : [{ start, end }];
  }

  const midX = start.x + (end.x - start.x) / 2;
  const horizontalEnd: Point = { x: midX, y: start.y };
  const verticalEnd: Point = { x: midX, y: end.y };

  const segments: Line[] = [];
  if (start.x !== horizontalEnd.x || start.y !== horizontalEnd.y) {
    segments.push({ start, end: horizontalEnd });
  }
  if (horizontalEnd.x !== verticalEnd.x || horizontalEnd.y !== verticalEnd.y) {
    segments.push({ start: horizontalEnd, end: verticalEnd });
  }
  if (verticalEnd.x !== end.x || verticalEnd.y !== end.y) {
    segments.push({ start: verticalEnd, end });
  }
  return segments.length > 0 ? segments : [{ start, end }];
}

describe('LayoutEngine collision-aware placement', () => {
  it('stacks nodes vertically to avoid same-column overlap', () => {
    const engine = new LayoutEngine();

    // Simulate previously placed node at column 1
    const colIndex = 1;
    const paddingX = 100;
    const paddingY = 21;
    const x = INITIAL_X_OFFSET + (colIndex * (BOX_SIZE.NODE.W + paddingX));
    const topNodeHeight = 200; // simulate node with attributes
    engine.recordNodePosition('n1', x, 50, BOX_SIZE.NODE.W, topNodeHeight);

    // New node would collide at y_initial
    const y_initial = 60;
    const y = engine.findConflictFreeY(
      'n2',
      colIndex,
      y_initial,
      paddingX,
      paddingY,
      { id: 'n2', label: 'Node 2' },
      new Map()
    );

    // Should be pushed below n1 by padding + margin (margin configured in LayoutEngine)
    expect(y).toBeGreaterThanOrEqual(50 + topNodeHeight + paddingY);
  });

  it('avoids edge crossing through intermediate nodes (multi blockers)', () => {
    const engine = new LayoutEngine();

    // Place parent at column 0
    const paddingX = 100;
    const paddingY = 21;
    const parentX = INITIAL_X_OFFSET + (0 * (BOX_SIZE.NODE.W + paddingX));
    engine.recordNodePosition('p', parentX, 0, BOX_SIZE.NODE.W, 90);

    // Two blockers in middle column (col 1) at different heights
    const midX = INITIAL_X_OFFSET + (1 * (BOX_SIZE.NODE.W + paddingX));
    engine.recordNodePosition('b1', midX, 40, BOX_SIZE.NODE.W, 90);
    engine.recordNodePosition('b2', midX, 200, BOX_SIZE.NODE.W, 90);

    // Child target column 2; initialY would route through b1
    const childCol = 2;
    const y_initial = 0;
    const y = engine.findConflictFreeY(
      'c',
      childCol,
      y_initial,
      paddingX,
      paddingY,
      { id: 'c', label: 'Child' },
      new Map<string, string[]>([['c', ['p']]])
    );

    const parentRect: Rectangle = { x: parentX, y: 0, width: BOX_SIZE.NODE.W, height: 90 };
    const blockerRects: Rectangle[] = [
      { x: midX, y: 40, width: BOX_SIZE.NODE.W, height: 90 },
      { x: midX, y: 200, width: BOX_SIZE.NODE.W, height: 90 }
    ];
    const childRect: Rectangle = {
      x: INITIAL_X_OFFSET + (childCol * (BOX_SIZE.NODE.W + paddingX)),
      y,
      width: BOX_SIZE.NODE.W,
      height: 90
    };

    const start = collisionEngine.getNodeConnectionPoint('p', parentRect, 'output');
    const end = collisionEngine.getNodeConnectionPoint('c', childRect, 'input');
    const orientations: Array<'horizontal-first' | 'vertical-first'> = ['horizontal-first', 'vertical-first'];

    const hasSafePath = orientations.some(mode => {
      const segments = buildSegments(start, end, mode);
      return blockerRects.every(rect =>
        segments.every(segment => !CollisionDetector.lineIntersectsRectangle(segment, rect, 14).collides)
      );
    });

    expect(hasSafePath).toBe(true);
  });

  it('avoids edge crossing when parent is below initial child Y', () => {
    const engine = new LayoutEngine();

    const paddingX = 100;
    const paddingY = 21;

    // Parent placed lower on the page
    const parentX = INITIAL_X_OFFSET + (0 * (BOX_SIZE.NODE.W + paddingX));
    engine.recordNodePosition('p', parentX, 220, BOX_SIZE.NODE.W, 90);

    // Blocker in middle column intersects the path from parent to child
    const midX = INITIAL_X_OFFSET + (1 * (BOX_SIZE.NODE.W + paddingX));
    engine.recordNodePosition('b', midX, 100, BOX_SIZE.NODE.W, 90);

    // Child in column 2 with initial Y above parent and would cross blocker
    const childCol = 2;
    const y_initial = 0;
    const y = engine.findConflictFreeY(
      'c',
      childCol,
      y_initial,
      paddingX,
      paddingY,
      { id: 'c', label: 'Child' },
      new Map<string, string[]>([['c', ['p']]])
    );

    const parentRect: Rectangle = { x: parentX, y: 220, width: BOX_SIZE.NODE.W, height: 90 };
    const blockerRect: Rectangle = { x: midX, y: 100, width: BOX_SIZE.NODE.W, height: 90 };
    const childRect: Rectangle = {
      x: INITIAL_X_OFFSET + (childCol * (BOX_SIZE.NODE.W + paddingX)),
      y,
      width: BOX_SIZE.NODE.W,
      height: 90
    };

    const start = collisionEngine.getNodeConnectionPoint('p', parentRect, 'output');
    const end = collisionEngine.getNodeConnectionPoint('c', childRect, 'input');
    const orientations: Array<'horizontal-first' | 'vertical-first'> = ['horizontal-first', 'vertical-first'];

    const hasSafePath = orientations.some(mode => {
      const segments = buildSegments(start, end, mode);
      return segments.every(segment => !CollisionDetector.lineIntersectsRectangle(segment, blockerRect, 14).collides);
    });

    expect(hasSafePath).toBe(true);
    expect(y).toBeGreaterThanOrEqual(0);
  });
});
