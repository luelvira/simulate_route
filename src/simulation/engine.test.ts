import { describe, it, expect } from 'vitest';
import { stepsFrom } from '../topology/astar';
import { createRandom, generateRoadMap, MAX_SPEED } from '../topology/roadMap';
import { demandRandom, generateDemand, Trip } from './demand';
import { positionOf, Simulation, Vehicle } from './engine';
import { Road } from '../topology/types';
import { balancedPlanner, freeFlowPlanner, freeFlowSeconds, Planner, unguidedPlanner } from './routing';
import { congestionRatio } from './traffic';

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
        ({ id, entry: map.entries[0], exit: map.exits[0], departure: 0, target: 0 }));

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
    const scenario = (seed: number, vehicles: number) => {
      const demo = generateRoadMap({ rows: 18, cols: 24, entryCount: 12, exitCount: 4, blockSize: 7, seed });
      const demoTrips = generateDemand(demo.entries, demo.exits, vehicles, demandRandom(seed));
      const avg = (planner: Planner): number => runToEnd(new Simulation(demo, demoTrips, planner)).metrics().avgTravelTime;
      return { demo, demoTrips, avg };
    };

    it.each([1, 2])('should be the slowest under light traffic (seed %i, 20 vehicles)', seed => {
      const { demo, demoTrips, avg } = scenario(seed, 20);

      const base = avg(unguidedPlanner(demo));

      expect(base).toBeGreaterThan(avg(freeFlowPlanner(demo)));
      expect(base).toBeGreaterThan(avg(balancedPlanner(demo, demoTrips)));
    });

    it.each([1, 2])('should be slower than optimised routing under heavy traffic (seed %i, 300 vehicles)', seed => {
      const { demo, demoTrips, avg } = scenario(seed, 300);

      expect(avg(unguidedPlanner(demo))).toBeGreaterThan(avg(balancedPlanner(demo, demoTrips)));
    });
  });
});

describe('Feature: Departure scheduling', () => {

  describe('When the planner chooses the departure time', () => {
    const shifted = (offset: number): Planner => ({ ...freeFlowPlanner(map), departure: trip => trip.departure + offset });

    it('should depart each vehicle at the time chosen by the planner', () => {
      const simulation = runToEnd(new Simulation(map, trips.slice(0, 5), shifted(100)));

      for (const v of simulation.vehicles) expect(v.departure).toBe(v.trip.departure + 100);
    });
  });

  describe('When a lone vehicle leaves at its nominal departure', () => {
    it('should reach its exit on time', () => {
      const [trip] = generateDemand(map.entries, map.exits, 1, createRandom(3), freeFlowSeconds(map));

      expect(runToEnd(new Simulation(map, [trip], freeFlowPlanner(map))).metrics().onTime).toBe(100);
    });
  });
});

describe('Feature: Congestion history for the map', () => {
  const crowdOnSameRoute = (): Trip[] => Array.from({ length: 4 }, (_, id) =>
    ({ id, entry: map.entries[0], exit: map.exits[0], departure: 0, target: 0 }));

  describe('When no vehicle has driven', () => {
    it('should report no road in the history', () => {
      const simulation = new Simulation(map, [], freeFlowPlanner(map));

      expect(simulation.congestionHistory().size).toBe(0);
    });
  });

  describe('When several vehicles share the same road', () => {
    it('should remember the peak share of the jam density that road reached', () => {
      const planner = freeFlowPlanner(map);
      const crowd = crowdOnSameRoute();
      const first = planner.plan(crowd[0])[0].road;
      const simulation = new Simulation(map, crowd, planner);

      simulation.step(1);

      expect(simulation.congestionHistory().get(first.id))
        .toBeCloseTo(congestionRatio(crowd.length - 1, first.cost), 6);
    });
  });

  describe('When the road empties before the simulation ends', () => {
    it('should keep the congestion that road reached until the end', () => {
      const planner = freeFlowPlanner(map);
      const crowd = crowdOnSameRoute();
      const first = planner.plan(crowd[0])[0].road;
      const peak = congestionRatio(crowd.length - 1, first.cost);

      const simulation = runToEnd(new Simulation(map, crowd, planner));

      expect(simulation.done).toBe(true);
      expect(simulation.congestionHistory().get(first.id)).toBeCloseTo(peak, 6);
    });
  });

  describe('When a vehicle drives alone', () => {
    it('should leave every road it drives on uncoloured', () => {
      // Arrange
      const planner = freeFlowPlanner(map);
      const trip: Trip = { id: 0, entry: map.entries[0], exit: map.exits[0], departure: 0, target: 0 };

      // Act
      const simulation = runToEnd(new Simulation(map, [trip], planner));

      // Assert
      for (const ratio of simulation.congestionHistory().values()) expect(ratio).toBe(0);
    });
  });

  describe('When the simulation ends', () => {
    it('should paint no road above the reported maximum congestion', () => {
      // Arrange
      const simulation = runToEnd(new Simulation(map, trips, freeFlowPlanner(map)));

      // Act
      const peak = Math.max(...simulation.congestionHistory().values());

      // Assert
      expect(peak * 100).toBeLessThanOrEqual(simulation.metrics().maxCongestion);
    });
  });

  describe('When a vehicle enters a road in the same step another one leaves it', () => {
    it('should paint the road no hotter than the reported maximum congestion', () => {
      // Arrange
      const [before, after] = map.nodes.flatMap(({ id }) => stepsFrom(map, id).flatMap(first =>
        stepsFrom(map, first.to)
          .filter(next => next.road !== first.road && next.road.cost === first.road.cost &&
            (next.road.speed ?? MAX_SPEED) === (first.road.speed ?? MAX_SPEED))
          .map(next => [first, next])))[0];
      const follower: Trip = { id: 0, entry: before.from, exit: after.to, departure: 0, target: 0 };
      const leader: Trip = { id: 1, entry: after.from, exit: after.to, departure: 0, target: 0 };
      const planner: Planner = { plan: trip => (trip.id === 0 ? [before, after] : [after]) };

      // Act
      const simulation = runToEnd(new Simulation(map, [follower, leader], planner));

      // Assert
      const peak = Math.max(...simulation.congestionHistory().values());
      expect(peak * 100).toBeLessThanOrEqual(simulation.metrics().maxCongestion);
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
