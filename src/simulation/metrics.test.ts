import { describe, it, expect } from 'vitest';
import { computeMetrics } from './metrics';

const onTimeTrip = { departure: 0, target: 1000 };

describe('Feature: Simulation metrics', () => {

  describe('When some vehicles have reached their exit', () => {
    const vehicles = [
      { departure: 0, arrival: 100, idealTime: 50, trip: onTimeTrip },
      { departure: 10, arrival: 70, idealTime: 60, trip: onTimeTrip },
      { departure: 20, arrival: undefined, idealTime: 40, trip: onTimeTrip },
    ];
    const metrics = computeMetrics(vehicles, 0.42);

    it('should count completed vehicles over the total', () => {
      expect(metrics.completed).toBe(2);
      expect(metrics.total).toBe(3);
    });

    it('should report average, total and maximum travel time of completed vehicles', () => {
      expect(metrics.avgTravelTime).toBe(80);
      expect(metrics.totalTravelTime).toBe(160);
      expect(metrics.maxTravelTime).toBe(100);
    });

    it('should report lost time as the extra time compared with an empty road network', () => {
      expect(metrics.lostTime).toBe(50);
    });

    it('should report the highest congestion as a percentage', () => {
      expect(metrics.maxCongestion).toBe(42);
    });

    it('should measure equity with Jain index over each vehicle efficiency', () => {
      // efficiencies 0.5 and 1 -> (1.5)^2 / (2 * 1.25) = 0.9
      expect(metrics.equity).toBeCloseTo(90);
    });
  });

  describe('When every vehicle suffers the same relative delay', () => {
    it('should report perfect equity', () => {
      const metrics = computeMetrics([
        { departure: 0, arrival: 20, idealTime: 10, trip: onTimeTrip },
        { departure: 0, arrival: 60, idealTime: 30, trip: onTimeTrip },
      ], 0);

      expect(metrics.equity).toBeCloseTo(100);
    });
  });

  describe('When vehicles drive exactly at free-flow time up to rounding errors', () => {
    it('should report no lost time instead of a negative one', () => {
      const metrics = computeMetrics([{ departure: 0, arrival: 0.3, idealTime: 0.1 + 0.2, trip: onTimeTrip }], 0);

      expect(metrics.lostTime).toBe(0);
    });
  });

  describe('When no vehicle has arrived yet', () => {
    it('should report zero times instead of invalid numbers', () => {
      const metrics = computeMetrics([{ departure: 0, arrival: undefined, idealTime: 10, trip: onTimeTrip }], 0);

      expect(metrics.avgTravelTime).toBe(0);
      expect(metrics.equity).toBe(0);
      expect(metrics.onTime).toBe(0);
      expect(metrics.avgLateness).toBe(0);
    });
  });

  describe('When vehicles have an arrival target', () => {
    const metrics = computeMetrics([
      { departure: 0, arrival: 100, idealTime: 50, trip: { departure: 0, target: 100 } },
      { departure: 30, arrival: 130, idealTime: 50, trip: { departure: 10, target: 100 } },
      { departure: 0, arrival: 110, idealTime: 50, trip: { departure: 0, target: 100 } },
      { departure: 0, arrival: undefined, idealTime: 50, trip: { departure: 0, target: 100 } },
    ], 0);

    it('should count as on time only the vehicles that arrived no later than their target', () => {
      expect(metrics.onTime).toBe(25);
    });

    it('should average the lateness of the vehicles that arrived late', () => {
      // 30 s and 10 s late
      expect(metrics.avgLateness).toBe(20);
    });

    it('should average how far each departure was moved from its nominal time', () => {
      // only the second vehicle left 20 s after its nominal departure
      expect(metrics.avgDepartureShift).toBe(5);
    });
  });
});
