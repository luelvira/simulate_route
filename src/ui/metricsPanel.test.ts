import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Metrics } from '../simulation/metrics';
import { PLAN_KEYS, type PlanKey } from '../simulation/precomputePlans';

interface StubNode {
  children: StubNode[],
  textContent: string,
  attributes: Map<string, string>,
}

interface MetricCell extends StubNode {
  metric: string,
  algorithm: string,
}

const cell = (metric: string, algorithm: string): MetricCell => ({
  children: [],
  textContent: '',
  attributes: new Map([['data-metric', metric], ['data-algorithm', algorithm]]),
  metric,
  algorithm,
});

const METRICS: string[] = [
  'avg-travel-time',
  'total-travel-time',
  'max-travel-time',
  'completed-vehicles',
  'max-congestion',
  'lost-time',
  'equity',
  'on-time',
  'avg-lateness',
  'departure-shift',
];

/** Builds a minimal DOM stub that mirrors the comparison table structure. */
function createMetricsTableDocument(cells: MetricCell[]): Document {
  const find = (selector: string): StubNode | null => {
    const pairs = [...selector.matchAll(/\[([^=\]]+)="([^"]*)"\]/g)]
      .map(match => [match[1], match[2]] as const);
    const matches = (node: StubNode): boolean =>
      pairs.every(([name, value]) => node.attributes.get(name) === value);
    const stack: StubNode[] = [...cells];
    while (stack.length > 0) {
      const first = stack.shift()!;
      if (matches(first)) return first;
      stack.push(...first.children);
    }
    return null;
  };
  return { querySelector: find } as unknown as Document;
}

const metricsFixture = (values: Record<string, number>): Metrics => ({
  avgTravelTime: 0,
  totalTravelTime: 0,
  maxTravelTime: 0,
  completed: 0,
  total: 0,
  maxCongestion: 0,
  lostTime: 0,
  equity: 0,
  onTime: 0,
  avgLateness: 0,
  avgDepartureShift: 0,
  ...values,
});

describe('Feature: Metric comparison table', () => {

  describe('When a scenario run reports its metrics', () => {
    let cells: MetricCell[];

    beforeEach(() => {
      vi.resetModules();
      cells = METRICS.flatMap(name => PLAN_KEYS.map(key => cell(name, key)));
      vi.stubGlobal('document', createMetricsTableDocument(cells));
    });

    const writtenValues = (algorithm: PlanKey): string[] =>
      cells
        .filter(c => c.algorithm === algorithm)
        .map(c => c.textContent);

    for (const key of PLAN_KEYS) {
      it(`should fill every value of the ${key} column without touching the others`, async () => {
        const { showMetrics } = await import('./metricsPanel');

        showMetrics(key, metricsFixture({
          avgTravelTime: 12.6,
          totalTravelTime: 1400.2,
          maxTravelTime: 31.8,
          completed: 40,
          total: 50,
          maxCongestion: 87.4,
          lostTime: 220.5,
          equity: 93.2,
          onTime: 68.5,
          avgLateness: 7.4,
          avgDepartureShift: 3.6,
        }));

        expect(writtenValues(key)).toEqual([
          '13', '1400', '32', '40/50', '87', '221', '93', '69', '7', '4',
        ]);
        expect(PLAN_KEYS.filter(other => other !== key).flatMap(writtenValues))
          .toEqual(Array(30).fill(''));
      });
    }
  });
});
