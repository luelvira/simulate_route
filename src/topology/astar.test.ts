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
