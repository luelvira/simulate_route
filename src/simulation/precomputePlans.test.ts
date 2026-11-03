import { describe, it, expect } from 'vitest';
import { generateRoadMap } from '../topology/roadMap';
import { DEFAULT_CONFIG, SimulationConfig } from '../ui/configStorage';
import { demandRandom, generateDemand } from './demand';
import { computePlan, PLAN_KEYS } from './precomputePlans';
import { freeFlowSeconds, unguidedPlanner } from './routing';

const config: SimulationConfig = { ...DEFAULT_CONFIG, rows: 6, cols: 8, entryCount: 3, exitCount: 2, vehicles: 10 };
const map = generateRoadMap(config);
const trips = generateDemand(map.entries, map.exits, config.vehicles, demandRandom(config.seed), freeFlowSeconds(map));

describe('Feature: Scenario plan precomputation', () => {

  describe('When the plan of each scenario is computed from a configuration', () => {
    it.each(PLAN_KEYS)('should plan every trip of the demand for the %s scenario', (key) => {
      // Act
      const table = computePlan(config, key);

      // Assert
      expect([...table.keys()].sort((a, b) => a - b)).toEqual(trips.map(trip => trip.id).sort((a, b) => a - b));
    });

    it('should give every base driver the route an unguided driver picks', () => {
      // Arrange
      const unguided = unguidedPlanner(map);

      // Act
      const table = computePlan(config, 'base');

      // Assert
      for (const trip of trips) {
        expect(table.get(trip.id)!.steps).toEqual(unguided.plan(trip).map(({ road, from }) => [road.id, from]));
      }
    });

    it('should never move a central departure before the start of the simulation', () => {
      // Act
      const table = computePlan(config, 'central');

      // Assert
      for (const { departure } of table.values()) expect(departure).toBeGreaterThanOrEqual(0);
    });
  });
});
