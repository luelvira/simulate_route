import { aStar, Step } from '../topology/astar';
import { MAX_SPEED } from '../topology/roadMap';
import { Road, Scenario } from '../topology/types';
import { Trip } from './demand';
import { congestionRatio, toSeconds } from './traffic';

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
 * With a capacity, a road slot that would exceed it is impassable, and each
 * booking holds a road until the vehicle would leave it at the capacity speed.
 */
export class LoadForecast {
  private readonly booked = new Map<Road, Map<number, number>>();

  private readonly stretch: number;

  /**
   * `capacity`: highest share of the jam density a road may reach, counting
   * the planned vehicle; Infinity (no limit) or a share strictly between 0 and 1.
   */
  constructor(
    private readonly scenario: Scenario,
    private readonly speed: SpeedModel,
    private readonly capacity = Infinity,
  ) {
    if (capacity !== Infinity && !(capacity > 0 && capacity < 1)) {
      throw new RangeError(`Road capacity must be a share between 0 and 1, got ${capacity}`);
    }
    this.stretch = Number.isFinite(capacity) ? 1 / (1 - capacity) : 1;
  }

  /**
   * Fastest route of the trip leaving at `departure` (s) and its forecast
   * arrival (s); with no route within the capacity, the free-flow route and
   * an infinite arrival.
   */
  route(trip: Trip, departure: number): { steps: Step[], arrival: number } {
    const found = aStar(this.scenario, trip.entry, trip.exit, MAX_SPEED,
      (road, at) => this.cappedTime(road, departure + toSeconds(at)));
    if (!found) return { steps: aStar(this.scenario, trip.entry, trip.exit, MAX_SPEED)!.steps, arrival: Infinity };
    return { steps: found.steps, arrival: departure + toSeconds(found.time) };
  }

  /** Books one vehicle on every slot each road of the route is occupied. */
  book(steps: Step[], departure: number): Booking {
    const booking: Booking = [];
    let clock = departure;
    for (const { road } of steps) {
      const expected = toSeconds(this.roadTime(road, clock));
      const leave = clock + expected * this.stretch;
      for (let slot = slotOf(clock); slot <= slotOf(leave); slot++) booking.push([road, slot]);
      clock += expected;
    }
    booking.forEach(([road, slot]) => this.add(road, slot, 1));
    return booking;
  }

  /** Removes a vehicle booked earlier. */
  cancel(booking: Booking): void {
    booking.forEach(([road, slot]) => this.add(road, slot, -1));
  }

  /** Adds one vehicle to every slot a road is occupied between two times (s). */
  occupy(road: Road, enter: number, leave: number): void {
    for (let slot = slotOf(enter); slot <= slotOf(leave); slot++) this.add(road, slot, 1);
  }

  private cappedTime(road: Road, seconds: number): number {
    const vehicles = this.booked.get(road)?.get(slotOf(seconds)) ?? 0;
    return congestionRatio(vehicles + 1, road.cost) > this.capacity ? Infinity : this.roadTime(road, seconds);
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
