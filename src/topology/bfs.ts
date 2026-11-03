import { stepsFrom, Step } from './astar';
import { NodeId, Scenario } from './types';

interface Partial { at: NodeId, step?: Step, previous?: Partial }

const visits = (path: Partial | undefined, node: NodeId): boolean =>
  !!path && (path.at === node || visits(path.previous, node));

function toSteps(path: Partial): Step[] {
  const steps: Step[] = [];
  for (let p: Partial | undefined = path; p?.step; p = p.previous) steps.unshift(p.step);
  return steps;
}

/**
 * Breadth-first search for up to `count` routes with the fewest roads from
 * `start` to `goal`, ignoring speed limits. Routes never pass twice through
 * an intersection. Each intersection is expanded at most `count` times,
 * which keeps the search linear in the network size.
 */
export function bfsRoutes(scenario: Scenario, start: NodeId, goal: NodeId, count: number): Step[][] {
  // ponytail: per-node expansion cap may skip some k-shortest simple paths; every route found is still valid
  const routes: Step[][] = [];
  const expanded = new Map<NodeId, number>();
  const queue: Partial[] = [{ at: start }];
  for (let head = 0; head < queue.length && routes.length < count; head++) {
    const path = queue[head];
    if (path.at === goal) { routes.push(toSteps(path)); continue; }
    const times = expanded.get(path.at) ?? 0;
    if (times >= count) continue;
    expanded.set(path.at, times + 1);
    for (const step of stepsFrom(scenario, path.at)) {
      if (!visits(path, step.to)) queue.push({ at: step.to, step, previous: path });
    }
  }
  return routes;
}
