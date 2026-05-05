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
  // Optional metadata for more accurate connector collision modelling.
  // When present, CollisionEngine can use real node kinds (e.g. final_good)
  // instead of heuristics based on node id strings.
  nodeKinds?: Map<string, string>;
  edges: Array<{from: string; to: string}>;
  padding: {x: number; y: number};
}

export type CollisionStrategy = 'avoid' | 'minimize' | 'allow';

export interface CollisionConfig {
  strategy: CollisionStrategy;
  nodeToNode: boolean;
  edgeToNode: boolean;
  margin: number;
}
