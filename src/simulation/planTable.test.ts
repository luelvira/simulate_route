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
});
