import { demandRandom, generateDemand, Trip } from '../simulation/demand';
import { positionOf, Simulation } from '../simulation/engine';
import { Metrics } from '../simulation/metrics';
import { fromPlanTable } from '../simulation/planTable';
import type { PrecomputedPlans } from '../simulation/precomputePlans';
import { freeFlowPlanner, freeFlowSeconds, unguidedPlanner } from '../simulation/routing';
import { renderCongestion, renderRoadMap, renderVehicles } from '../topology/render';
import { generateRoadMap } from '../topology/roadMap';
import { Scenario } from '../topology/types';
import { readConfig } from './configControls';

type ScenarioKey = 'base' | 'astar' | 'optimized' | 'central';

const STEP_SECONDS = 1;

interface Session { map: Scenario, trips: Trip[], plans: Pick<PrecomputedPlans, 'optimized' | 'central'>, runs: Record<ScenarioKey, Simulation> }

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

function createRuns(map: Scenario, trips: Trip[], plans: Pick<PrecomputedPlans, 'optimized' | 'central'>): Record<ScenarioKey, Simulation> {
  return {
    base: new Simulation(map, trips, unguidedPlanner(map)),
    astar: new Simulation(map, trips, freeFlowPlanner(map)),
    optimized: new Simulation(map, trips, fromPlanTable(plans.optimized, map)),
    central: new Simulation(map, trips, fromPlanTable(plans.central, map)),
  };
}

function formatClock(seconds: number): string {
  const total = Math.floor(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function showMetrics(key: ScenarioKey, metrics: Metrics): void {
  const group = document.querySelector(`.metric-group[data-algorithm="${key}"]`)!;
  const values: Record<string, string> = {
    'avg-travel-time': metrics.avgTravelTime.toFixed(0),
    'total-travel-time': metrics.totalTravelTime.toFixed(0),
    'max-travel-time': metrics.maxTravelTime.toFixed(0),
    'completed-vehicles': `${metrics.completed}/${metrics.total}`,
    'max-congestion': metrics.maxCongestion.toFixed(0),
    'lost-time': metrics.lostTime.toFixed(0),
    'equity': metrics.equity.toFixed(0),
    'on-time': metrics.onTime.toFixed(0),
    'avg-lateness': metrics.avgLateness.toFixed(0),
    'departure-shift': metrics.avgDepartureShift.toFixed(0),
  };
  for (const [name, value] of Object.entries(values)) {
    group.querySelector(`[data-metric="${name}"]`)!.textContent = value;
  }
}

/**
 * Wires the toolbar: Start builds the map and the demand, computes the
 * optimised and central plans in a worker and then builds the four scenario
 * runs; every frame advances all of them by the same simulated time and
 * animates the one chosen in the scenario selector.
 */
export function initSimulation(form: HTMLFormElement): void {
  const app = byId<HTMLElement>('app');
  const pause = byId<HTMLButtonElement>('btn-pause');
  const speed = byId<HTMLSelectElement>('sim-speed');
  const animated = byId<HTMLSelectElement>('animated-scenario');
  const clock = byId<HTMLOutputElement>('sim-clock');
  let session: Session | undefined;
  let planning: Worker | undefined;
  let paused = false;
  let pending = 0;
  let lastFrame: number | undefined;
  let frameId = 0;

  const draw = (): void => {
    if (!session) return;
    const run = session.runs[animated.value as ScenarioKey];
    renderCongestion(app, run.congestionHistory());
    renderVehicles(app, run.active().flatMap(v => {
      const position = positionOf(v);
      return position ? [[v.trip.id, position] as [number, [number, number]]] : [];
    }));
    (Object.keys(session.runs) as ScenarioKey[]).forEach(key => showMetrics(key, session!.runs[key].metrics()));
    clock.value = formatClock(run.time);
  };

  const frame = (now: number): void => {
    if (!session) return;
    const runs = Object.values(session.runs);
    if (!paused && lastFrame !== undefined) pending += (now - lastFrame) / 1000 * Number(speed.value);
    lastFrame = now;
    for (; pending >= STEP_SECONDS && runs.some(r => !r.done); pending -= STEP_SECONDS) {
      runs.forEach(r => { if (!r.done) r.step(STEP_SECONDS); });
    }
    draw();
    if (runs.some(r => !r.done)) frameId = requestAnimationFrame(frame);
  };

  const begin = (next: Session): void => {
    cancelAnimationFrame(frameId);
    session = next;
    paused = false;
    pause.textContent = 'Pausar';
    pending = 0;
    lastFrame = undefined;
    draw();
    frameId = requestAnimationFrame(frame);
  };

  form.addEventListener('submit', (event: SubmitEvent) => {
    event.preventDefault();
    const config = readConfig(form);
    planning?.terminate();
    session = undefined;
    let map: Scenario;
    try {
      map = generateRoadMap(config);
    } catch (error) {
      app.textContent = `No se puede generar el escenario: ${(error as Error).message}`;
      return;
    }
    const trips = generateDemand(map.entries, map.exits, config.vehicles, demandRandom(config.seed), freeFlowSeconds(map));
    renderRoadMap(app, map);
    clock.value = 'Calculando...';
    const worker = new Worker(new URL('../simulation/plans.worker.ts', import.meta.url), { type: 'module' });
    planning = worker;
    worker.onmessage = ({ data: plans }: MessageEvent<PrecomputedPlans>) => {
      worker.terminate();
      begin({ map, trips, plans, runs: createRuns(map, trips, plans) });
    };
    worker.onerror = (event: ErrorEvent) => {
      worker.terminate();
      app.textContent = `No se pueden calcular las rutas: ${event.message}`;
    };
    worker.postMessage(config);
  });

  byId('btn-restart').addEventListener('click', () => {
    if (!session) return;
    renderRoadMap(app, session.map);
    begin({ ...session, runs: createRuns(session.map, session.trips, session.plans) });
  });

  pause.addEventListener('click', () => {
    if (!session) return;
    paused = !paused;
    pause.textContent = paused ? 'Reanudar' : 'Pausar';
  });

  animated.addEventListener('change', () => {
    if (!session) return;
    renderRoadMap(app, session.map);
    draw();
  });
}
