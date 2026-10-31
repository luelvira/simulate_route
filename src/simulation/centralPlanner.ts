import { Step } from '../topology/astar';
import { Scenario } from '../topology/types';
import { Trip } from './demand';
import { ASSIGNMENT_SLOT, LoadForecast } from './loadForecast';
import { Planner } from './routing';
import { queuedSpeed } from './traffic';

/** Longest a departure may be delayed past its nominal time (s). */
export const MAX_DELAY = 1800;
/** Delayed departures are tried every this many forecast slots. */
export const DELAY_STEP_SLOTS = 4;
/** Weight of each second waiting at the destination against a second on the road. */
export const EARLY_ARRIVAL_WEIGHT = 0.5;

interface Schedule { departure: number, steps: Step[], arrival: number }

const roadTime = (s: Schedule): number => s.arrival - s.departure;

/**
 * Central scenario: schedules every vehicle before the simulation starts,
 * one by one in target order, on a forecast of the traffic already planned.
 * A vehicle leaves at its nominal departure when it arrives on time;
 * otherwise it leaves earlier (never before time 0), choosing the departure
 * that best balances road time and waiting at the destination. A vehicle
 * that cannot arrive on time at all is the only one ever delayed: it takes
 * the departure with the shortest road time, moving it out of the peak so
 * the roads stay free for vehicles that can still make it.
 */
export function centralPlanner(scenario: Scenario, trips: Trip[]): Planner & {
  departure(trip: Trip): number,
  arrival(trip: Trip): number,
} {
  // ponytail: one greedy pass in target order, no iteration to equilibrium
  const forecast = new LoadForecast(scenario, queuedSpeed);
  const schedules = new Map<number, Schedule>();
  const at = (trip: Trip, departure: number): Schedule => ({ departure, ...forecast.route(trip, departure) });

  for (const trip of [...trips].sort((a, b) => a.target - b.target || a.id - b.id)) {
    const schedule = onTime(trip, at) ?? delayed(trip, at);
    forecast.book(schedule.steps, schedule.departure);
    schedules.set(trip.id, schedule);
  }
  return {
    plan: trip => schedules.get(trip.id)!.steps,
    departure: trip => schedules.get(trip.id)!.departure,
    arrival: trip => schedules.get(trip.id)!.arrival,
  };
}

/** Best on-time schedule leaving at the nominal departure or earlier, if any. */
function onTime(trip: Trip, at: (trip: Trip, departure: number) => Schedule): Schedule | undefined {
  const cost = (s: Schedule): number => roadTime(s) + EARLY_ARRIVAL_WEIGHT * (trip.target - s.arrival);
  let best: Schedule | undefined;
  for (let departure = trip.departure; ;) {
    const candidate = at(trip, departure);
    const lateness = candidate.arrival - trip.target;
    if (lateness <= 0) {
      if (best && cost(candidate) >= cost(best)) return best;
      best = candidate;
    } else if (best) {
      return best;
    }
    if (departure === 0) return best;
    // a late vehicle steps back by its lateness; an on-time one probes one slot earlier
    departure = Math.max(0, Math.floor(departure - (lateness > 0 ? Math.max(1, lateness) : ASSIGNMENT_SLOT)));
  }
}

/** Shortest-road-time schedule of a vehicle that will be late anyway. */
function delayed(trip: Trip, at: (trip: Trip, departure: number) => Schedule): Schedule {
  let best = at(trip, trip.departure);
  for (let delay = DELAY_STEP_SLOTS * ASSIGNMENT_SLOT; delay <= MAX_DELAY; delay += DELAY_STEP_SLOTS * ASSIGNMENT_SLOT) {
    const candidate = at(trip, trip.departure + delay);
    if (roadTime(candidate) < roadTime(best)) best = candidate;
  }
  return best;
}
