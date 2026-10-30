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

export const DEFAULT_CONFIG: SimulationConfig = {
  rows: 18, cols: 24, entryCount: 12, exitCount: 4,
  blockSize: 7, seed: 47, cycleRatio: 0.35, roundaboutRatio: 0.2,
  vehicles: 50,
};

const INT_FIELDS = new Set<string>(['rows', 'cols', 'entryCount', 'exitCount', 'blockSize', 'seed', 'vehicles']);

/** Builds a configuration from form data; empty or non-numeric fields keep their default value. */
export function parseConfig(data: FormData): SimulationConfig {
  return Object.fromEntries(Object.entries(DEFAULT_CONFIG).map(([field, fallback]) => {
    const raw = String(data.get(field) ?? '').trim();
    const value = raw === '' ? Number.NaN : Number(raw);
    if (!Number.isFinite(value)) return [field, fallback];
    return [field, INT_FIELDS.has(field) ? Math.round(value) : value];
  })) as unknown as SimulationConfig;
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
