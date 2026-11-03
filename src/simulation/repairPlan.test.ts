import { describe, it, expect } from 'vitest';
import { Step, stepsFrom } from '../topology/astar';
import { generateRoadMap } from '../topology/roadMap';
import { CAPACITY_RATIO, centralPlanner, MAX_DELAY } from './centralPlanner';
import { demandRandom, generateDemand, Trip } from './demand';
import { Simulation } from './engine';
import { ASSIGNMENT_SLOT, LoadForecast } from './loadForecast';
import { Metrics } from './metrics';
import { fewerJams, HOT_RATIO, repairPlan, replanFlagged, replay } from './repairPlan';
import { balancedPlanner, freeFlowPlanner, freeFlowSeconds, Planner } from './routing';
import { congestionRatio, JAM_DENSITY, MIN_DENSITY_LENGTH, queuedSpeed } from './traffic';

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

    it('should report the same metrics as a full simulation of the plan', () => {
      // Act
      const { metrics } = replay(demo, [trip], planner);

      // Assert
      expect(metrics).toEqual(finalMetrics(planner, [trip]));
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

describe('Feature: Choosing between repaired plans', () => {
  const outcome = (maxCongestion: number, avgTravelTime: number): Metrics =>
    ({ maxCongestion, avgTravelTime } as Metrics);

  describe('When two plans reach different peak congestion', () => {
    it('should prefer the plan with the lower peak even if its vehicles drive longer', () => {
      expect(fewerJams(outcome(60, 2200), outcome(100, 2000))).toBe(true);
      expect(fewerJams(outcome(100, 2000), outcome(60, 2200))).toBe(false);
    });
  });

  describe('When two plans reach the same peak congestion', () => {
    it('should prefer the plan whose vehicles spend less time on the road', () => {
      expect(fewerJams(outcome(60, 2000), outcome(60, 2100))).toBe(true);
      expect(fewerJams(outcome(60, 2100), outcome(60, 2000))).toBe(false);
    });

    it('should keep the earlier plan when both are equally good', () => {
      expect(fewerJams(outcome(60, 2000), outcome(60, 2000))).toBe(false);
    });
  });
});

describe('Feature: Re-planning flagged vehicles', () => {

  describe('When a flagged vehicle finds no departure within the capacity', () => {
    const [trip] = demand(1);
    const end = trip.departure + 2 * MAX_DELAY;
    const blockedForecast = (): LoadForecast => {
      const forecast = new LoadForecast(demo, queuedSpeed, CAPACITY_RATIO);
      for (const { road } of stepsFrom(demo, trip.entry)) {
        let vehicles = 0;
        while (congestionRatio(vehicles + 1, road.cost) <= CAPACITY_RATIO) vehicles++;
        for (let i = 0; i < vehicles; i++) forecast.occupy(road, 0, end);
      }
      return forecast;
    };
    const steps = freeFlowPlanner(demo).plan(trip);

    it('should keep its current schedule', () => {
      // Arrange
      const schedules = new Map([[trip.id, { departure: trip.departure, steps }]]);

      // Act
      replanFlagged(blockedForecast(), [trip], schedules);

      // Assert
      expect(schedules.get(trip.id)).toEqual({ departure: trip.departure, steps });
    });

    it('should still book it, so vehicles re-planned after it see its roads busy', () => {
      // Arrange
      const forecast = blockedForecast();
      const last = steps.at(-1)!.road;
      const slots = Math.ceil((end + MAX_DELAY) / ASSIGNMENT_SLOT);

      // Act
      replanFlagged(forecast, [trip], new Map([[trip.id, { departure: trip.departure, steps }]]));

      // Assert
      const busy = Array.from({ length: slots }, (_, slot) => forecast.load(last, slot * ASSIGNMENT_SLOT));
      expect(busy.some(vehicles => vehicles > 0)).toBe(true);
    });
  });
});

describe('Feature: Repairing the central plan', () => {

  describe('When a vehicle has the network to itself', () => {
    it('should leave at its nominal departure', () => {
      // Arrange
      const [trip] = demand(1);

      // Act
      const repaired = repairPlan(demo, [trip], centralPlanner(demo, [trip]));

      // Assert
      expect(repaired.departure!(trip)).toBe(trip.departure);
    });
  });

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

    it('should delay only vehicles that would arrive late anyway', () => {
      // Arrange
      const simulation = new Simulation(demo, trips, repaired);
      while (!simulation.done) simulation.step(1);

      // Act
      const delayed = simulation.vehicles.filter(vehicle => vehicle.departure > vehicle.trip.departure);

      // Assert
      for (const vehicle of delayed) expect(vehicle.arrival!).toBeGreaterThan(vehicle.trip.target);
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

describe('Feature: Central scheduling without jams', () => {
  for (const vehicles of [150, 300, 500]) {
    describe(`When ${vehicles} vehicles use the network`, () => {
      const trips = demand(vehicles);
      const repaired = repairPlan(demo, trips, centralPlanner(demo, trips));

      it('should never let a road reach its jam density', () => {
        // Act
        const metrics = finalMetrics(repaired, trips);

        // Assert
        expect(metrics.maxCongestion).toBeLessThan(100);
      }, 120_000);

      it('should keep vehicles on the road less time than the optimised scenario', () => {
        // Act
        const central = finalMetrics(repaired, trips);
        const optimised = finalMetrics(balancedPlanner(demo, trips), trips);

        // Assert
        expect(central.avgTravelTime).toBeLessThan(optimised.avgTravelTime);
      }, 120_000);
    });
  }
});
