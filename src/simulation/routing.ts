import { aStar, Step } from '../topology/astar';
import { MAX_SPEED } from '../topology/roadMap';
import { Road, Scenario } from '../topology/types';
import { Trip } from './demand';
import { congestedSpeed, toSeconds } from './traffic';

/** Share of the allowed speed an unguided driver drives at while looking for the way. */
export const HESITATION_FACTOR = 0.9;
/** Width (s) of the time slots used to forecast how many vehicles share a road. */
export const ASSIGNMENT_SLOT = 30;

/** Decides the route of each trip. */
export interface Planner {
  /** Share of the allowed speed its drivers actually drive at (1 when omitted). */
  speedFactor?: number,
  plan(trip: Trip): Step[],
}

const speedOf = (road: Road): number => Math.min(road.speed ?? MAX_SPEED, MAX_SPEED);

function route(scenario: Scenario, from: Step['from'], trip: Trip, edgeTime?: (road: Road, enteredAt: number) => number): Step[] {
  return aStar(scenario, from, trip.exit, MAX_SPEED, edgeTime)!.steps;
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
  const booked = new Map<Road, Map<number, number>>();
  const slotOf = (seconds: number): number => Math.floor(seconds / ASSIGNMENT_SLOT);
  const occupancy = (road: Road, seconds: number): number => booked.get(road)?.get(slotOf(seconds)) ?? 0;
  const roadTime = (road: Road, seconds: number): number =>
    road.cost / congestedSpeed(speedOf(road), occupancy(road, seconds), road.cost);

  const routes = new Map<number, Step[]>();
  for (const trip of trips) {
    const steps = route(scenario, trip.entry, trip, (road, at) => roadTime(road, trip.departure + toSeconds(at)));
    let clock = trip.departure;
    for (const { road } of steps) {
      const leave = clock + toSeconds(roadTime(road, clock));
      const slots = booked.get(road) ?? new Map<number, number>();
      for (let slot = slotOf(clock); slot <= slotOf(leave); slot++) slots.set(slot, (slots.get(slot) ?? 0) + 1);
      booked.set(road, slots);
      clock = leave;
    }
    routes.set(trip.id, steps);
  }
  return { plan: trip => routes.get(trip.id)! };
}
