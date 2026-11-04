import { demandRandom, generateDemand, Trip } from '../simulation/demand';
import { positionOf, Simulation } from '../simulation/engine';
import { fromPlanTable } from '../simulation/planTable';
import { PLAN_KEYS, PlanKey, PrecomputedPlans } from '../simulation/precomputePlans';
import { freeFlowSeconds, HESITATION_FACTOR } from '../simulation/routing';
import { renderCongestion, renderRoadMap, renderVehicles } from '../topology/render';
import { generateRoadMap } from '../topology/roadMap';
import { Scenario } from '../topology/types';
import { readConfig } from './configControls';
import { showMetrics } from './metricsPanel';

const STEP_SECONDS = 1;

interface Session { map: Scenario, trips: Trip[], plans: PrecomputedPlans, runs: Record<PlanKey, Simulation> }

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

function createRuns(map: Scenario, trips: Trip[], plans: PrecomputedPlans): Record<PlanKey, Simulation> {
  return {
    base: new Simulation(map, trips, fromPlanTable(plans.base, map, HESITATION_FACTOR)),
    astar: new Simulation(map, trips, fromPlanTable(plans.astar, map)),
    optimized: new Simulation(map, trips, fromPlanTable(plans.optimized, map)),
    central: new Simulation(map, trips, fromPlanTable(plans.central, map)),
  };
}

function formatClock(seconds: number): string {
  const total = Math.floor(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Wires the toolbar: Start builds the map and the demand, computes the
 * plan of every scenario from the planning server and then builds the four
 * scenario runs; every frame advances all of them by the same simulated time and
 * animates the one chosen in the scenario selector.
 */
export function initSimulation(form: HTMLFormElement): void {
  const app = byId<HTMLElement>('app');
  const pause = byId<HTMLButtonElement>('btn-pause');
  const speed = byId<HTMLSelectElement>('sim-speed');
  const animated = byId<HTMLSelectElement>('animated-scenario');
  const clock = byId<HTMLOutputElement>('sim-clock');
  let session: Session | undefined;
  let planning: AbortController | undefined;
  let paused = false;
  let pending = 0;
  let lastFrame: number | undefined;
  let frameId = 0;

  const draw = (): void => {
    if (!session) return;
    const run = session.runs[animated.value as PlanKey];
    renderCongestion(app, run.congestionHistory());
    renderVehicles(app, run.active().flatMap(v => {
      const position = positionOf(v);
      return position ? [[v.trip.id, position] as [number, [number, number]]] : [];
    }));
    (Object.keys(session.runs) as PlanKey[]).forEach(key => showMetrics(key, session!.runs[key].metrics()));
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
    planning?.abort();
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
    const controller = new AbortController();
    planning = controller;
    fetch('/api/plans', { method: 'POST', body: new FormData(form), signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        const plans = Object.fromEntries(PLAN_KEYS.map(key => [key, new Map(body[key])])) as PrecomputedPlans;
        begin({ map, trips, plans, runs: createRuns(map, trips, plans) });
      })
      .catch((error: Error) => {
        if (error.name !== 'AbortError') app.textContent = `No se pueden calcular las rutas: ${error.message}`;
      });
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
