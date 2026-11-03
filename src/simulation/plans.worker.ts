import { generateRoadMap } from '../topology/roadMap';
import type { SimulationConfig } from '../ui/configStorage';
import { centralPlanner } from './centralPlanner';
import { demandRandom, generateDemand } from './demand';
import { PlanTable, toPlanTable } from './planTable';
import { repairPlan } from './repairPlan';
import { balancedPlanner, freeFlowSeconds } from './routing';

/** Plans of the strategies that are computed ahead of the simulation. */
export interface PrecomputedPlans { optimized: PlanTable, central: PlanTable }

/**
 * Rebuilds the map and the demand from the configuration (both are
 * deterministic) and computes the optimised and central plans off the page
 * thread, so the interface stays responsive while they are calculated.
 * The central plan is repaired against the simulation before it is sent.
 */
self.onmessage = ({ data: config }: MessageEvent<SimulationConfig>) => {
  const map = generateRoadMap(config);
  const trips = generateDemand(map.entries, map.exits, config.vehicles, demandRandom(config.seed), freeFlowSeconds(map));
  const plans: PrecomputedPlans = {
    optimized: toPlanTable(balancedPlanner(map, trips), trips),
    central: toPlanTable(repairPlan(map, trips, centralPlanner(map, trips)), trips),
  };
  self.postMessage(plans);
};
