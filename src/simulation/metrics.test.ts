import { describe, it, expect } from 'vitest';
import { computeMetrics } from './metrics';

describe('Feature: Simulation metrics', () => {

  describe('When some vehicles have reached their exit', () => {
    const vehicles = [
      { departure: 0, arrival: 100, idealTime: 50 },
      { departure: 10, arrival: 70, idealTime: 60 },
      { departure: 20, arrival: undefined, idealTime: 40 },
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
        { departure: 0, arrival: 20, idealTime: 10 },
        { departure: 0, arrival: 60, idealTime: 30 },
      ], 0);

      expect(metrics.equity).toBeCloseTo(100);
    });
  });

  describe('When no vehicle has arrived yet', () => {
    it('should report zero times instead of invalid numbers', () => {
      const metrics = computeMetrics([{ departure: 0, arrival: undefined, idealTime: 10 }], 0);

      expect(metrics.avgTravelTime).toBe(0);
      expect(metrics.equity).toBe(0);
    });
  });
});
