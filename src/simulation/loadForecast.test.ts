import { describe, it, expect } from 'vitest';
import { generateRoadMap } from '../topology/roadMap';
import { Trip } from './demand';
import { LoadForecast } from './loadForecast';
import { freeFlowSeconds } from './routing';
import { congestedSpeed } from './traffic';

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
});
