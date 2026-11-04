import { Metrics } from '../simulation/metrics';
import { PlanKey } from '../simulation/precomputePlans';

const METRIC_FORMATTERS: Record<string, (metrics: Metrics) => string> = {
  'avg-travel-time': metrics => metrics.avgTravelTime.toFixed(0),
  'total-travel-time': metrics => metrics.totalTravelTime.toFixed(0),
  'max-travel-time': metrics => metrics.maxTravelTime.toFixed(0),
  'completed-vehicles': metrics => `${metrics.completed}/${metrics.total}`,
  'max-congestion': metrics => metrics.maxCongestion.toFixed(0),
  'lost-time': metrics => metrics.lostTime.toFixed(0),
  'equity': metrics => metrics.equity.toFixed(0),
  'on-time': metrics => metrics.onTime.toFixed(0),
  'avg-lateness': metrics => metrics.avgLateness.toFixed(0),
  'departure-shift': metrics => metrics.avgDepartureShift.toFixed(0),
};

/**
 * Writes the aggregate metrics of one scenario run into the matching
 * column of the comparison table in the metrics panel.
 */
export function showMetrics(key: PlanKey, metrics: Metrics): void {
  for (const [name, format] of Object.entries(METRIC_FORMATTERS)) {
    const value = document
      .querySelector(`[data-metric="${name}"][data-algorithm="${key}"]`);
    value!.textContent = format(metrics);
  }
}
