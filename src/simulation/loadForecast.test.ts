import { describe, it, expect } from 'vitest';
import { aStar, stepsFrom } from '../topology/astar';
import { generateRoadMap, MAX_SPEED } from '../topology/roadMap';
import { Road } from '../topology/types';
import { Trip } from './demand';
import { ASSIGNMENT_SLOT, LoadForecast } from './loadForecast';
import { freeFlowSeconds } from './routing';
import { congestedSpeed, congestionRatio, toSeconds } from './traffic';

const map = generateRoadMap({ rows: 8, cols: 10, entryCount: 4, exitCount: 3, blockSize: 5, seed: 11 });
const trip: Trip = { id: 0, entry: map.entries[0], exit: map.exits[0], departure: 0, target: 0 };

describe('Feature: Time-dependent traffic forecast', () => {

  describe('When nobody has booked the network yet', () => {
    it('should predict the free-flow arrival', () => {
      const forecast = new LoadForecast(map, congestedSpeed);

      expect(forecast.route(trip, 0).arrival).toBeCloseTo(freeFlowSeconds(map)(trip.entry, trip.exit));
    });
  });

  describe('When other vehicles are booked on the same roads at the same time', () => {
    it('should predict a later arrival', () => {
      const forecast = new LoadForecast(map, congestedSpeed);
      const alone = forecast.route(trip, 0);

      for (let i = 0; i < 50; i++) forecast.book(alone.steps, 0);

      expect(forecast.route(trip, 0).arrival).toBeGreaterThan(alone.arrival);
    });

    it('should predict the arrival from the departure time', () => {
      const forecast = new LoadForecast(map, congestedSpeed);

      expect(forecast.route(trip, 100).arrival).toBeCloseTo(100 + freeFlowSeconds(map)(trip.entry, trip.exit));
    });
  });

  describe('When a booked vehicle is re-planned', () => {
    it('should forget the vehicle once its booking is cancelled', () => {
      const forecast = new LoadForecast(map, congestedSpeed);
      const alone = forecast.route(trip, 0);
      const bookings = Array.from({ length: 50 }, () => forecast.book(alone.steps, 0));

      bookings.forEach(booking => forecast.cancel(booking));

      expect(forecast.route(trip, 0).arrival).toBeCloseTo(alone.arrival);
    });
  });

  describe('When the road capacity is not a share of the jam density', () => {
    it('should refuse a capacity of the full jam density or more', () => {
      expect(() => new LoadForecast(map, congestedSpeed, 1)).toThrow(RangeError);
      expect(() => new LoadForecast(map, congestedSpeed, 1.5)).toThrow(RangeError);
    });

    it('should refuse a capacity of zero or less', () => {
      expect(() => new LoadForecast(map, congestedSpeed, 0)).toThrow(RangeError);
      expect(() => new LoadForecast(map, congestedSpeed, -0.2)).toThrow(RangeError);
    });
  });

  describe('When a road capacity is set', () => {
    const capacity = 0.7;
    const blockingLoad = (road: Road): number => {
      let vehicles = 0;
      while (congestionRatio(vehicles + 1, road.cost) <= capacity) vehicles++;
      return vehicles;
    };
    const fillEntryRoads = (forecast: LoadForecast, enter: number, leave: number): void => {
      for (const { road } of stepsFrom(map, trip.entry)) {
        for (let i = 0; i < blockingLoad(road); i++) forecast.occupy(road, enter, leave);
      }
    };

    it('should report no feasible arrival while every road out of the entry is full', () => {
      // Arrange
      const forecast = new LoadForecast(map, congestedSpeed, capacity);
      fillEntryRoads(forecast, 0, 59);

      // Act
      const blocked = forecast.route(trip, 0);

      // Assert
      expect(blocked.arrival).toBe(Infinity);
      expect(blocked.steps).toEqual(aStar(map, trip.entry, trip.exit, MAX_SPEED)!.steps);
    });

    it('should find a route again once the full slots are over', () => {
      // Arrange
      const forecast = new LoadForecast(map, congestedSpeed, capacity);
      fillEntryRoads(forecast, 0, 59);

      // Act
      const later = forecast.route(trip, 2 * ASSIGNMENT_SLOT);

      // Assert
      expect(Number.isFinite(later.arrival)).toBe(true);
    });

    it('should ignore the load limit when no capacity is set', () => {
      // Arrange
      const forecast = new LoadForecast(map, congestedSpeed);
      fillEntryRoads(forecast, 0, 59);

      // Act
      const crowded = forecast.route(trip, 0);

      // Assert
      expect(Number.isFinite(crowded.arrival)).toBe(true);
    });

    it('should reserve each road until the vehicle would leave it at the capacity speed', () => {
      // Arrange
      const forecast = new LoadForecast(map, congestedSpeed, capacity);
      const { steps } = forecast.route(trip, 0);
      const first = steps[0].road;
      const seconds = toSeconds(first.cost / Math.min(first.speed ?? MAX_SPEED, MAX_SPEED));
      const departure = Math.max(0, ASSIGNMENT_SLOT - seconds - 0.001);
      const firstSlot = Math.floor(departure / ASSIGNMENT_SLOT);
      const lastSlot = Math.floor((departure + seconds / (1 - capacity)) / ASSIGNMENT_SLOT);

      // Act
      const booking = forecast.book(steps, departure);

      // Assert
      expect(booking.filter(([road]) => road === first).map(([, slot]) => slot))
        .toEqual(Array.from({ length: lastSlot - firstSlot + 1 }, (_, i) => firstSlot + i));
    });

    it('should still enter the next road at its expected time', () => {
      // Arrange
      const forecast = new LoadForecast(map, congestedSpeed, capacity);
      const { steps } = forecast.route(trip, 0);
      const first = steps[0].road;
      const seconds = toSeconds(first.cost / Math.min(first.speed ?? MAX_SPEED, MAX_SPEED));
      const departure = Math.max(0, ASSIGNMENT_SLOT - seconds - 0.001);

      // Act
      const booking = forecast.book(steps, departure);

      // Assert
      const secondSlots = booking.filter(([road]) => road === steps[1].road).map(([, slot]) => slot);
      expect(Math.min(...secondSlots)).toBe(Math.floor((departure + seconds) / ASSIGNMENT_SLOT));
    });

    it('should book a finite reservation for a route that breaks the capacity', () => {
      // Arrange
      const forecast = new LoadForecast(map, congestedSpeed, capacity);
      fillEntryRoads(forecast, 0, 59);
      const { steps } = forecast.route(trip, 0);

      // Act
      const booking = forecast.book(steps, 0);

      // Assert
      expect(booking.every(([, slot]) => Number.isFinite(slot))).toBe(true);
    });
  });
});
