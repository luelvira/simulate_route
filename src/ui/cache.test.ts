import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cache } from './cache';
import { SimulationConfig } from './configStorage';
import { PrecomputedPlans } from '@/simulation/precomputePlans';

function createSimulationConfig(
  overrides: Partial<SimulationConfig> = {},
): SimulationConfig {
  return {
    // Valores por defecto válidos.
    rows: 18,
    cols: 24,
    entryCount: 12,
    exitCount: 4,
    blockSize: 7,
    seed: 47,
    cycleRatio: 0.35,
    roundaboutRatio: 0.2,
    vehicles: 50,
    ...overrides,
  };
}

function createPrecomputedPlans(): PrecomputedPlans {
  return {
    base: new Map([
      [1, { departure: 0, steps: [["start", "r0c0"], ["move", "r0c1"]] }],
      [2, { departure: 36, steps: [["start", "r0c0"], ["move", "r0c1"]] }],
      [3, { departure: 48, steps: [["start", "r0c0"], ["move", "r0c1"]] }],
    ]),
    astar: new Map([
      [1, { departure: 0, steps: [["start", "r0c0"], ["move", "r1c1"]] }]
    ]),
    optimized: new Map([
      [1, { departure: 0, steps: [["start", "r0c0"], ["move", "r1c0"]] }]
    ]),
    central: new Map([
      [1, { departure: 0, steps: [["start", "r0c0"], ["move", "r0c0"]] }]
    ]),
  };
}

describe('cache', () => {
  let storage: Storage;

  beforeEach(() => {
    const cache = new Map<string, string>(); 
    storage = {
      getItem: vi.fn((key: string) => cache.get(key) ?? null),
      setItem: vi.fn((key: string, val: string) => cache.set(key, val)),
      removeItem: vi.fn((key: string) => cache.delete(key)),
      clear: vi.fn(() => cache.clear()),
      key: vi.fn(),
      length: 0,
    };
  });

  describe('load', () => {
    it('should return undefined when the config is not cached', () => {
      // Arrange
      const sut = cache(storage);
      const config = createSimulationConfig();

      // Act
      const result = sut.load(config);

      // Assert
      expect(result).toBeUndefined();
    });

    it('should return the plans previously stored in memory', () => {
      // Arrange
      const sut = cache(storage);
      const config = createSimulationConfig();
      const plans = createPrecomputedPlans();

      sut.set(config, plans);

      // Act
      const result = sut.load(config);

      // Assert
      expect(result).toEqual(plans);
    });

    it('should distinguish between different configurations', () => {
      // Arrange
      const sut = cache(storage);
      const configA = createSimulationConfig();
      const configB = createSimulationConfig({
        vehicles: 60
      });
      const plans = createPrecomputedPlans();

      sut.set(configA, plans);

      // Act
      const result = sut.load(configB);

      // Assert
      expect(result).toBeUndefined();
    });

    it('should use storage values when not found in memory', () => {

      // Arrange
      let sut = cache(storage);
      const config = createSimulationConfig();
      const plans = createPrecomputedPlans();


      sut.set(config, plans);
      sut.update();

      // Act
      sut = cache(storage);
      const result = sut.load(config);

      // Assert
      expect(result).toEqual(plans);
      expect(storage.getItem).toHaveBeenCalledWith(`simulate_route/cache--${JSON.stringify(config)}`);

    });
  });

  describe('set', () => {
    it('should store plans in memory', () => {
      // Arrange
      const sut = cache(storage);
      const config = createSimulationConfig();
      const plans = createPrecomputedPlans();

      // Act
      sut.set(config, plans);

      // Assert
      expect(sut.load(config)).toEqual(plans);
    });

    it('should replace previously stored plans for the same config', () => {
      // Arrange
      const sut = cache(storage);
      const config = createSimulationConfig();
      const initialPlans = createPrecomputedPlans();
      const updatedPlans = createPrecomputedPlans();

      sut.set(config, initialPlans);

      // Act
      sut.set(config, updatedPlans);

      // Assert
      expect(sut.load(config)).toEqual(updatedPlans);
    });

    it('should not persist plans immediately', () => {
      // Arrange
      const sut = cache(storage);
      const config = createSimulationConfig();
      const plans = createPrecomputedPlans();

      // Act
      sut.set(config, plans);

      // Assert
      expect(storage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should persist cached plans to storage', () => {
      // Arrange
      const sut = cache(storage);
      const config = createSimulationConfig();
      const plans = createPrecomputedPlans();

      sut.set(config, plans);

      // Act
      sut.update();

      // Assert
      expect(storage.setItem).toHaveBeenCalledOnce();
    });

    it('should persist changes made after the previous update', () => {
      // Arrange
      const sut = cache(storage);
      const config = createSimulationConfig();
      const initialPlans = createPrecomputedPlans();
      const updatedPlans = createPrecomputedPlans();

      sut.set(config, initialPlans);
      sut.update();

      // Act
      sut.set(config, updatedPlans);
      sut.update();

      // Assert
      expect(storage.setItem).toHaveBeenCalledTimes(2);
    });

    it('should use the provided storage instead of localStorage', () => {
      // Arrange
      const sut = cache(storage);
      const config = createSimulationConfig();
      const plans = createPrecomputedPlans();

      sut.set(config, plans);

      // Act
      sut.update();

      // Assert
      expect(storage.setItem).toHaveBeenCalled();
    });
  });

  describe('instances', () => {
    it('should maintain independent in-memory caches', () => {
      // Arrange
      const firstCache = cache(storage);
      const secondCache = cache(storage);
      const config = createSimulationConfig();
      const plans = createPrecomputedPlans();

      // Act
      firstCache.set(config, plans);

      // Assert
      expect(firstCache.load(config)).toEqual(plans);
      expect(secondCache.load(config)).toBeUndefined();
    });
  });
});
