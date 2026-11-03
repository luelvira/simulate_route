import { Step } from '../topology/astar';
import { Road, Scenario } from '../topology/types';
import { CAPACITY_RATIO, DELAY_STEP_SLOTS, EARLY_ARRIVAL_WEIGHT, MAX_DELAY } from './centralPlanner';
import { Trip } from './demand';
import { Simulation } from './engine';
import { ASSIGNMENT_SLOT, LoadForecast } from './loadForecast';
import { Planner } from './routing';
import { congestionRatio, queuedSpeed } from './traffic';

/** Share of the jam density at which a simulated road flags the vehicles on it for re-planning. */
export const HOT_RATIO = 0.9;
/** Most simulate-and-re-plan rounds of the repair. */
export const REPAIR_ROUNDS = 4;
/** Weight of each second late against a second on the road when a flagged vehicle is re-planned. */
export const LATE_WEIGHT = 10;

/** One road a simulated vehicle drove on, with the times (s) it entered and left it. */
export interface Visit { road: Road, enter: number, leave: number }

/** Trajectory of every vehicle and the vehicles flagged for re-planning, keyed by trip id. */
export interface Replay { visits: Map<number, Visit[]>, offenders: Set<number> }

/** Departure (s) and route of one trip. */
export interface Schedule { departure: number, steps: Step[] }

/**
 * Simulates a plan with a 1 s step, recording the roads each vehicle drove
 * on and flagging every vehicle that shared a road at HOT_RATIO or more of
 * its jam density.
 */
export function replay(scenario: Scenario, trips: Trip[], planner: Planner): Replay {
  const simulation = new Simulation(scenario, trips, planner);
  const visits = new Map<number, Visit[]>();
  const open = new Map<number, { road: Road, enter: number }>();
  const offenders = new Set<number>();
  while (!simulation.done) {
    simulation.step(1);
    for (const vehicle of simulation.vehicles) {
      const id = vehicle.trip.id;
      const road = vehicle.route[0]?.road;
      const current = open.get(id);
      if (current && current.road !== road) {
        visits.set(id, [...(visits.get(id) ?? []), { ...current, leave: simulation.time }]);
        open.delete(id);
      }
      if (road && !open.has(id)) open.set(id, { road, enter: simulation.time });
      if (road && congestionRatio(simulation.others(road), road.cost) >= HOT_RATIO) offenders.add(id);
    }
  }
  return { visits, offenders };
}

/**
 * Cheapest feasible departure within MAX_DELAY of the nominal one (never
 * before time 0), balancing road time, waiting at the destination and
 * lateness; undefined when no departure respects the capacity.
 */
function reschedule(trip: Trip, forecast: LoadForecast): Schedule | undefined {
  let best: (Schedule & { cost: number }) | undefined;
  const last = trip.departure + MAX_DELAY;
  for (let departure = Math.max(0, trip.departure - MAX_DELAY); departure <= last; departure += DELAY_STEP_SLOTS * ASSIGNMENT_SLOT) {
    const { steps, arrival } = forecast.route(trip, departure);
    if (!Number.isFinite(arrival)) continue;
    const cost = arrival - departure
      + EARLY_ARRIVAL_WEIGHT * Math.max(0, trip.target - arrival)
      + LATE_WEIGHT * Math.max(0, arrival - trip.target);
    if (!best || cost < best.cost) best = { departure, steps, cost };
  }
  return best;
}

/**
 * Re-plans the flagged vehicles in target order on `forecast`, booking each
 * new schedule so the next ones see it, and updates `schedules` in place. A
 * vehicle with no departure within the capacity keeps and books its schedule.
 */
export function replanFlagged(forecast: LoadForecast, flagged: Trip[], schedules: Map<number, Schedule>): void {
  for (const trip of [...flagged].sort((a, b) => a.target - b.target || a.id - b.id)) {
    const schedule = reschedule(trip, forecast) ?? schedules.get(trip.id)!;
    forecast.book(schedule.steps, schedule.departure);
    schedules.set(trip.id, schedule);
  }
}

/**
 * Central plan repair: the plan is simulated, the vehicles that drove on a
 * road at HOT_RATIO or more of its jam density are re-planned on a forecast
 * built from the simulated trajectories of all the others, and the plan is
 * simulated again, at most REPAIR_ROUNDS times or until no vehicle is flagged.
 */
export function repairPlan(scenario: Scenario, trips: Trip[], planner: Planner): Planner {
  const schedules = new Map(trips.map(trip =>
    [trip.id, { departure: planner.departure?.(trip) ?? trip.departure, steps: planner.plan(trip) }]));
  const repaired: Planner = {
    plan: trip => schedules.get(trip.id)!.steps,
    departure: trip => schedules.get(trip.id)!.departure,
  };
  for (let round = 0; round < REPAIR_ROUNDS; round++) {
    const { visits, offenders } = replay(scenario, trips, repaired);
    if (offenders.size === 0) break;
    const forecast = new LoadForecast(scenario, queuedSpeed, CAPACITY_RATIO);
    for (const [id, trajectory] of visits) {
      if (!offenders.has(id)) trajectory.forEach(({ road, enter, leave }) => forecast.occupy(road, enter, leave));
    }
    replanFlagged(forecast, trips.filter(trip => offenders.has(trip.id)), schedules);
  }
  return repaired;
}
