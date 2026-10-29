import { NodeId, Scenario } from './types';

/**
 * A* minimising travel time. g = sum(distance / speed) of the roads taken,
 * h = manhattan(node, goal) / maxSpeed (admissible: no road is shorter than
 * the manhattan distance nor faster than maxSpeed).
 */
export function aStar(
  { nodes, roads }: Scenario,
  start: NodeId,
  goal: NodeId,
  maxSpeed: number,
): { path: NodeId[], time: number } | null {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const adjacency = new Map(nodes.map(n => [n.id, [] as { to: NodeId, time: number }[]]));
  for (const r of roads) {
    const time = r.cost / Math.min(r.speed ?? maxSpeed, maxSpeed);
    adjacency.get(r.from)!.push({ to: r.to, time });
    if (!r.oneWay) adjacency.get(r.to)!.push({ to: r.from, time });
  }

  const target = byId.get(goal)!;
  const h = (id: NodeId): number => {
    const n = byId.get(id)!;
    return (Math.abs(n.row - target.row) + Math.abs(n.col - target.col)) / maxSpeed;
  };

  const g = new Map<NodeId, number>([[start, 0]]);
  const cameFrom = new Map<NodeId, NodeId>();
  const open = new Set<NodeId>([start]);
  const f = (id: NodeId): number => g.get(id)! + h(id);

  while (open.size > 0) {
    // ponytail: linear scan of the open set, O(n²); switch to a binary heap if maps grow large
    const current = [...open].reduce((a, b) => (f(b) < f(a) ? b : a));
    if (current === goal) {
      const path = [goal];
      while (path[0] !== start) path.unshift(cameFrom.get(path[0])!);
      return { path, time: g.get(goal)! };
    }
    open.delete(current);
    for (const { to, time } of adjacency.get(current)!) {
      const candidate = g.get(current)! + time;
      if (candidate < (g.get(to) ?? Infinity)) {
        g.set(to, candidate);
        cameFrom.set(to, current);
        open.add(to);
      }
    }
  }
  return null;
}
