import { describe, it, expect } from 'vitest';
import { congestionRatio, congestedSpeed, MIN_SPEED_FACTOR } from './traffic';

describe('Feature: Speed reduction caused by traffic density', () => {

  describe('When a road is empty', () => {
    it('should allow driving at the speed limit', () => {
      expect(congestedSpeed(60, 0, 10)).toBe(60);
    });
  });

  describe('When more vehicles share the same road', () => {
    it('should make every vehicle drive slower', () => {
      expect(congestedSpeed(60, 4, 10)).toBeLessThan(congestedSpeed(60, 2, 10));
    });

    it('should slow down short roads more than long roads with the same vehicles', () => {
      expect(congestedSpeed(60, 3, 4)).toBeLessThan(congestedSpeed(60, 3, 12));
    });
  });

  describe('When a road is completely jammed', () => {
    it('should report 100% congestion and keep a minimum crawling speed so traffic never stops', () => {
      expect(congestionRatio(1000, 2)).toBe(1);
      expect(congestedSpeed(60, 1000, 2)).toBe(60 * MIN_SPEED_FACTOR);
    });
  });
});
