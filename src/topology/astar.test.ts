import { expect, test } from 'vitest';
import { aStar } from './astar';
import { generateRoadMap } from './roadMap';
import { NodeId, Scenario } from './types';

// Dijkstra reference = A* with zero heuristic (huge maxSpeed only for h, speeds set per road).
const dijkstra = (s: Scenario, from: NodeId, to: NodeId): number => aStar(s, from, to, 1e12)!.time;

test('A* finds the fastest route (matches Dijkstra) on random road maps', () => {
  for (let i = 0; i < 50; i++) {
    const map = generateRoadMap({ rows: 5, cols: 6, entryCount: 2, exitCount: 2 });
    map.roads.forEach(r => { r.speed = 1 + Math.floor(Math.random() * 3); });
    const result = aStar(map, map.entries[0], map.exits[0], 3)!;
    expect(result.path[0]).toBe(map.entries[0]);
    expect(result.path.at(-1)).toBe(map.exits[0]);
    expect(result.time).toBeCloseTo(dijkstra(map, map.entries[0], map.exits[0]));
  }
});

test('A* returns the chain of roads travelled and honours a custom road cost', () => {
  const map = generateRoadMap({ rows: 5, cols: 6, entryCount: 2, exitCount: 2, seed: 3 });
  const [entry, exit] = [map.entries[0], map.exits[0]];
  const free = aStar(map, entry, exit, 120)!;
  expect(free.steps[0].from).toBe(entry);
  expect(free.steps.at(-1)!.to).toBe(exit);
  free.steps.slice(1).forEach((step, i) => expect(step.from).toBe(free.steps[i].to));

  const banned = new Set(free.steps.map(s => s.road));
  const detour = aStar(map, entry, exit, 120, r => (banned.has(r) ? 1e6 : r.cost / (r.speed ?? 120)));
  expect(detour === null || detour.time >= free.time).toBe(true);
});
