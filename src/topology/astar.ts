import { Intersection, NodeId, Road, Scenario } from './types';

/** One road travelled in a given direction. */
export interface Step { road: Road, from: NodeId, to: NodeId }

interface Graph { byId: Map<NodeId, Intersection>, adjacency: Map<NodeId, Step[]> }

const graphs = new WeakMap<Scenario, Graph>();

function graphOf(scenario: Scenario): Graph {
  let graph = graphs.get(scenario);
  if (!graph) {
    const adjacency = new Map(scenario.nodes.map(n => [n.id, [] as Step[]]));
    for (const road of scenario.roads) {
      adjacency.get(road.from)!.push({ road, from: road.from, to: road.to });
      if (!road.oneWay) adjacency.get(road.to)!.push({ road, from: road.to, to: road.from });
    }
    graph = { byId: new Map(scenario.nodes.map(n => [n.id, n])), adjacency };
    graphs.set(scenario, graph);
  }
  return graph;
}

/** Roads that can be taken when leaving a node. */
export const stepsFrom = (scenario: Scenario, node: NodeId): Step[] => graphOf(scenario).adjacency.get(node)!;

/** Free-flow road time: tiles / speed limit (capped at maxSpeed). */
export const freeFlowTime = (maxSpeed: number) => (road: Road): number =>
  road.cost / Math.min(road.speed ?? maxSpeed, maxSpeed);

/**
 * A* minimising travel time. g = sum(edgeTime) of the roads taken, where
 * edgeTime also receives the time at which the road is entered (g so far);
 * h = manhattan(node, goal) / maxSpeed (admissible as long as edgeTime is
 * never below road.cost / maxSpeed).
 */
export function aStar(
  scenario: Scenario,
  start: NodeId,
  goal: NodeId,
  maxSpeed: number,
  edgeTime: (road: Road, enteredAt: number) => number = freeFlowTime(maxSpeed),
): { path: NodeId[], steps: Step[], time: number } | null {
  const { byId, adjacency } = graphOf(scenario);
  const target = byId.get(goal)!;
  const h = (id: NodeId): number => {
    const n = byId.get(id)!;
    return (Math.abs(n.row - target.row) + Math.abs(n.col - target.col)) / maxSpeed;
  };

  const g = new Map<NodeId, number>([[start, 0]]);
  const cameFrom = new Map<NodeId, Step>();
  const closed = new Set<NodeId>();
  const heap = new MinHeap();
  heap.push(h(start), start);

  while (heap.size > 0) {
    const current = heap.pop();
    if (closed.has(current)) continue;
    if (current === goal) {
      const steps: Step[] = [];
      for (let id = goal; id !== start; id = steps[0].from) steps.unshift(cameFrom.get(id)!);
      return { path: [start, ...steps.map(s => s.to)], steps, time: g.get(goal)! };
    }
    closed.add(current);
    for (const step of adjacency.get(current)!) {
      const candidate = g.get(current)! + edgeTime(step.road, g.get(current)!);
      if (candidate < (g.get(step.to) ?? Infinity)) {
        g.set(step.to, candidate);
        cameFrom.set(step.to, step);
        heap.push(candidate + h(step.to), step.to);
      }
    }
  }
  return null;
}

/** Binary min-heap keyed by priority; stale duplicates are skipped by the caller. */
class MinHeap {
  private items: [number, NodeId][] = [];

  get size(): number { return this.items.length; }

  push(priority: number, id: NodeId): void {
    const items = this.items;
    items.push([priority, id]);
    for (let i = items.length - 1; i > 0;) {
      const parent = (i - 1) >> 1;
      if (items[parent][0] <= items[i][0]) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  pop(): NodeId {
    const items = this.items;
    const top = items[0][1];
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      for (let i = 0; ;) {
        const [l, r] = [2 * i + 1, 2 * i + 2];
        let min = i;
        if (l < items.length && items[l][0] < items[min][0]) min = l;
        if (r < items.length && items[r][0] < items[min][0]) min = r;
        if (min === i) break;
        [items[min], items[i]] = [items[i], items[min]];
        i = min;
      }
    }
    return top;
  }
}
