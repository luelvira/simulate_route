import { Step } from '../topology/astar';
import { MAX_SPEED } from '../topology/roadMap';
import { Road, Scenario } from '../topology/types';
import { Trip } from './demand';
import { computeMetrics, Metrics } from './metrics';
import { freeFlowSeconds, Planner } from './routing';
import { congestedSpeed, congestionRatio, tilesPerSecond } from './traffic';

export interface Vehicle {
  trip: Trip,
  departure: number,
  idealTime: number,
  route: Step[],
  progress: number, // tiles travelled on route[0]
  arrival?: number,
}

/**
 * Time-stepped traffic simulation of one routing strategy. On every step a
 * vehicle drives at the speed its road allows given the other vehicles on it.
 */
export class Simulation {
  time = 0;
  maxCongestion = 0;
  readonly vehicles: Vehicle[];
  private readonly load = new Map<Road, number>();
  private next = 0; // index of the next vehicle waiting to depart

  constructor(scenario: Scenario, trips: Trip[], private readonly planner: Planner) {
    const idealTime = freeFlowSeconds(scenario);
    this.vehicles = [...trips].sort((a, b) => a.departure - b.departure)
      .map(trip => ({ trip, departure: trip.departure, idealTime: idealTime(trip.entry, trip.exit), route: [], progress: 0 }));
  }

  get done(): boolean {
    return this.vehicles.every(v => v.arrival !== undefined);
  }

  /** Vehicles currently driving on the map. */
  active(): Vehicle[] {
    return this.vehicles.slice(0, this.next).filter(v => v.arrival === undefined);
  }

  step(dt: number): void {
    for (; this.next < this.vehicles.length && this.vehicles[this.next].departure <= this.time; this.next++) {
      const vehicle = this.vehicles[this.next];
      vehicle.route = this.planner.plan(vehicle.trip);
      this.enter(vehicle.route[0].road);
    }

    const moving = this.active();
    const speed = new Map(moving.map(({ route: [{ road }] }) =>
      [road, congestedSpeed(road.speed ?? MAX_SPEED, this.others(road), road.cost)]));
    for (const road of speed.keys()) {
      this.maxCongestion = Math.max(this.maxCongestion, congestionRatio(this.others(road), road.cost));
    }

    for (const vehicle of moving) {
      const elapsed = tilesPerSecond(speed.get(vehicle.route[0].road)!) * (this.planner.speedFactor ?? 1) * dt;
      vehicle.progress += elapsed;
      while (vehicle.arrival === undefined && vehicle.progress >= vehicle.route[0].road.cost) {
        const [current, ...remaining] = vehicle.route;
        vehicle.progress -= current.road.cost;
        this.leave(current.road);
        if (remaining.length === 0) {
          vehicle.arrival = this.time + dt * (1 - vehicle.progress / elapsed);
          vehicle.route = [];
          break;
        }
        vehicle.route = remaining;
        this.enter(vehicle.route[0].road);
      }
    }
    this.time += dt;
  }

  metrics(): Metrics {
    return computeMetrics(this.vehicles, this.maxCongestion);
  }

  /** Vehicles sharing the road with any given vehicle on it. */
  private others(road: Road): number {
    return Math.max(0, (this.load.get(road) ?? 0) - 1);
  }

  private enter(road: Road): void {
    this.load.set(road, (this.load.get(road) ?? 0) + 1);
  }

  private leave(road: Road): void {
    this.load.set(road, this.load.get(road)! - 1);
  }
}

/** Tile coordinates of a driving vehicle, interpolated along its current road. */
export function positionOf(vehicle: Vehicle): [number, number] | undefined {
  const step = vehicle.route[0];
  if (!step) return undefined;
  const path = step.from === step.road.from ? step.road.path! : [...step.road.path!].reverse();
  const at = Math.min(vehicle.progress, path.length - 1);
  const i = Math.min(Math.floor(at), path.length - 2);
  const t = at - i;
  return [path[i][0] + (path[i + 1][0] - path[i][0]) * t, path[i][1] + (path[i + 1][1] - path[i][1]) * t];
}
