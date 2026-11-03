import { Step } from '../topology/astar';
import { Scenario } from '../topology/types';
import { Trip } from './demand';
import { ASSIGNMENT_SLOT, Booking, LoadForecast } from './loadForecast';
import { Planner } from './routing';
import { queuedSpeed } from './traffic';

/** Longest a departure may be delayed past its nominal time (s). */
export const MAX_DELAY = 3600;
/** Delayed departures are tried every this many forecast slots. */
export const DELAY_STEP_SLOTS = 4;
/**
 * Planning passes. The first one only sees the vehicles planned before each
 * one; the next ones re-plan every vehicle against all the others.
 */
export const PASSES = 2;
/** Weight of each second waiting at the destination against a second on the road. */
export const EARLY_ARRIVAL_WEIGHT = 0.25;

interface Schedule { departure: number, steps: Step[], arrival: number }

const roadTime = (s: Schedule): number => s.arrival - s.departure;

/**
 * Central scenario: schedules every vehicle before the simulation starts,
 * one by one in target order, on a forecast of the traffic already planned,
 * and then re-plans each one knowing where all the others will be.
 * A vehicle leaves at its nominal departure when it arrives on time;
 * otherwise it leaves earlier (never before time 0), choosing among the
 * on-time departures the one that best balances road time and waiting at
 * the destination. A vehicle
 * that cannot arrive on time at all is the only one ever delayed: it takes
 * the departure with the shortest road time, moving it out of the peak so
 * the roads stay free for vehicles that can still make it.
 */
export function centralPlanner(scenario: Scenario, trips: Trip[]): Planner & {
  departure(trip: Trip): number,
  arrival(trip: Trip): number,
} {
  // ponytail: two greedy passes, no iteration to equilibrium
  const forecast = new LoadForecast(scenario, queuedSpeed);
  const schedules = new Map<number, Schedule>();
  const bookings = new Map<number, Booking>();
  const at = (trip: Trip, departure: number): Schedule => ({ departure, ...forecast.route(trip, departure) });
  const ordered = [...trips].sort((a, b) => a.target - b.target || a.id - b.id);

  for (let pass = 0; pass < PASSES; pass++) {
    for (const trip of ordered) {
      const previous = bookings.get(trip.id);
      if (previous) forecast.cancel(previous);
      const schedule = onTime(trip, at) ?? delayed(trip, at);
      bookings.set(trip.id, forecast.book(schedule.steps, schedule.departure));
      schedules.set(trip.id, schedule);
    }
  }
  return {
    plan: trip => schedules.get(trip.id)!.steps,
    departure: trip => schedules.get(trip.id)!.departure,
    arrival: trip => schedules.get(trip.id)!.arrival,
  };
}

/**
 * Best on-time schedule leaving at the nominal departure or earlier (never
 * before time 0), if any: the latest on-time departure, found by binary
 * search, then earlier slots while they lower the balance of road time and
 * waiting at the destination.
 */
function onTime(trip: Trip, at: (trip: Trip, departure: number) => Schedule): Schedule | undefined {
  const cost = (s: Schedule): number => roadTime(s) + EARLY_ARRIVAL_WEIGHT * (trip.target - s.arrival);
  let best = latestOnTime(trip, at);
  while (best && best.departure > 0) {
    const candidate = at(trip, Math.max(0, best.departure - ASSIGNMENT_SLOT));
    if (candidate.arrival > trip.target || cost(candidate) >= cost(best)) break;
    best = candidate;
  }
  return best;
}

/** Latest on-time departure between time 0 and the nominal one, to the second. */
function latestOnTime(trip: Trip, at: (trip: Trip, departure: number) => Schedule): Schedule | undefined {
  // ponytail: assumes leaving earlier never arrives later; a non-monotone forecast may miss a later on-time departure
  const nominal = at(trip, trip.departure);
  if (nominal.arrival <= trip.target) return nominal;
  let best = at(trip, 0);
  if (best.arrival > trip.target) return undefined;
  for (let [early, late] = [0, trip.departure]; late - early > 1;) {
    const middle = Math.floor((early + late) / 2);
    const candidate = at(trip, middle);
    if (candidate.arrival <= trip.target) [early, best] = [middle, candidate];
    else late = middle;
  }
  return best;
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
