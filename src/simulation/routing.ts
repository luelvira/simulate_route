import { aStar, Step } from '../topology/astar';
import { MAX_SPEED } from '../topology/roadMap';
import { NodeId, Scenario } from '../topology/types';
import { Trip } from './demand';
import { LoadForecast } from './loadForecast';
import { congestedSpeed, toSeconds } from './traffic';

/** Share of the allowed speed an unguided driver drives at while looking for the way. */
export const HESITATION_FACTOR = 0.9;

/** Decides the route of each trip. */
export interface Planner {
  /** Share of the allowed speed its drivers actually drive at (1 when omitted). */
  speedFactor?: number,
  /** Time the trip actually departs (its nominal departure when omitted). */
  departure?(trip: Trip): number,
  plan(trip: Trip): Step[],
}

/** Free-flow travel time (s) between an entry and an exit, memoised per pair. */
export function freeFlowSeconds(scenario: Scenario): (entry: NodeId, exit: NodeId) => number {
  const cache = new Map<string, number>();
  return (entry, exit) => {
    const key = `${entry}>${exit}`;
    if (!cache.has(key)) cache.set(key, toSeconds(aStar(scenario, entry, exit, MAX_SPEED)!.time));
    return cache.get(key)!;
  };
}

function route(scenario: Scenario, from: Step['from'], trip: Trip): Step[] {
  return aStar(scenario, from, trip.exit, MAX_SPEED)!.steps;
}

/** A*: every driver takes the fastest route of the empty network. */
export function freeFlowPlanner(scenario: Scenario): Planner {
  return { plan: trip => route(scenario, trip.entry, trip) };
}

/**
 * Base scenario: drivers follow the fastest route of the empty network
 * (Dijkstra) without guidance, so they drive below the allowed speed while
 * looking for the way.
 */
export function unguidedPlanner(scenario: Scenario): Planner {
  return { speedFactor: HESITATION_FACTOR, plan: freeFlowPlanner(scenario).plan };
}

/**
 * Optimised scenario: time-dependent incremental assignment. Trips are routed
 * in departure order; each route books the time slots it occupies on every
 * road, so later trips see those roads slower at those times and spread
 * over alternative roads (or keep the fastest one when traffic is light).
 */
export function balancedPlanner(scenario: Scenario, trips: Trip[]): Planner {
  // ponytail: one greedy pass, no iteration to equilibrium; enough for the demo
  const forecast = new LoadForecast(scenario, congestedSpeed);
  const routes = new Map<number, Step[]>();
  for (const trip of trips) {
    const { steps } = forecast.route(trip, trip.departure);
    forecast.book(steps, trip.departure);
    routes.set(trip.id, steps);
  }
  return { plan: trip => routes.get(trip.id)! };
}
