import { describe, it, expect } from 'vitest';
import { generateRoadMap } from '../topology/roadMap';
import { centralPlanner } from './centralPlanner';
import { demandRandom, generateDemand } from './demand';
import { fromPlanTable, toPlanTable } from './planTable';
import { freeFlowSeconds } from './routing';

const map = generateRoadMap({ rows: 8, cols: 10, entryCount: 4, exitCount: 3, blockSize: 5, seed: 11 });
const trips = generateDemand(map.entries, map.exits, 80, demandRandom(11), freeFlowSeconds(map));

describe('Feature: Plans computed away from the page', () => {

  describe('When a plan is turned into plain data and back', () => {
    const original = centralPlanner(map, trips);
    const restored = fromPlanTable(structuredClone(toPlanTable(original, trips)), map);

    it('should give every vehicle the same route on the page map', () => {
      for (const trip of trips) expect(restored.plan(trip)).toEqual(original.plan(trip));
    });

    it('should keep every scheduled departure', () => {
      for (const trip of trips) expect(restored.departure!(trip)).toBe(original.departure(trip));
    });
  });

  describe('When a plan is replayed for drivers who hesitate', () => {
    it('should drive the replayed plan at the given share of the allowed speed', () => {
      // Arrange
      const table = toPlanTable(centralPlanner(map, trips), trips);

      // Act
      const replayed = fromPlanTable(table, map, 0.9);

      // Assert
      expect(replayed.speedFactor).toBe(0.9);
    });

    it('should drive at the allowed speed when no share is given', () => {
      // Act
      const replayed = fromPlanTable(toPlanTable(centralPlanner(map, trips), trips), map);

      // Assert
      expect(replayed.speedFactor ?? 1).toBe(1);
    });
  });
});
