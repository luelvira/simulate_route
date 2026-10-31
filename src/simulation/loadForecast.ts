import { aStar, Step } from '../topology/astar';
import { MAX_SPEED } from '../topology/roadMap';
import { Road, Scenario } from '../topology/types';
import { Trip } from './demand';
import { toSeconds } from './traffic';

/** Width (s) of the time slots used to forecast how many vehicles share a road. */
export const ASSIGNMENT_SLOT = 30;

type SpeedModel = (limit: number, vehicles: number, length: number) => number;

/** Road time slots one booked vehicle occupies. */
export type Booking = [Road, number][];

const slotOf = (seconds: number): number => Math.floor(seconds / ASSIGNMENT_SLOT);

/**
 * Forecast of how many planned vehicles occupy each road in each time slot.
 * Routes are searched with time-dependent A* on the current bookings, so a
 * road looks slower at the times other planned vehicles drive on it.
 */
export class LoadForecast {
  private readonly booked = new Map<Road, Map<number, number>>();

  constructor(private readonly scenario: Scenario, private readonly speed: SpeedModel) {}

  /** Fastest route of the trip leaving at `departure` (s) and its forecast arrival (s). */
  route(trip: Trip, departure: number): { steps: Step[], arrival: number } {
    const { steps, time } = aStar(this.scenario, trip.entry, trip.exit, MAX_SPEED,
      (road, at) => this.roadTime(road, departure + toSeconds(at)))!;
    return { steps, arrival: departure + toSeconds(time) };
  }

  /** Books one vehicle on every slot each road of the route is occupied. */
  book(steps: Step[], departure: number): Booking {
    const booking: Booking = [];
    let clock = departure;
    for (const { road } of steps) {
      const leave = clock + toSeconds(this.roadTime(road, clock));
      for (let slot = slotOf(clock); slot <= slotOf(leave); slot++) booking.push([road, slot]);
      clock = leave;
    }
    booking.forEach(([road, slot]) => this.add(road, slot, 1));
    return booking;
  }

  /** Removes a vehicle booked earlier. */
  cancel(booking: Booking): void {
    booking.forEach(([road, slot]) => this.add(road, slot, -1));
  }

  private add(road: Road, slot: number, vehicles: number): void {
    const slots = this.booked.get(road) ?? new Map<number, number>();
    slots.set(slot, (slots.get(slot) ?? 0) + vehicles);
    this.booked.set(road, slots);
  }

  private roadTime(road: Road, seconds: number): number {
    const vehicles = this.booked.get(road)?.get(slotOf(seconds)) ?? 0;
    return road.cost / this.speed(Math.min(road.speed ?? MAX_SPEED, MAX_SPEED), vehicles, road.cost);
  }
}
