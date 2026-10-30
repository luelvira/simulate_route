import { createRandom } from '../topology/roadMap';
import { NodeId } from '../topology/types';

/** Seconds during which vehicles keep entering the map. */
export const DEPARTURE_WINDOW = 300;

export interface Trip { id: number, entry: NodeId, exit: NodeId, departure: number }

/** One trip per vehicle with a random entry, exit and departure time. */
export function generateDemand(entries: NodeId[], exits: NodeId[], count: number, random: () => number): Trip[] {
  const pick = (items: NodeId[]): NodeId => items[Math.floor(random() * items.length)];
  return Array.from({ length: count }, (_, id) => ({
    id,
    entry: pick(entries),
    exit: pick(exits),
    departure: Math.round(random() * DEPARTURE_WINDOW),
  })).sort((a, b) => a.departure - b.departure || a.id - b.id);
}

/** Random stream for the demand, independent from the one that builds the map. */
export const demandRandom = (seed: number): (() => number) => createRandom(seed ^ 0x5bd1e995);
