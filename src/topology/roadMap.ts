import { generateScenario } from './generator';
import { Intersection, NodeId, nodeId, NodeKind, Road, Scenario } from './types';

type Tile = [number, number];

// N, E, S, W. Bit d of a tile mask means "road leaves this tile towards DIRS[d]".
const DIRS: Tile[] = [[-1, 0], [0, 1], [1, 0], [0, -1]];
const KIND: Record<number, NodeKind> = { 1: 'dead-end', 3: 'fork', 4: 'intersection' };

export const MAX_SPEED = 120; // km/h
const ROUNDABOUT_SPEED = 30;
const RESIDENTIAL_RATIO = 0.2;
export const SPEED_LIMITS = [
  MAX_SPEED*0.25, MAX_SPEED*0.3333, MAX_SPEED*0.4166,
  MAX_SPEED*0.5, MAX_SPEED*0.6666, MAX_SPEED*0.8333,
];

/** City speed limit (km/h): long straights go faster, curves and residential streets slow down. */
export function roadSpeed(gen: () => number, path: Tile[]): number {
  const turns = path.slice(2).filter((p, i) =>
    p[0] - path[i + 1][0] !== path[i + 1][0] - path[i][0] ||
    p[1] - path[i + 1][1] !== path[i + 1][1] - path[i][1]).length;
  const length = path.length - 1;
  if (turns >= 2) return SPEED_LIMITS[0];
  if (turns === 1) return length >= 6 ? SPEED_LIMITS[2] : SPEED_LIMITS[1];
  if (gen() < RESIDENTIAL_RATIO) return SPEED_LIMITS[0];
  if (length >= 12) return SPEED_LIMITS[5];
  if (length >= 8) return SPEED_LIMITS[4];
  return length >= 5 ? SPEED_LIMITS[3] : SPEED_LIMITS[2];
}

const key = ([r, c]: Tile): string => `${r},${c}`;
const degreeOf = (mask: number): number => [0, 1, 2, 3].filter(d => (mask >> d) & 1).length;
const genRandInt = (gen: () => number) => (lo: number, hi: number): number => lo + Math.floor(gen() * (hi - lo + 1));

