import { desearilize, PrecomputedPlans, serialize } from "../simulation/precomputePlans";
import { SimulationConfig } from "./configStorage";


export interface Cache {
  load: (config: SimulationConfig) => PrecomputedPlans | undefined;
  set: (config: SimulationConfig, value: PrecomputedPlans) => void;
  update: () => void;

}

function hashFNV1a(str: string) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(36);
}

export function cache(
  storage: Storage = localStorage,
  hash: (str: string) => string = hashFNV1a,
): Cache {
  const __cache = new Map<string, string>();
  const SAVED_CACHE_KEY = 'simulate_route/cache';


  function load(config: SimulationConfig): PrecomputedPlans | undefined {
    const name = hash(JSON.stringify(config));
    const hotValue =  __cache.get(name);
    if (hotValue) return desearilize(hotValue);
    const val = storage.getItem(`${SAVED_CACHE_KEY}--${name}`);
    return val ? desearilize(val) : undefined;
  }


  function set(config: SimulationConfig, value: PrecomputedPlans): void {
    const name = hash(JSON.stringify(config));
    
    __cache.set(`${name}`, serialize(value));
  }

  function update() {
    for (const [key, val] of __cache.entries()) {
      storage.setItem(`${SAVED_CACHE_KEY}--${key}`, val);
    }
  }

  return {
    load,
    set,
    update,
  }
}
