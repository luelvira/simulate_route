import { describe, it, expect } from 'vitest';
import { aStar, freeFlowTime, Step } from '../topology/astar';
import { createRandom, generateRoadMap, MAX_SPEED } from '../topology/roadMap';
import { Road } from '../topology/types';
import { generateDemand } from './demand';
import { balancedPlanner, freeFlowPlanner, HESITATION_FACTOR, unguidedPlanner } from './routing';

const map = generateRoadMap({ rows: 8, cols: 10, entryCount: 4, exitCount: 3, blockSize: 5, seed: 11 });
const trips = generateDemand(map.entries, map.exits, 120, createRandom(5));
const routeTime = (steps: Step[]): number =>
  steps.reduce((total, s) => total + freeFlowTime(MAX_SPEED)(s.road), 0);
const optimalTime = (entry: string, exit: string): number =>
  aStar(map, entry as never, exit as never, MAX_SPEED)!.time;
const leadsToExit = (steps: Step[], entry: string, exit: string): boolean =>
  steps[0].from === entry && steps.at(-1)!.to === exit &&
  steps.slice(1).every((s, i) => s.from === steps[i].to);
const maxLoad = (routes: Step[][]): number => {
  const load = new Map<Road, number>();
  routes.flat().forEach(s => load.set(s.road, (load.get(s.road) ?? 0) + 1));
  return Math.max(...load.values());
};

describe('Feature: Route planning strategies', () => {

  describe('When drivers know the network and ignore traffic (A*)', () => {
    it('should take the fastest route on an empty network', () => {
      const planner = freeFlowPlanner(map);

      for (const trip of trips.slice(0, 20)) {
        const route = planner.plan(trip);
        expect(leadsToExit(route, trip.entry, trip.exit)).toBe(true);
        expect(routeTime(route)).toBeCloseTo(optimalTime(trip.entry, trip.exit));
      }
    });
  });

  describe('When drivers have no guidance (base scenario)', () => {
    it('should follow the fastest route of the empty network', () => {
      const [unguided, free] = [unguidedPlanner(map), freeFlowPlanner(map)];

      for (const trip of trips) expect(unguided.plan(trip)).toEqual(free.plan(trip));
    });

    it('should drive below the allowed speed while looking for the way', () => {
      expect(unguidedPlanner(map).speedFactor).toBe(HESITATION_FACTOR);
      expect(HESITATION_FACTOR).toBeLessThan(1);
    });
  });

  describe('When routes are optimised to spread the traffic', () => {
    it('should lead every vehicle to its exit', () => {
      const planner = balancedPlanner(map, trips);

      for (const trip of trips) expect(leadsToExit(planner.plan(trip), trip.entry, trip.exit)).toBe(true);
    });

    it('should put fewer vehicles on the busiest road than free-flow routing', () => {
      const [balanced, free] = [balancedPlanner(map, trips), freeFlowPlanner(map)];

      expect(maxLoad(trips.map(t => balanced.plan(t)))).toBeLessThan(maxLoad(trips.map(t => free.plan(t))));
    });
  });
});
