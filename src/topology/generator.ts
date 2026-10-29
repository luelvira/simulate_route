import { edgeKey, Intersection, NodeId, nodeId, Road, Scenario } from './types';

const CYCLE_RATIO = 0.85;

function shuffle<T>(items: T[]): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function pickDistinctRows(count: number, rows: number): number[] {
  return shuffle(Array.from({ length: rows }, (_, i) => i))
    .slice(0, count);
}



export function generateScenario(params: {
  rows: number,
  cols: number,
  entryCount: number,
  exitCount: number,
}): Scenario {
  if (!areValidParameters(params))
    throw new RangeError(
      "Require rows >= 1, cols >= 2 and " +
        "1 <= entryCount, exitCount <= rows.",
    );
  const nodes: Intersection[] = defineIntersectionArray(params.rows, params.cols);
  const byId = new Map(nodes.map(n => [n.id, n]));
  const visited = new Set<NodeId>();
  const roads = new Map<string, Road>();

  const addRoad = addRoadTo(roads);
  const neighbors = calculateCandidatesFor(params.rows, params.cols, byId);

  const start = nodes[Math.floor(Math.random() * nodes.length)];
  const stack: Intersection[] = [start]
  visited.add(start.id);

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const unvisited = shuffle(neighbors(current))
      .filter(n => !visited.has(n.id));

    if (unvisited.length === 0) {
      stack.pop();
      continue;
    }
    const next = unvisited[0];
    addRoad(current.id, next.id);
    visited.add(next.id);
    stack.push(next);
  }

  const candidates: [NodeId, NodeId][] = [];
  for (const node of nodes) {
    for (const [r, c] of [
      [node.row, node.col +1],
      [node.row + 1, node.col],
    ]) {
      if (r >= params.rows || c >= params.cols) continue;
      const other = nodeId(r, c);
      if (!roads.has(edgeKey(node.id, other))) {
        candidates.push([node.id, other]);
      }
    }
  }

  const extraCount = Math.round(candidates.length * CYCLE_RATIO);
  for (const [a, b] of shuffle(candidates).slice(0, extraCount)) addRoad(a, b);


  const entries = pickDistinctRows(params.entryCount, params.rows)
    .map((row) => nodeId(row, 0));

  const exits = pickDistinctRows(params.exitCount, params.rows)
    .map((row) => nodeId(row, params.cols - 1));

  const scenario: Scenario = {
    rows: params.rows,
    cols: params.cols,
    nodes,
    roads: [...roads.values()],
    entries,
    exits,
  };

  // 5. Validate that every entry can reach an exit.
  if (!entries.every((entry) => canReachAnyExit(scenario, entry))) {
    throw new Error("Generated scenario contains an unreachable entry.");
  }

  return scenario;
}



function areValidParameters(params: { rows: number, cols: number, entryCount: number, exitCount: number}): boolean {
  return (
    Number.isInteger(params.rows) && Number.isInteger(params.cols) && Number.isInteger(params.entryCount) && Number.isInteger(params.exitCount) &&
      params.entryCount > 0 && params.exitCount > 0 && params.rows > params.entryCount && params.rows > params.exitCount
  );
}

function defineIntersectionArray(r: number, c: number): Intersection[]  {
  return Array.from({length: r * c}, (_, i) => {
    const row = Math.floor(i / c);
    const col = i % c;
    return {
      id: nodeId(row, col),
      row,
      col,
    };
  });

  
}


const addRoadTo = (roads: Map<string, Road>) => (a: NodeId, b: NodeId): void  => {
  const key = edgeKey(a, b);

  if (!roads.has(key)) {
    roads.set(key, {
      id: key,
      from: a,
      to: b,
      cost: 1,
    });
  }
}

const calculateCandidatesFor = (rows: number, cols: number, byId: Map<NodeId, Intersection>) => (node: Intersection): Intersection[] => {
  const candidates = [
    [node.row - 1, node.col],
    [node.row + 1, node.col],
    [node.row, node.col - 1],
    [node.row, node.col + 1],
  ];

  return candidates
    .filter(([r, c]) =>
      r >= 0 && r < rows && c >= 0 && c < cols
    )
    .map(([r, c]) => byId.get(nodeId(r, c))!);
}


function canReachAnyExit(
  scenario: Scenario,
  start: NodeId,
): boolean {
  const adjacency = new Map<NodeId, NodeId[]>();

  for (const node of scenario.nodes) {
    adjacency.set(node.id, []);
  }

  for (const road of scenario.roads) {
    adjacency.get(road.from)!.push(road.to);
    adjacency.get(road.to)!.push(road.from);
  }

  const targets = new Set(scenario.exits);
  const visited = new Set<NodeId>([start]);
  const queue: NodeId[] = [start];

  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];

    if (targets.has(current)) return true;

    for (const next of adjacency.get(current)!) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }

  return false;
}
