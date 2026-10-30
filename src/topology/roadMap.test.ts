import { expect, test } from 'vitest';
import { generateRoadMap, isStronglyConnected, MAX_SPEED, roadSpeed, SPEED_LIMITS } from './roadMap';

test('road map is strongly connected, junctions are never contiguous and has every structure', () => {
  const kinds = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const map = generateRoadMap({ rows: 6, cols: 8, entryCount: 3, exitCount: 2 });
    expect(isStronglyConnected(map)).toBe(true);
    for (const road of map.roads) if (!road.oneWay) expect(road.cost).toBeGreaterThanOrEqual(2);
    expect(map.entries.every(e => map.nodes.some(n => n.id === e && n.col === 0))).toBe(true);
    map.nodes.forEach(n => kinds.add(n.kind!));
  }
  expect(kinds).toEqual(new Set(['intersection', 'fork', 'dead-end', 'roundabout']));
});

test('speed limits: curves slow down, long straights speed up', () => {
  const straight = (n: number): [number, number][] => Array.from({ length: n + 1 }, (_, i) => [0, i]);
  expect(roadSpeed(Math.random, [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2]])).toBe(SPEED_LIMITS[0]);
  expect(roadSpeed(Math.random, [[0, 0], [0, 1], [1, 1]])).toBe(SPEED_LIMITS[1]);
  expect([SPEED_LIMITS[0], SPEED_LIMITS[5]]).toContain(roadSpeed(Math.random, straight(14)));
  const map = generateRoadMap({ rows: 6, cols: 8, entryCount: 3, exitCount: 2 });
  for (const r of map.roads) expect(r.speed).toBeLessThanOrEqual(MAX_SPEED);
  expect(map.roads.filter(r => r.oneWay).every(r => r.speed === 30)).toBe(true);
});

test('the same seed always generates the same road map', () => {
  const params = { rows: 6, cols: 8, entryCount: 3, exitCount: 2, seed: 47 };
  expect(generateRoadMap(params)).toEqual(generateRoadMap(params));
});
