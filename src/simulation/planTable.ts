import { Step } from '../topology/astar';
import { NodeId, Scenario } from '../topology/types';
import { Trip } from './demand';
import { Planner } from './routing';

/** Departure and route of one trip as plain data: [road id, node it is entered from] per road. */
export interface PlannedTrip { departure: number, steps: [string, NodeId][] }

/** Plain-data plan of every trip by trip id, so it can travel from the planning server to the page. */
export type PlanTable = Map<number, PlannedTrip>;

/** Captures the departure and route a planner gives every trip. */
export function toPlanTable(planner: Planner, trips: Trip[]): PlanTable {
  return new Map(trips.map(trip => [trip.id, {
    departure: planner.departure?.(trip) ?? trip.departure,
    steps: planner.plan(trip).map(({ road, from }) => [road.id, from] as [string, NodeId]),
  }]));
}

/** Planner that replays a plan table on the roads of `scenario`, its drivers at `speedFactor` of the allowed speed. */
export function fromPlanTable(table: PlanTable, scenario: Scenario, speedFactor?: number): Planner {
  const roads = new Map(scenario.roads.map(road => [road.id, road]));
  const steps = (trip: Trip): Step[] => table.get(trip.id)!.steps.map(([id, from]) => {
    const road = roads.get(id)!;
    return { road, from, to: road.from === from ? road.to : road.from };
  });
  return { speedFactor, plan: steps, departure: trip => table.get(trip.id)!.departure };
}
