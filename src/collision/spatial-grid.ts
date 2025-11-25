import { Rectangle } from './types';

export class SpatialGrid {
    private cellSize: number;
    private grid: Map<string, Set<string>>;

    constructor(cellSize: number = 100) {
        this.cellSize = cellSize;
        this.grid = new Map();
    }

    private getKey(x: number, y: number): string {
        return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
    }

    private getKeysForRect(rect: Rectangle): string[] {
        const keys: string[] = [];
        const startX = Math.floor(rect.x / this.cellSize);
        const endX = Math.floor((rect.x + rect.width) / this.cellSize);
        const startY = Math.floor(rect.y / this.cellSize);
        const endY = Math.floor((rect.y + rect.height) / this.cellSize);

        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                keys.push(`${x},${y}`);
            }
        }
        return keys;
    }

    insert(id: string, rect: Rectangle) {
        const keys = this.getKeysForRect(rect);
        for (const key of keys) {
            if (!this.grid.has(key)) {
                this.grid.set(key, new Set());
            }
            this.grid.get(key)!.add(id);
        }
    }

    query(rect: Rectangle): string[] {
        const keys = this.getKeysForRect(rect);
        const results = new Set<string>();

        for (const key of keys) {
            const cell = this.grid.get(key);
            if (cell) {
                for (const id of cell) {
                    results.add(id);
                }
            }
        }

        return Array.from(results);
    }

    clear() {
        this.grid.clear();
    }
}
