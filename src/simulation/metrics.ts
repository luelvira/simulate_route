export interface VehicleRecord {
  departure: number,
  arrival?: number,
  idealTime: number,
  trip: { departure: number, target: number },
}

export interface Metrics {
  avgTravelTime: number,
  totalTravelTime: number,
  maxTravelTime: number,
  completed: number,
  total: number,
  maxCongestion: number,
  lostTime: number,
  equity: number,
  onTime: number,
  avgLateness: number,
  avgDepartureShift: number,
}

/**
 * Aggregates the vehicles that reached their exit. Lost time is the extra
 * time over the free-flow route; equity is Jain's index (in %) over each
 * vehicle's efficiency idealTime / travelTime. On time means arriving no
 * later than the trip target; vehicles still driving are not on time.
 * Departure shift is how far the actual departure moved from the nominal one.
 */
export function computeMetrics(vehicles: VehicleRecord[], maxCongestionRatio: number): Metrics {
  const done = vehicles.filter(v => v.arrival !== undefined);
  const times = done.map(v => v.arrival! - v.departure);
  const efficiency = done.map((v, i) => v.idealTime / times[i]);
  const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);
  const total = sum(times);
  const squares = sum(efficiency.map(e => e * e));
  const lateness = done.map(v => v.arrival! - v.trip.target).filter(late => late > 0);
  const mean = (values: number[]): number => (values.length ? sum(values) / values.length : 0);
  return {
    avgTravelTime: mean(times),
    totalTravelTime: total,
    maxTravelTime: Math.max(0, ...times),
    completed: done.length,
    total: vehicles.length,
    maxCongestion: maxCongestionRatio * 100,
    lostTime: Math.max(0, total - sum(done.map(v => v.idealTime))),
    equity: squares ? (sum(efficiency) ** 2 / (done.length * squares)) * 100 : 0,
    onTime: vehicles.length ? ((done.length - lateness.length) / vehicles.length) * 100 : 0,
    avgLateness: mean(lateness),
    avgDepartureShift: mean(vehicles.map(v => Math.abs(v.departure - v.trip.departure))),
  };
}
