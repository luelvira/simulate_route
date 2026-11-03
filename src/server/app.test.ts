import { describe, it, expect, vi } from 'vitest';
import { computePlan, PLAN_KEYS } from '../simulation/precomputePlans';
import { DEFAULT_CONFIG, SimulationConfig } from '../ui/configStorage';
import { createApp, planAll, PlanRunner } from './app';

const small: SimulationConfig = { ...DEFAULT_CONFIG, rows: 6, cols: 8, entryCount: 3, exitCount: 2, vehicles: 10 };

function formOf(config: SimulationConfig): FormData {
  const form = new FormData();
  for (const [field, value] of Object.entries(config)) form.set(field, String(value));
  return form;
}

const requestPlans = (runner: PlanRunner | undefined, config: SimulationConfig): Promise<Response> =>
  Promise.resolve(createApp(runner).request('/api/plans', { method: 'POST', body: formOf(config) }));

describe('Feature: Planning server', () => {

  describe('When the page asks for the plans of a valid scenario', () => {
    it('should return the plan of every trip for every scenario', async () => {
      // Act
      const response = await requestPlans(undefined, small);

      // Assert
      expect(response.status).toBe(200);
      const body = await response.json();
      for (const key of PLAN_KEYS) expect(new Map(body[key])).toEqual(computePlan(small, key));
    });
  });

  describe('When the configuration is outside the limits of the form', () => {
    it('should reject more vehicles than the form allows without planning', async () => {
      // Arrange
      const runner = vi.fn(planAll);

      // Act
      const response = await requestPlans(runner, { ...small, vehicles: 1001 });

      // Assert
      expect(response.status).toBe(400);
      expect((await response.json()).error).toMatch(/vehicles/);
      expect(runner).not.toHaveBeenCalled();
    });
  });

  describe('When no road map can be built from the configuration', () => {
    it('should report the scenario as unprocessable', async () => {
      // Act
      const response = await requestPlans(undefined, { ...small, rows: 1, cols: 2, entryCount: 59, exitCount: 59 });

      // Assert
      expect(response.status).toBe(422);
      expect((await response.json()).error).toBeTruthy();
    });
  });

  describe('When planning fails on the server', () => {
    it('should report a server error', async () => {
      // Arrange
      const failing: PlanRunner = () => { throw new Error('planner crashed'); };

      // Act
      const response = await requestPlans(failing, small);

      // Assert
      expect(response.status).toBe(500);
      expect((await response.json()).error).toBe('planner crashed');
    });
  });
});
