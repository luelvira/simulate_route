import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, parseConfig } from './configStorage';

function formDataOf(fields: Record<string, string>): FormData {
  const data = new FormData();
  Object.entries(fields).forEach(([name, value]) => data.set(name, value));
  return data;
}

describe('Feature: Reading the scenario form', () => {

  describe('When every field holds a valid value', () => {
    it('should forward every field, including ratios and vehicles, to the configuration', () => {
      const data = formDataOf({
        rows: '10', cols: '12', entryCount: '4', exitCount: '3', blockSize: '6',
        seed: '99', cycleRatio: '0.5', roundaboutRatio: '0.1', vehicles: '200',
      });

      expect(parseConfig(data)).toEqual({
        rows: 10, cols: 12, entryCount: 4, exitCount: 3, blockSize: 6,
        seed: 99, cycleRatio: 0.5, roundaboutRatio: 0.1, vehicles: 200,
      });
    });
  });

  describe('When fields are empty or not numeric', () => {
    it('should fall back to the default value of each of those fields', () => {
      const data = formDataOf({ rows: '', seed: 'abc', cycleRatio: '' });

      expect(parseConfig(data)).toEqual(DEFAULT_CONFIG);
    });
  });

  describe('When an integer field holds a decimal number', () => {
    it('should round it to the nearest integer', () => {
      expect(parseConfig(formDataOf({ vehicles: '12.6' })).vehicles).toBe(13);
    });
  });
});
