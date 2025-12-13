import { Pathfinder } from '../collision/pathfinding';
import { Rectangle, Point } from '../collision/types';

describe('Pathfinder', () => {
    let pathfinder: Pathfinder;

    beforeEach(() => {
        pathfinder = new Pathfinder(10, 0); // 10px grid, 0 margin
    });

    it('should find a straight path when no obstacles', () => {
        const start: Point = { x: 0, y: 0 };
        const end: Point = { x: 50, y: 0 };
        const path = pathfinder.findPath(start, end, []);

        expect(path).not.toBeNull();
        expect(path!.length).toBeGreaterThan(0);
        expect(path![path!.length - 1]).toEqual(end);
    });

    it('should find a path around an obstacle', () => {
        const start: Point = { x: 0, y: 0 };
        const end: Point = { x: 100, y: 0 };
        const obstacle: Rectangle = { x: 40, y: -10, width: 20, height: 20 }; // Block the straight line

        const path = pathfinder.findPath(start, end, [obstacle]);

        expect(path).not.toBeNull();
        // Path should go around
        const hasDetour = path!.some(p => p.y !== 0);
        expect(hasDetour).toBe(true);
    });

    it('should return null if no path exists', () => {
        // Let's box it in completely
        const box: Rectangle[] = [
            { x: -10, y: -10, width: 120, height: 10 }, // Top
            { x: -10, y: 10, width: 120, height: 10 }, // Bottom
            { x: -10, y: -10, width: 10, height: 30 }, // Left
            { x: 100, y: -10, width: 10, height: 30 }  // Right
        ];

        // Start inside, end outside
        const start: Point = { x: 50, y: 0 };
        const end: Point = { x: 150, y: 0 };
        const path = pathfinder.findPath(start, end, box);
        expect(path).toBeNull();
    });
});
