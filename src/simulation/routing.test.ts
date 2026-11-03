import { describe, it, expect } from 'vitest';
import { aStar, freeFlowTime, Step } from '../topology/astar';
import { createRandom, generateRoadMap, MAX_SPEED } from '../topology/roadMap';
import { Road } from '../topology/types';
import { generateDemand, Trip } from './demand';
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
    const sameJourney = (count: number): Trip[] =>
      Array.from({ length: count }, (_, id) => ({ ...trips[0], id }));
    const visitsOnce = (steps: Step[]): boolean =>
      new Set(steps.map(s => s.to)).size === steps.length && !steps.some(s => s.to === steps[0].from);

    it('should lead every vehicle to its exit without passing twice through an intersection', () => {
      const planner = unguidedPlanner(map);

      for (const trip of trips) {
        const route = planner.plan(trip);
        expect(leadsToExit(route, trip.entry, trip.exit)).toBe(true);
        expect(visitsOnce(route)).toBe(true);
      }
    });

    it('should cross no more intersections than the fastest route, ignoring speed limits', () => {
      const planner = unguidedPlanner(map);

      for (const trip of trips.slice(0, 20)) {
        const fastest = aStar(map, trip.entry, trip.exit, MAX_SPEED)!.steps;
        expect(planner.plan({ ...trip, id: 0 }).length).toBeLessThanOrEqual(fastest.length);
      }
    });

    it('should spread the vehicles of the same journey over its three shortest routes', () => {
      const planner = unguidedPlanner(map);

      const routes = sameJourney(6).map(trip => planner.plan(trip));

      expect(new Set(routes.map(r => r.map(s => s.to).join())).size).toBe(3);
      expect(routes.slice(3)).toEqual(routes.slice(0, 3));
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
