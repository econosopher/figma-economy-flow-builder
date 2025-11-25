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
        const start: Point = { x: 0, y: 0 };
        const end: Point = { x: 100, y: 0 };
        // Create a wall
        const obstacles: Rectangle[] = [
            { x: 50, y: -100, width: 10, height: 200 }
        ];

        // Limit iterations in test by using a small grid or complex obstacle?
        // Actually, A* should just fail if it can't reach.
        // But with infinite space, it might go around very far.
        // Our implementation has a max iteration limit.

        // Let's box it in completely
        const box: Rectangle[] = [
            { x: -10, y: -10, width: 120, height: 10 }, // Top
            { x: -10, y: 10, width: 120, height: 10 }, // Bottom
            { x: -10, y: -10, width: 10, height: 30 }, // Left
            { x: 100, y: -10, width: 10, height: 30 }  // Right
        ];

        // Start inside, end outside
        const path = pathfinder.findPath({ x: 50, y: 0 }, { x: 150, y: 0 }, box);
        expect(path).toBeNull();
    });
});
