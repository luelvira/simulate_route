export interface VehicleRecord { departure: number, arrival?: number, idealTime: number }

export interface Metrics {
  avgTravelTime: number,
  totalTravelTime: number,
  maxTravelTime: number,
  completed: number,
  total: number,
  maxCongestion: number,
  lostTime: number,
  equity: number,
}

/**
 * Aggregates the vehicles that reached their exit. Lost time is the extra
 * time over the free-flow route; equity is Jain's index (in %) over each
 * vehicle's efficiency idealTime / travelTime.
 */
export function computeMetrics(vehicles: VehicleRecord[], maxCongestionRatio: number): Metrics {
  const done = vehicles.filter(v => v.arrival !== undefined);
  const times = done.map(v => v.arrival! - v.departure);
  const efficiency = done.map((v, i) => v.idealTime / times[i]);
  const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);
  const total = sum(times);
  const squares = sum(efficiency.map(e => e * e));
  return {
    avgTravelTime: done.length ? total / done.length : 0,
    totalTravelTime: total,
    maxTravelTime: Math.max(0, ...times),
    completed: done.length,
    total: vehicles.length,
    maxCongestion: maxCongestionRatio * 100,
    lostTime: total - sum(done.map(v => v.idealTime)),
    equity: squares ? (sum(efficiency) ** 2 / (done.length * squares)) * 100 : 0,
  };
}
