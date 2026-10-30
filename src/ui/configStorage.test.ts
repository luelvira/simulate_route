import { describe, it, expect, vi } from 'vitest';
import { SimulationConfig, SAVED_CONFIGS_KEY, listConfigs, loadConfig, saveConfig } from './configStorage';

const anyConfig: SimulationConfig = {
  rows: 18, cols: 24, entryCount: 12, exitCount: 4,
  blockSize: 7, seed: 47, cycleRatio: 0.35, roundaboutRatio: 0.2,
  vehicles: 50,
};

function createFakeStorage(): Storage {
  return {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(() => null),
    get length() { return 0; },
  };
}

describe('Feature: Simulation configuration storage', () => {

  describe('When saving a configuration', () => {
    it('should persist all fields keyed by the given name', () => {
      const storage = createFakeStorage();

      saveConfig('grid-18x24', anyConfig, storage);

      expect(storage.setItem).toHaveBeenCalledWith(
        SAVED_CONFIGS_KEY,
        JSON.stringify({ 'grid-18x24': anyConfig }),
      );
    });

    it('should overwrite a configuration that already uses the same name', () => {
      const storage = createFakeStorage();
      vi.mocked(storage.getItem).mockReturnValue(JSON.stringify({
        'grid-18x24': anyConfig,
      }));

      saveConfig('grid-18x24', { ...anyConfig, vehicles: 200 }, storage);

      expect(storage.setItem).toHaveBeenCalledWith(
        SAVED_CONFIGS_KEY,
        JSON.stringify({ 'grid-18x24': { ...anyConfig, vehicles: 200 } }),
      );
    });

    it('should reject an empty name without touching the storage', () => {
      const storage = createFakeStorage();

      expect(() => saveConfig('   ', anyConfig, storage)).toThrow();
      expect(storage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('When listing saved configurations', () => {
    it('should return no names when the storage is empty', () => {
      const storage = createFakeStorage();

      expect(listConfigs(storage)).toEqual([]);
    });

    it('should return the name of every stored configuration', () => {
      const storage = createFakeStorage();
      vi.mocked(storage.getItem).mockReturnValue(JSON.stringify({
        'grid-18x24': anyConfig,
        'dense-city': anyConfig,
      }));

      expect(listConfigs(storage)).toEqual(['dense-city', 'grid-18x24']);
    });
  });

  describe('When loading a configuration', () => {
    it('should return the configuration stored under the given name', () => {
      const storage = createFakeStorage();
      vi.mocked(storage.getItem).mockReturnValue(JSON.stringify({
        'grid-18x24': anyConfig,
      }));

      expect(loadConfig('grid-18x24', storage)).toEqual(anyConfig);
    });

    it('should return null for an unknown name', () => {
      const storage = createFakeStorage();

      expect(loadConfig('missing', storage)).toBeNull();
    });

    it('should return null when the stored data is corrupted', () => {
      const storage = createFakeStorage();
      vi.mocked(storage.getItem).mockReturnValue('not json');

      expect(loadConfig('grid-18x24', storage)).toBeNull();
    });
  });
});