function createRandom(seed?: number): () => number {
  if (seed === undefined) return Math.random;

  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Road map on a tile grid. Each cell of the abstract lattice built by
 * generateScenario becomes a blockSize x blockSize block holding one junction
 * (or a 2x2 roundabout) at a random offset. Lattice edges are drawn as tile
 * paths (straights + curves) that jog only along the block borders (offset 0),
 * which junctions never use, so roads never cross. Finally, degree-2 tiles are
 * collapsed: graph nodes are only forks, intersections, dead ends and
 * roundabout tiles, and road cost is the number of tiles travelled.
 */
export function generateRoadMap(params: {
  rows: number,
  cols: number,
  entryCount: number,
  exitCount: number,
  blockSize?: number,
  roundaboutRatio?: number,
  cycleRatio?: number,
  seed?: number
}): Scenario {
  const size = params.blockSize ?? 5;
  if (!Number.isInteger(size) || size < 3) throw new RangeError('Require blockSize >= 3.');

  const rand = createRandom(params.seed);
  const randInt = genRandInt(rand);
  const lattice = generateScenario({ ...params, cycleRatio: params.cycleRatio ?? 0.35, random: rand });
  const height = params.rows * size;
  const width = params.cols * size + 3; // col 0 = entries, last col = exits
  const rowOf = (i: number, off: number): number => i * size + off;
  const colOf = (j: number, off: number): number => 1 + j * size + off;

  const mask = new Map<string, number>();
  const ring = new Map<string, string>(); // roundabout tile -> next tile (counter-clockwise)

  const line = (a: Tile, b: Tile): void => {
    const d = DIRS.findIndex(([dr, dc]) => dr === Math.sign(b[0] - a[0]) && dc === Math.sign(b[1] - a[1]));
    for (let cur = a; key(cur) !== key(b);) {
      const next: Tile = [cur[0] + DIRS[d][0], cur[1] + DIRS[d][1]];
      mask.set(key(cur), (mask.get(key(cur)) ?? 0) | (1 << d));
      mask.set(key(next), (mask.get(key(next)) ?? 0) | (1 << ((d + 2) % 4)));
      cur = next;
    }
  };
  const polyline = (...pts: Tile[]): void => pts.slice(1).forEach((p, i) => line(pts[i], p));

  const degree = new Map<NodeId, number>();
  const bump = (id: NodeId): void => { degree.set(id, (degree.get(id) ?? 0) + 1); };
  lattice.roads.forEach(r => { bump(r.from); bump(r.to); });
  [...lattice.entries, ...lattice.exits].forEach(bump);

  // ports.get(id)[d] = tile where the arm leaving towards DIRS[d] attaches.
  const ports = new Map<NodeId, Tile[]>();
  for (const n of lattice.nodes) {
    const roundabout = degree.get(n.id)! >= 3 && rand() < (params.roundaboutRatio ?? 0.2);
    const span = roundabout ? size - 2 : size - 1;
    const r = rowOf(n.row, randInt(1, span));
    const c = colOf(n.col, randInt(1, span));
    if (!roundabout) {
      ports.set(n.id, [[r, c], [r, c], [r, c], [r, c]]);
      continue;
    }
    const [tl, tr, br, bl]: Tile[] = [[r, c], [r, c + 1], [r + 1, c + 1], [r + 1, c]];
    ports.set(n.id, [tl, tr, br, bl]);
    polyline(tr, tl, bl, br, tr);
    [[tr, tl], [tl, bl], [bl, br], [br, tr]].forEach(([a, b]) => ring.set(key(a), key(b)));
  }

  const byId = new Map(lattice.nodes.map(n => [n.id, n]));
  for (const road of lattice.roads) {
    const [a, b] = [byId.get(road.from)!, byId.get(road.to)!]
      .sort((x, y) => x.row - y.row || x.col - y.col);
    if (a.row === b.row) {
      const [p, q, x] = [ports.get(a.id)![1], ports.get(b.id)![3], colOf(b.col, 0)];
      polyline(p, [p[0], x], [q[0], x], q);
    } else {
      const [p, q, y] = [ports.get(a.id)![2], ports.get(b.id)![0], rowOf(b.row, 0)];
      polyline(p, [y, p[1]], [y, q[1]], q);
    }
  }
  const entries = lattice.entries.map(id => {
    const p = ports.get(id)![3];
    line(p, [p[0], 0]);
    return nodeId(p[0], 0);
  });
  const exits = lattice.exits.map(id => {
    const p = ports.get(id)![1];
    line(p, [p[0], width - 1]);
    return nodeId(p[0], width - 1);
  });

  const isNode = (t: Tile): boolean => ring.has(key(t)) || degreeOf(mask.get(key(t))!) !== 2;
  const nodes: Intersection[] = [...mask.keys()]
    .map(k => k.split(',').map(Number) as Tile)
    .filter(isNode)
    .map(([row, col]) => ({
      id: nodeId(row, col),
      row,
      col,
      kind: ring.has(key([row, col])) ? 'roundabout' : KIND[degreeOf(mask.get(key([row, col]))!)],
    }));

  const roads: Road[] = [];
  const walked = new Set<string>(); // "tile|dir" half-edges already turned into a road
  for (const n of nodes) {
    const start: Tile = [n.row, n.col];
    for (let d = 0; d < 4; d++) {
      if (!((mask.get(key(start))! >> d) & 1) || walked.has(`${key(start)}|${d}`)) continue;
      const path: Tile[] = [start];
      let dir = d;
      for (;;) {
        const last = path[path.length - 1];
        const next: Tile = [last[0] + DIRS[dir][0], last[1] + DIRS[dir][1]];
        path.push(next);
        if (isNode(next)) break;
        const m = mask.get(key(next))!;
        dir = [0, 1, 2, 3].find(e => e !== (dir + 2) % 4 && (m >> e) & 1)!;
      }
      const end = path[path.length - 1];
      walked.add(`${key(start)}|${d}`);
      walked.add(`${key(end)}|${(dir + 2) % 4}`);
      const reversed = ring.get(key(end)) === key(start);
      if (reversed) path.reverse();
      roads.push({
        id: `road${roads.length}`,
        from: nodeId(...path[0]),
        to: nodeId(...path[path.length - 1]),
        cost: path.length - 1,
        oneWay: reversed || ring.get(key(start)) === key(end),
        speed: reversed || ring.get(key(start)) === key(end) ? ROUNDABOUT_SPEED : roadSpeed(rand, path),
        path,
      });
    }
  }

  const scenario: Scenario = { rows: height, cols: width, nodes, roads, entries, exits };
  if (!isStronglyConnected(scenario)) throw new Error('Generated road map is not strongly connected.');
  return scenario;
}

export function isStronglyConnected({ nodes, roads }: Scenario): boolean {
  const reachesAll = (forward: boolean): boolean => {
    const adjacency = new Map(nodes.map(n => [n.id, [] as NodeId[]]));
    for (const r of roads) {
      const [a, b] = forward ? [r.from, r.to] : [r.to, r.from];
      adjacency.get(a)!.push(b);
      if (!r.oneWay) adjacency.get(b)!.push(a);
    }
    const queue = [nodes[0].id];
    const seen = new Set(queue);
    for (let head = 0; head < queue.length; head++) {
      for (const next of adjacency.get(queue[head])!) {
        if (!seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
    return seen.size === nodes.length;
  };
  return reachesAll(true) && reachesAll(false);
}
