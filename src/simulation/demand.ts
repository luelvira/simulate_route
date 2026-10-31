import { createRandom } from '../topology/roadMap';
import { NodeId } from '../topology/types';

/** Seconds over which the arrival targets of the vehicles are spread. */
export const TARGET_WINDOW = 300;

/** A vehicle's journey: it should reach `exit` by `target`, leaving `entry` at its nominal `departure`. */
export interface Trip { id: number, entry: NodeId, exit: NodeId, departure: number, target: number }

/**
 * One trip per vehicle with a random entry, exit and arrival target. Targets
 * share a common time plus a random offset within TARGET_WINDOW; each vehicle
 * departs just in time to reach its target on an empty network, given the
 * free-flow time `idealTime` (s) of its trip.
 */
export function generateDemand(
  entries: NodeId[],
  exits: NodeId[],
  count: number,
  random: () => number,
  idealTime: (entry: NodeId, exit: NodeId) => number = () => 0,
): Trip[] {
  const pick = (items: NodeId[]): NodeId => items[Math.floor(random() * items.length)];
  const drawn = Array.from({ length: count }, (_, id) =>
    ({ id, entry: pick(entries), exit: pick(exits), offset: Math.round(random() * TARGET_WINDOW) }));
  const common = Math.ceil(Math.max(0, ...drawn.map(t => idealTime(t.entry, t.exit))));
  return drawn.map(({ offset, ...trip }) => {
    const target = common + offset;
    return { ...trip, target, departure: Math.floor(target - idealTime(trip.entry, trip.exit)) };
  }).sort((a, b) => a.departure - b.departure || a.id - b.id);
}

/** Random stream for the demand, independent from the one that builds the map. */
export const demandRandom = (seed: number): (() => number) => createRandom(seed ^ 0x5bd1e995);
