import { describe, it, expect } from 'vitest';
import { createRandom } from '../topology/roadMap';
import { DEPARTURE_WINDOW, generateDemand } from './demand';

const entries = ['r0c0', 'r5c0'] as const;
const exits = ['r1c9', 'r4c9', 'r7c9'] as const;

describe('Feature: Travel demand', () => {

  describe('When generating trips for the configured number of vehicles', () => {
    it('should create exactly one trip per vehicle', () => {
      expect(generateDemand([...entries], [...exits], 37, createRandom(1))).toHaveLength(37);
    });

    it('should start every trip at an entry, end it at an exit and depart within the departure window', () => {
      const trips = generateDemand([...entries], [...exits], 200, createRandom(1));

      for (const trip of trips) {
        expect(entries).toContain(trip.entry);
        expect(exits).toContain(trip.exit);
        expect(trip.departure).toBeGreaterThanOrEqual(0);
        expect(trip.departure).toBeLessThanOrEqual(DEPARTURE_WINDOW);
      }
    });

    it('should use several different entries and exits', () => {
      const trips = generateDemand([...entries], [...exits], 200, createRandom(1));

      expect(new Set(trips.map(t => t.entry)).size).toBe(entries.length);
      expect(new Set(trips.map(t => t.exit)).size).toBe(exits.length);
    });

    it('should generate the same trips when the seed is the same', () => {
      const first = generateDemand([...entries], [...exits], 50, createRandom(9));
      const second = generateDemand([...entries], [...exits], 50, createRandom(9));

      expect(first).toEqual(second);
    });
  });
});
