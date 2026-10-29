export type NodeId = `r${number}c${number}`;

export type NodeKind = "intersection" | "fork" | "dead-end" | "roundabout";

export interface Intersection {
  id: NodeId;
  row: number;
  col: number;
  kind?: NodeKind;
}

export interface Road {
  id: string;
  from: NodeId;
  to: NodeId;
  cost: number;
  oneWay?: boolean;
  speed?: number; // tiles per time unit, defaults to the max speed
  path?: [number, number][];
}

export interface Scenario {
  rows: number;
  cols: number;
  nodes: Intersection[];
  roads: Road[];
  entries: NodeId[];
  exits: NodeId[];
}


export const nodeId = (row: number, col: number): NodeId =>
  `r${row}c${col}`;

export const edgeKey = (a: NodeId, b: NodeId): string =>
  [a, b].sort().join("--");
