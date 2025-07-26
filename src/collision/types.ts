/**
 * Collision detection types and interfaces
 */

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Line {
  start: Point;
  end: Point;
}

export interface CollisionResult {
  collides: boolean;
  distance?: number;
  penetration?: Point;
}

export interface CollisionContext {
  nodePositions: Map<string, Rectangle>;
  edges: Array<{from: string; to: string}>;
  padding: {x: number; y: number};
}

export type CollisionStrategy = 'avoid' | 'minimize' | 'allow';

export interface CollisionConfig {
  strategy: CollisionStrategy;
  nodeToNode: boolean;
  edgeToNode: boolean;
  edgeToEdge: boolean;
  margin: number;
}