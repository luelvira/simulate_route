import { generateRoadMap } from '../topology/roadMap';
import type { SimulationConfig } from '../ui/configStorage';
import { centralPlanner } from './centralPlanner';
import { demandRandom, generateDemand } from './demand';
import { PlannedTrip, PlanTable, toPlanTable } from './planTable';
import { repairPlan } from './repairPlan';
import { balancedPlanner, freeFlowPlanner, freeFlowSeconds, Planner, unguidedPlanner } from './routing';

/** Scenarios whose plans are computed ahead of the simulation. */
export type PlanKey = 'base' | 'astar' | 'optimized' | 'central';

/** Every scenario, in display order. */
export const PLAN_KEYS: PlanKey[] = ['base', 'astar', 'optimized', 'central'];

/** Plan of every scenario. */
export type PrecomputedPlans = Record<PlanKey, PlanTable>;

/**
 * Rebuilds the map and the demand from the configuration (both are
 * deterministic) and returns the plan of one scenario. The central plan is
 * repaired against the simulation before it is returned.
 */
export function computePlan(config: SimulationConfig, key: PlanKey): PlanTable {
  const map = generateRoadMap(config);
  const trips = generateDemand(map.entries, map.exits, config.vehicles, demandRandom(config.seed), freeFlowSeconds(map));
  const planners: Record<PlanKey, () => Planner> = {
    base: () => unguidedPlanner(map),
    astar: () => freeFlowPlanner(map),
    optimized: () => balancedPlanner(map, trips),
    central: () => repairPlan(map, trips, centralPlanner(map, trips)),
  };
  return toPlanTable(planners[key](), trips);
}


export function serialize(plans: PrecomputedPlans) {
  const data: [PlanKey, PlanTable][] = Object.entries(plans) as [PlanKey, PlanTable][];
  const dataToSerialize: {[k in PlanKey]: [number, PlannedTrip][]} = {} as {[k in PlanKey]: [number, PlannedTrip][]};
  for (const [key, val] of data) {
    const ent = (Array.from(val.entries()));
    dataToSerialize[key] = ent;
  }
  return JSON.stringify(dataToSerialize);
}


export function desearilize(plans: string): PrecomputedPlans {
  const dataSerialize = JSON.parse(plans) as {[k in PlanKey]: [number, PlannedTrip][]};
  const dataEntries = Object.entries(dataSerialize) as  unknown as [PlanKey, [number, PlannedTrip][]][];
  return dataEntries.reduce((acc, [key, val]) => {
    acc[key] = new Map(val);
    return acc;
  }, {} as {[k in PlanKey]: PlanTable});
}
