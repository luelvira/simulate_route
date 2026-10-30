import { describe, it, expect } from 'vitest';
import { createRandom, generateRoadMap } from '../topology/roadMap';
import { demandRandom, generateDemand, Trip } from './demand';
import { positionOf, Simulation, Vehicle } from './engine';
import { Road } from '../topology/types';
import { balancedPlanner, freeFlowPlanner, unguidedPlanner } from './routing';

const map = generateRoadMap({ rows: 8, cols: 10, entryCount: 4, exitCount: 3, blockSize: 5, seed: 11 });
const trips = generateDemand(map.entries, map.exits, 60, createRandom(5));

function runToEnd(simulation: Simulation): Simulation {
  while (!simulation.done) simulation.step(1);
  return simulation;
}

describe('Feature: Traffic simulation', () => {

  describe('When the simulation runs until the end', () => {
    it('should bring every vehicle to its exit', () => {
      const simulation = runToEnd(new Simulation(map, trips, freeFlowPlanner(map)));

      expect(simulation.metrics().completed).toBe(trips.length);
    });

    it('should never let a vehicle beat the free-flow travel time', () => {
      const simulation = runToEnd(new Simulation(map, trips, freeFlowPlanner(map)));

      for (const v of simulation.vehicles) expect(v.arrival! - v.departure).toBeGreaterThanOrEqual(v.idealTime - 1);
    });

    it('should produce the same metrics when replayed with the same inputs', () => {
      const first = runToEnd(new Simulation(map, trips, balancedPlanner(map, trips))).metrics();
      const second = runToEnd(new Simulation(map, trips, balancedPlanner(map, trips))).metrics();

      expect(first).toEqual(second);
    });
  });

  describe('When many vehicles share the same roads', () => {
    it('should make each of them slower than a vehicle driving alone', () => {
      const crowd: Trip[] = Array.from({ length: 30 }, (_, id) =>
        ({ id, entry: map.entries[0], exit: map.exits[0], departure: 0 }));

      const alone = runToEnd(new Simulation(map, crowd.slice(0, 1), freeFlowPlanner(map))).metrics();
      const crowded = runToEnd(new Simulation(map, crowd, freeFlowPlanner(map))).metrics();

      expect(crowded.avgTravelTime).toBeGreaterThan(alone.avgTravelTime);
      expect(crowded.maxCongestion).toBeGreaterThan(alone.maxCongestion);
    });
  });

  describe('When comparing the three scenarios on the default demo configuration', () => {
    const demo = generateRoadMap({ rows: 18, cols: 24, entryCount: 12, exitCount: 4, blockSize: 7, seed: 47 });
    const demoTrips = generateDemand(demo.entries, demo.exits, 50, demandRandom(47));
    const avg = (simulation: Simulation): number => runToEnd(simulation).metrics().avgTravelTime;

    it('should rank optimised routing first, A* second and unguided drivers last', () => {
      const base = avg(new Simulation(demo, demoTrips, unguidedPlanner(demo)));
      const astar = avg(new Simulation(demo, demoTrips, freeFlowPlanner(demo)));
      const optimised = avg(new Simulation(demo, demoTrips, balancedPlanner(demo, demoTrips)));

      expect(optimised).toBeLessThan(astar);
      expect(astar).toBeLessThan(base);
    });
  });

  describe('When comparing the base scenario under light and heavy traffic', () => {
    it.each([[1, 20], [2, 20], [1, 300], [2, 300]])('should always be the slowest (seed %i, %i vehicles)', (seed, vehicles) => {
      const demo = generateRoadMap({ rows: 18, cols: 24, entryCount: 12, exitCount: 4, blockSize: 7, seed });
      const demoTrips = generateDemand(demo.entries, demo.exits, vehicles, demandRandom(seed));
      const avg = (simulation: Simulation): number => runToEnd(simulation).metrics().avgTravelTime;

      const base = avg(new Simulation(demo, demoTrips, unguidedPlanner(demo)));

      expect(base).toBeGreaterThan(avg(new Simulation(demo, demoTrips, freeFlowPlanner(demo))));
      expect(base).toBeGreaterThan(avg(new Simulation(demo, demoTrips, balancedPlanner(demo, demoTrips))));
    });
  });
});

describe('Feature: Vehicle position on the map', () => {
  const road = { id: 'road0', from: 'r0c0', to: 'r0c3', cost: 3, path: [[0, 0], [0, 1], [0, 2], [0, 3]] } as Road;
  const vehicleOn = (from: string, to: string, progress: number): Vehicle =>
    ({ route: [{ road, from, to }], progress } as unknown as Vehicle);

  describe('When a vehicle drives along a road in its drawing direction', () => {
    it('should be placed between the tiles it is travelling through', () => {
      expect(positionOf(vehicleOn('r0c0', 'r0c3', 1.5))).toEqual([0, 1.5]);
    });
  });

  describe('When a vehicle drives along a road against its drawing direction', () => {
    it('should start at the far end of the road', () => {
      expect(positionOf(vehicleOn('r0c3', 'r0c0', 0.5))).toEqual([0, 2.5]);
    });
  });

  describe('When a vehicle has not departed or has already arrived', () => {
    it('should not be drawn', () => {
      expect(positionOf({ route: [], progress: 0 } as unknown as Vehicle)).toBeUndefined();
    });
  });
});
