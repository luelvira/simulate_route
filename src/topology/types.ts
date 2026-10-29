export type NodeId = `r${number}c${number}`;

export interface Intersection {
  id: NodeId;
  row: number;
  col: number;
}

export interface Road {
  id: string;
  from: NodeId;
  to: NodeId;
  cost: number;
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
