import { SpatialGrid } from '../collision/spatial-grid';
import { Rectangle } from '../collision/types';

describe('SpatialGrid', () => {
    let grid: SpatialGrid;

    beforeEach(() => {
        grid = new SpatialGrid(100);
    });

    it('should insert and query items correctly', () => {
        const rect1: Rectangle = { x: 10, y: 10, width: 50, height: 50 };
        grid.insert('node1', rect1);

        const result = grid.query(rect1);
        expect(result).toContain('node1');
    });

    it('should handle items spanning multiple cells', () => {
        const rect2: Rectangle = { x: 50, y: 50, width: 100, height: 100 };
        // Spans 0,0; 1,0; 0,1; 1,1 roughly
        grid.insert('node2', rect2);

        const queryRect: Rectangle = { x: 120, y: 120, width: 10, height: 10 };
        const result = grid.query(queryRect);
        expect(result).toContain('node2');
    });

    it('should return empty array for empty query', () => {
        const rect: Rectangle = { x: 0, y: 0, width: 10, height: 10 };
        const result = grid.query(rect);
        expect(result).toEqual([]);
    });

    it('should clear the grid', () => {
        grid.insert('node1', { x: 0, y: 0, width: 10, height: 10 });
        grid.clear();
        const result = grid.query({ x: 0, y: 0, width: 10, height: 10 });
        expect(result).toEqual([]);
    });
});
