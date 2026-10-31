import { describe, it, expect } from 'vitest';
import { Step } from '../topology/astar';
import { generateRoadMap } from '../topology/roadMap';
import { centralPlanner, MAX_DELAY } from './centralPlanner';
import { demandRandom, generateDemand, Trip } from './demand';
import { Simulation } from './engine';
import { balancedPlanner, freeFlowPlanner, freeFlowSeconds, Planner } from './routing';

const demo = generateRoadMap({ rows: 18, cols: 24, entryCount: 12, exitCount: 4, blockSize: 7, seed: 47 });
const ideal = freeFlowSeconds(demo);
const leadsToExit = (steps: Step[], trip: Trip): boolean =>
  steps[0].from === trip.entry && steps.at(-1)!.to === trip.exit &&
  steps.slice(1).every((s, i) => s.from === steps[i].to);
const finalMetrics = (planner: Planner, trips: Trip[]) => {
  const simulation = new Simulation(demo, trips, planner);
  while (!simulation.done) simulation.step(1);
  return simulation.metrics();
};

describe('Feature: Centralized scheduling', () => {

  describe('When a vehicle has the network to itself', () => {
    it('should leave at its nominal departure', () => {
      const [trip] = generateDemand(demo.entries, demo.exits, 1, demandRandom(47), ideal);

      expect(centralPlanner(demo, [trip]).departure(trip)).toBe(trip.departure);
    });
  });

  describe('When the network is saturated', () => {
    const trips = generateDemand(demo.entries, demo.exits, 500, demandRandom(47), ideal);
    const planner = centralPlanner(demo, trips);

    it('should give every vehicle a connected route from its entry to its exit', () => {
      for (const trip of trips) expect(leadsToExit(planner.plan(trip), trip)).toBe(true);
    });

    it('should never delay a departure by more than 30 minutes', () => {
      for (const trip of trips) expect(planner.departure(trip) - trip.departure).toBeLessThanOrEqual(MAX_DELAY);
    });

    it('should never schedule a departure before the simulation starts', () => {
      for (const trip of trips) expect(planner.departure(trip)).toBeGreaterThanOrEqual(0);
    });

    it('should advance some departures to spread the traffic over time', () => {
      expect(trips.some(trip => planner.departure(trip) < trip.departure)).toBe(true);
    });

    it('should get more vehicles on time than A* and the optimised scenario without keeping them longer on the road', () => {
      const central = finalMetrics(planner, trips);
      const astar = finalMetrics(freeFlowPlanner(demo), trips);
      const optimised = finalMetrics(balancedPlanner(demo, trips), trips);

      expect(central.onTime).toBeGreaterThan(astar.onTime);
      expect(central.onTime).toBeGreaterThan(optimised.onTime);
      expect(central.avgTravelTime).toBeLessThanOrEqual(optimised.avgTravelTime);
    }, 120_000);
  });

  describe('When vehicles cannot leave earlier than the simulation start', () => {
    const [entry, exit] = [demo.entries[0], demo.exits[0]];
    const crowd: Trip[] = Array.from({ length: 30 }, (_, id) =>
      ({ id, entry, exit, departure: 0, target: Math.ceil(ideal(entry, exit)) }));
    const planner = centralPlanner(demo, crowd);

    it('should delay only vehicles that would arrive late anyway', () => {
      const delayed = crowd.filter(trip => planner.departure(trip) > trip.departure);

      expect(delayed.length).toBeGreaterThan(0);
      for (const trip of delayed) expect(planner.arrival(trip)).toBeGreaterThan(trip.target);
    });
  });
});
