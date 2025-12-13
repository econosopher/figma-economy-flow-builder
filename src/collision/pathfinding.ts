import { Point, Rectangle } from './types';
import { CollisionDetector } from './detector';

interface Node {
    x: number;
    y: number;
    g: number;
    h: number;
    f: number;
    parent: Node | null;
}

/**
 * Simple min-heap implementation for A* pathfinding
 */
class MinHeap {
    private heap: Node[] = [];

    push(node: Node): void {
        this.heap.push(node);
        this.bubbleUp(this.heap.length - 1);
    }

    pop(): Node | undefined {
        if (this.heap.length === 0) return undefined;
        if (this.heap.length === 1) return this.heap.pop();

        const min = this.heap[0];
        this.heap[0] = this.heap.pop()!;
        this.bubbleDown(0);
        return min;
    }

    get length(): number {
        return this.heap.length;
    }

    find(predicate: (node: Node) => boolean): Node | undefined {
        return this.heap.find(predicate);
    }

    private bubbleUp(index: number): void {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            if (this.heap[parentIndex].f <= this.heap[index].f) break;
            [this.heap[parentIndex], this.heap[index]] = [this.heap[index], this.heap[parentIndex]];
            index = parentIndex;
        }
    }

    private bubbleDown(index: number): void {
        const length = this.heap.length;
        for (;;) {
            const leftChild = 2 * index + 1;
            const rightChild = 2 * index + 2;
            let smallest = index;

            if (leftChild < length && this.heap[leftChild].f < this.heap[smallest].f) {
                smallest = leftChild;
            }
            if (rightChild < length && this.heap[rightChild].f < this.heap[smallest].f) {
                smallest = rightChild;
            }
            if (smallest === index) break;

            [this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]];
            index = smallest;
        }
    }
}

export class Pathfinder {
    private gridSize: number;
    private margin: number;

    constructor(gridSize: number = 20, margin: number = 20) {
        this.gridSize = gridSize;
        this.margin = margin;
    }

    findPath(start: Point, end: Point, obstacles: Rectangle[]): Point[] | null {
        // Snap start and end to grid
        const startNode: Node = {
            x: Math.round(start.x / this.gridSize),
            y: Math.round(start.y / this.gridSize),
            g: 0,
            h: 0,
            f: 0,
            parent: null
        };
        const endNode: Node = {
            x: Math.round(end.x / this.gridSize),
            y: Math.round(end.y / this.gridSize),
            g: 0,
            h: 0,
            f: 0,
            parent: null
        };

        // Use min-heap for O(log n) operations instead of O(n log n) sort
        const openList = new MinHeap();
        openList.push(startNode);
        const closedList: Set<string> = new Set();

        // Limit iterations to prevent infinite loops
        let iterations = 0;
        const maxIterations = 2000;

        while (openList.length > 0 && iterations < maxIterations) {
            iterations++;

            const currentNode = openList.pop()!;
            const currentKey = `${currentNode.x},${currentNode.y}`;

            if (currentNode.x === endNode.x && currentNode.y === endNode.y) {
                return this.reconstructPath(currentNode);
            }

            closedList.add(currentKey);

            const neighbors = this.getNeighbors(currentNode);
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x},${neighbor.y}`;
                if (closedList.has(neighborKey)) continue;

                // Check collision with obstacles
                const worldPos = {
                    x: neighbor.x * this.gridSize,
                    y: neighbor.y * this.gridSize
                };

                // Simple point collision check
                // For more accuracy, we could check the line segment from current to neighbor
                if (this.isColliding(worldPos, obstacles)) {
                    continue;
                }

                const gScore = currentNode.g + 1; // Assuming uniform cost
                const existingNeighbor = openList.find(n => n.x === neighbor.x && n.y === neighbor.y);

                if (!existingNeighbor || gScore < existingNeighbor.g) {
                    neighbor.g = gScore;
                    neighbor.h = Math.abs(neighbor.x - endNode.x) + Math.abs(neighbor.y - endNode.y);
                    neighbor.f = neighbor.g + neighbor.h;
                    neighbor.parent = currentNode;

                    if (!existingNeighbor) {
                        openList.push(neighbor);
                    }
                }
            }
        }

        return null; // No path found
    }

    private getNeighbors(node: Node): Node[] {
        const directions = [
            { x: 0, y: -1 }, // Up
            { x: 0, y: 1 },  // Down
            { x: -1, y: 0 }, // Left
            { x: 1, y: 0 }   // Right
        ];

        return directions.map(dir => ({
            x: node.x + dir.x,
            y: node.y + dir.y,
            g: 0,
            h: 0,
            f: 0,
            parent: null
        }));
    }

    private isColliding(point: Point, obstacles: Rectangle[]): boolean {
        // Create a small rect around the point to represent the connector thickness
        const pointRect: Rectangle = {
            x: point.x - 2,
            y: point.y - 2,
            width: 4,
            height: 4
        };

        for (const obstacle of obstacles) {
            if (CollisionDetector.rectanglesOverlap(pointRect, obstacle, this.margin).collides) {
                return true;
            }
        }
        return false;
    }

    private reconstructPath(node: Node): Point[] {
        const path: Point[] = [];
        let current: Node | null = node;
        while (current) {
            path.push({
                x: current.x * this.gridSize,
                y: current.y * this.gridSize
            });
            current = current.parent;
        }
        return path.reverse();
    }
}
