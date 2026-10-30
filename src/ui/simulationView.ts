import { demandRandom, generateDemand, Trip } from '../simulation/demand';
import { positionOf, Simulation } from '../simulation/engine';
import { Metrics } from '../simulation/metrics';
import { balancedPlanner, freeFlowPlanner, unguidedPlanner } from '../simulation/routing';
import { renderRoadMap, renderVehicles } from '../topology/render';
import { generateRoadMap } from '../topology/roadMap';
import { Scenario } from '../topology/types';
import { readConfig } from './configControls';

type ScenarioKey = 'base' | 'astar' | 'optimized';

const STEP_SECONDS = 1;

interface Session { map: Scenario, trips: Trip[], runs: Record<ScenarioKey, Simulation> }

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

function createRuns(map: Scenario, trips: Trip[]): Record<ScenarioKey, Simulation> {
  return {
    base: new Simulation(map, trips, unguidedPlanner(map)),
    astar: new Simulation(map, trips, freeFlowPlanner(map)),
    optimized: new Simulation(map, trips, balancedPlanner(map, trips)),
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
  };
  for (const [name, value] of Object.entries(values)) {
    group.querySelector(`[data-metric="${name}"]`)!.textContent = value;
  }
}

/**
 * Wires the toolbar: Start builds the map, the demand and the three scenario
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
  let paused = false;
  let pending = 0;
  let lastFrame: number | undefined;

  const draw = (): void => {
    if (!session) return;
    const run = session.runs[animated.value as ScenarioKey];
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
    if (runs.some(r => !r.done)) requestAnimationFrame(frame);
  };

  const begin = (next: Session): void => {
    const running = session !== undefined && Object.values(session.runs).some(r => !r.done);
    session = next;
    paused = false;
    pause.textContent = 'Pausar';
    pending = 0;
    lastFrame = undefined;
    draw();
    if (!running) requestAnimationFrame(frame);
  };

  form.addEventListener('submit', (event: SubmitEvent) => {
    event.preventDefault();
    const config = readConfig(form);
    let map: Scenario;
    try {
      map = generateRoadMap(config);
    } catch (error) {
      session = undefined;
      app.textContent = `No se puede generar el escenario: ${(error as Error).message}`;
      return;
    }
    const trips = generateDemand(map.entries, map.exits, config.vehicles, demandRandom(config.seed));
    renderRoadMap(app, map);
    begin({ map, trips, runs: createRuns(map, trips) });
  });

  byId('btn-restart').addEventListener('click', () => {
    if (!session) return;
    renderRoadMap(app, session.map);
    begin({ ...session, runs: createRuns(session.map, session.trips) });
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
