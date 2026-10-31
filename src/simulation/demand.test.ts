import { describe, it, expect } from 'vitest';
import { createRandom } from '../topology/roadMap';
import { generateDemand, LEAD_TIME, TARGET_WINDOW } from './demand';

const entries = ['r0c0', 'r5c0'] as const;
const exits = ['r1c9', 'r4c9', 'r7c9'] as const;

describe('Feature: Travel demand', () => {

  describe('When generating trips for the configured number of vehicles', () => {
    it('should create exactly one trip per vehicle', () => {
      expect(generateDemand([...entries], [...exits], 37, createRandom(1))).toHaveLength(37);
    });

    it('should start every trip at an entry, end it at an exit and depart within the target window after the lead time', () => {
      const trips = generateDemand([...entries], [...exits], 200, createRandom(1));

      for (const trip of trips) {
        expect(entries).toContain(trip.entry);
        expect(exits).toContain(trip.exit);
        expect(trip.departure).toBeGreaterThanOrEqual(LEAD_TIME);
        expect(trip.departure).toBeLessThanOrEqual(LEAD_TIME + TARGET_WINDOW);
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

  describe('When every vehicle must arrive at roughly the same time', () => {
    const ideal = (entry: string, exit: string): number => (entry === 'r0c0' ? 100 : 40) + (exit === 'r1c9' ? 0.5 : 0);
    const trips = generateDemand([...entries], [...exits], 200, createRandom(1), ideal);

    it('should give every vehicle an arrival target within the common target window', () => {
      const earliest = Math.min(...trips.map(t => t.target));

      for (const trip of trips) expect(trip.target - earliest).toBeLessThanOrEqual(TARGET_WINDOW);
    });

    it('should depart every vehicle just in time to reach its target on an empty network', () => {
      for (const trip of trips) {
        expect(trip.target - trip.departure).toBeGreaterThanOrEqual(ideal(trip.entry, trip.exit));
        expect(trip.target - trip.departure).toBeLessThan(ideal(trip.entry, trip.exit) + 1);
      }
    });

    it('should leave a 30 minute margin before the first nominal departure', () => {
      const first = Math.min(...trips.map(t => t.departure));

      expect(LEAD_TIME).toBe(1800);
      expect(first).toBeGreaterThanOrEqual(LEAD_TIME);
      expect(first).toBeLessThan(LEAD_TIME + TARGET_WINDOW);
    });
  });
});
