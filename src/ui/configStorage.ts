export interface SimulationConfig {
  rows: number;
  cols: number;
  entryCount: number;
  exitCount: number;
  blockSize: number;
  seed: number;
  cycleRatio: number;
  roundaboutRatio: number;
  vehicles: number;
}

const sortedKeys = (entries: Record<string, unknown>): string[] =>
  Object.keys(entries).sort();

function readCollection(storage: Storage): Record<string, unknown> {
  try {
    const raw = storage.getItem(SAVED_CONFIGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveConfig(name: string, config: SimulationConfig, storage: Storage): void {
  if (name.trim() === '') throw new RangeError('Configuration name must not be empty.');
  const collection = readCollection(storage);
  collection[name] = config;
  storage.setItem(SAVED_CONFIGS_KEY, JSON.stringify(collection));
}

export function listConfigs(storage: Storage): string[] {
  return sortedKeys(readCollection(storage));
}

export function loadConfig(name: string, storage: Storage): SimulationConfig | null {
  return (readCollection(storage)[name] as SimulationConfig | undefined) ?? null;
}

export const SAVED_CONFIGS_KEY = 'simulate_route/configurations';
