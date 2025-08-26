import { LayoutEngine } from '../layout';

describe('LayoutEngine.calculateSubsectionBounds', () => {
  it('applies larger padding for initial sections', () => {
    const engine = new LayoutEngine();

    // record positions for nodes
    engine.recordNodePosition('time', 0, 0, 144, 72);
    engine.recordNodePosition('money', 0, 100, 144, 72);

    // mock nodeDataMap entries to flag as initial_sink_node
    const nodeDataMap = new Map<any, any>([
      ['time', { id: 'time', label: 'Time', kind: 'initial_sink_node' }],
      ['money', { id: 'money', label: 'Money', kind: 'initial_sink_node' }]
    ]);

    const bounds = engine.calculateSubsectionBounds(['time', 'money'], nodeDataMap as any);

    // Without padding, minX=0, minY=0, maxX=144, maxY=172 (0..72 and 100..172)
    // Initial section padding = { top: 80, right: 60, bottom: 60, left: 70 }
    expect(bounds.x).toBe(-70);
    expect(bounds.y).toBe(-80);
    expect(bounds.width).toBe(144 + 70 + 60);
    expect(bounds.height).toBe(172 + 80 + 60);
  });
});

