import { describe, it, expect } from 'vitest';
import { Step } from '../topology/astar';
import { generateRoadMap } from '../topology/roadMap';
import { centralPlanner, MAX_DELAY } from './centralPlanner';
import { demandRandom, generateDemand, Trip } from './demand';
import { Simulation } from './engine';
import { HOT_RATIO, repairPlan, replay } from './repairPlan';
import { freeFlowPlanner, freeFlowSeconds, Planner } from './routing';
import { JAM_DENSITY, MIN_DENSITY_LENGTH } from './traffic';

const demo = generateRoadMap({ rows: 18, cols: 24, entryCount: 12, exitCount: 4, blockSize: 7, seed: 47 });
const ideal = freeFlowSeconds(demo);
const demand = (count: number): Trip[] => generateDemand(demo.entries, demo.exits, count, demandRandom(47), ideal);
const finalMetrics = (planner: Planner, trips: Trip[]) => {
  const simulation = new Simulation(demo, trips, planner);
  while (!simulation.done) simulation.step(1);
  return simulation.metrics();
};
const leadsToExit = (steps: Step[], trip: Trip): boolean =>
  steps[0].from === trip.entry && steps.at(-1)!.to === trip.exit &&
  steps.slice(1).every((s, i) => s.from === steps[i].to);

describe('Feature: Replaying a plan in the simulation', () => {

  describe('When one vehicle drives alone', () => {
    const [trip] = demand(1);
    const planner = freeFlowPlanner(demo);

    it('should record every road of its route in order', () => {
      // Act
      const { visits } = replay(demo, [trip], planner);

      // Assert
      expect(visits.get(trip.id)!.map(visit => visit.road)).toEqual(planner.plan(trip).map(step => step.road));
    });

    it('should record each road being entered before it is left', () => {
      // Act
      const { visits } = replay(demo, [trip], planner);

      // Assert
      for (const visit of visits.get(trip.id)!) expect(visit.enter).toBeLessThan(visit.leave);
    });

    it('should flag no vehicle as driving on a congested road', () => {
      // Act
      const { offenders } = replay(demo, [trip], planner);

      // Assert
      expect(offenders.size).toBe(0);
    });
  });

  describe('When a crowd enters the same road at once', () => {
    it('should flag every vehicle on a road at the hot share of its jam density', () => {
      // Arrange
      const planner = freeFlowPlanner(demo);
      const [entry, exit] = [demo.entries[0], demo.exits[0]];
      const probe: Trip = { id: 0, entry, exit, departure: 0, target: 0 };
      const first = planner.plan(probe)[0].road;
      const size = Math.ceil(HOT_RATIO * JAM_DENSITY * Math.max(first.cost, MIN_DENSITY_LENGTH)) + 1;
      const crowd: Trip[] = Array.from({ length: size }, (_, id) => ({ ...probe, id }));

      // Act
      const { offenders } = replay(demo, crowd, planner);

      // Assert
      expect(offenders.size).toBe(size);
    });
  });
});

describe('Feature: Repairing the central plan', () => {

  describe('When no road reaches the hot share of its jam density', () => {
    it('should keep the central plan unchanged', () => {
      // Arrange
      const trips = demand(50);
      const central = centralPlanner(demo, trips);

      // Act
      const repaired = repairPlan(demo, trips, central);

      // Assert
      for (const trip of trips) {
        expect(repaired.departure!(trip)).toBe(central.departure(trip));
        expect(repaired.plan(trip)).toEqual(central.plan(trip));
      }
    }, 120_000);
  });

  describe('When the central plan saturates a road', () => {
    const trips = demand(300);
    const central = centralPlanner(demo, trips);
    const repaired = repairPlan(demo, trips, central);

    it('should bring the peak congestion below the jam density', () => {
      // Act
      const before = finalMetrics(central, trips);
      const after = finalMetrics(repaired, trips);

      // Assert
      expect(before.maxCongestion).toBe(100);
      expect(after.maxCongestion).toBeLessThan(100);
    }, 120_000);

    it('should not keep vehicles longer on the road nor make fewer arrive on time', () => {
      // Act
      const before = finalMetrics(central, trips);
      const after = finalMetrics(repaired, trips);

      // Assert
      expect(after.avgTravelTime).toBeLessThanOrEqual(before.avgTravelTime);
      expect(after.onTime).toBeGreaterThanOrEqual(before.onTime);
    }, 120_000);

    it('should keep every departure between the simulation start and the longest delay', () => {
      for (const trip of trips) {
        expect(repaired.departure!(trip)).toBeGreaterThanOrEqual(0);
        expect(repaired.departure!(trip) - trip.departure).toBeLessThanOrEqual(MAX_DELAY);
      }
    });

    it('should give every vehicle a connected route from its entry to its exit', () => {
      for (const trip of trips) expect(leadsToExit(repaired.plan(trip), trip)).toBe(true);
    });
  });
});
