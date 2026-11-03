import type { SimulationConfig } from '../ui/configStorage';
import { computePlan } from './precomputePlans';

/** Computes the optimised and central plans off the page thread. */
self.onmessage = ({ data: config }: MessageEvent<SimulationConfig>) => {
  self.postMessage({ optimized: computePlan(config, 'optimized'), central: computePlan(config, 'central') });
};
