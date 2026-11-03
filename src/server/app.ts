import { Hono } from 'hono';
import { generateRoadMap } from '../topology/roadMap';
import { parseConfig, SimulationConfig } from '../ui/configStorage';
import { computePlan, PLAN_KEYS, PrecomputedPlans } from '../simulation/precomputePlans';

/** Computes the plan of every scenario. */
export type PlanRunner = (config: SimulationConfig) => PrecomputedPlans;

/** Plans every scenario one after another in this process. */
// ponytail: synchronous, blocks the event loop while planning; fine for one user, move to a worker thread if requests must overlap
export const planAll: PlanRunner = config =>
  Object.fromEntries(PLAN_KEYS.map(key => [key, computePlan(config, key)])) as PrecomputedPlans;

/** Accepted range of every field, the same as the min and max of the form inputs. */
const LIMITS: Record<keyof SimulationConfig, [number, number]> = {
  rows: [1, 60], cols: [2, 60], entryCount: [1, 59], exitCount: [1, 59], blockSize: [3, 20],
  seed: [0, 4_294_967_295], cycleRatio: [0, 1], roundaboutRatio: [0, 1], vehicles: [1, 1000],
};

/** First field of `config` outside its limits, if any. */
function fieldOutOfLimits(config: SimulationConfig): keyof SimulationConfig | undefined {
  return (Object.keys(LIMITS) as (keyof SimulationConfig)[])
    .find(field => config[field] < LIMITS[field][0] || config[field] > LIMITS[field][1]);
}

/**
 * HTTP API of the planning server. POST /api/plans takes the scenario form
 * and answers the plan of every scenario, each table as an array of
 * [trip id, planned trip] entries because JSON cannot hold a Map.
 */
export function createApp(runPlans: PlanRunner = planAll): Hono {
  const app = new Hono();
  app.post('/api/plans', async (c) => {
    const config = parseConfig(await c.req.formData());
    const field = fieldOutOfLimits(config);
    if (field) return c.json({ error: `${field} is outside [${LIMITS[field].join(', ')}]` }, 400);
    try {
      generateRoadMap(config);
    } catch (error) {
      return c.json({ error: (error as Error).message }, 422);
    }
    try {
      const plans = runPlans(config);
      return c.json(Object.fromEntries(PLAN_KEYS.map(key => [key, [...plans[key]]])));
    } catch (error) {
      return c.json({ error: (error as Error).message }, 500);
    }
  });
  return app;
}
