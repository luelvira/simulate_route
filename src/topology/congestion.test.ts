import { describe, it, expect } from 'vitest';
import { congestionStyle } from './congestion';

describe('Feature: Congestion colours on the map', () => {

  describe('When no vehicle has driven on a road', () => {
    it('should leave the asphalt untouched', () => {
      expect(congestionStyle(undefined).opacity).toBe(0);
    });
  });

  describe('When a vehicle has driven on a road without sharing it', () => {
    it('should paint the road green and visible', () => {
      const style = congestionStyle(0);

      expect(style.color).toBe('rgb(67, 160, 71)');
      expect(style.opacity).toBeGreaterThan(0);
    });
  });

  describe('When a road is fully jammed', () => {
    it('should paint the road red and clearly visible', () => {
      const style = congestionStyle(1);

      expect(style.color).toBe('rgb(211, 47, 47)');
      expect(style.opacity).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('When a road fills up gradually', () => {
    it('should paint the first vehicles green', () => {
      expect(congestionStyle(0.05).color).toBe('rgb(67, 160, 71)');
    });

    it('should make the overlay progressively more opaque', () => {
      expect(congestionStyle(0.5).opacity).toBeGreaterThan(congestionStyle(0.2).opacity);
      expect(congestionStyle(1).opacity).toBeGreaterThan(congestionStyle(0.5).opacity);
    });

    it('should move the colour away from green before it reaches red', () => {
      expect(congestionStyle(0.5).color).not.toBe(congestionStyle(0.05).color);
      expect(congestionStyle(0.5).color).not.toBe(congestionStyle(1).color);
    });
  });

  describe('When the congestion value is out of range', () => {
    it('should clamp it to the closest end of the scale', () => {
      expect(congestionStyle(-1)).toEqual(congestionStyle(0));
      expect(congestionStyle(2)).toEqual(congestionStyle(1));
    });
  });
});
