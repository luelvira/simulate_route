import * as d3 from 'd3';
import { MAX_SPEED } from './roadMap';
import { Road, Scenario } from './types';

const TILE = 24; // px per tile

/** Draws the road map as a city plan: asphalt roads with rounded curves, lane markings, roundabouts and junctions. */
export function renderRoadMap(container: HTMLElement, scenario: Scenario): void {
  const at = (v: number): number => (v + 0.5) * TILE;
  const svg = d3.select(container).append('svg')
    .attr('viewBox', `0 0 ${scenario.cols * TILE} ${scenario.rows * TILE}`)
    .style('width', '100%')
    .style('background', '#dfe8d4');

  const streets = scenario.roads.filter(r => !r.oneWay);
  // curveBasis rounds every 90° turn while keeping straights straight.
  const line = d3.line<[number, number]>().x(p => at(p[1])).y(p => at(p[0])).curve(d3.curveBasis);
  const width = (r: Road): number => TILE * (0.35 + 0.35 * (r.speed ?? MAX_SPEED) / MAX_SPEED);
  const speedColor = d3.scaleSequential(d3.interpolateYlOrRd).domain([20, MAX_SPEED + 40]);

  const layer = (cls: string) => svg.append('g').attr('class', cls).selectAll('path').data(streets).join('path')
    .attr('d', r => line(r.path!)).attr('fill', 'none').attr('stroke-linecap', 'round');
  layer('kerb').attr('stroke', '#9aa08f').attr('stroke-width', r => width(r) + 4);
  layer('asphalt').attr('stroke', '#4a4e54').attr('stroke-width', width);
  layer('lanes').attr('stroke', r => speedColor(r.speed ?? MAX_SPEED)).attr('stroke-width', 1.5)
    .attr('stroke-dasharray', r => ((r.speed ?? MAX_SPEED) >= 80 ? null : '6 5'))
    .append('title').text(r => `${r.from} → ${r.to} · ${r.cost} tiles · ${r.speed} km/h`);

  // A roundabout is a 2x2 block of ring tiles; draw it centred on its top-left tile's corner.
  const ring = new Set(scenario.nodes.filter(n => n.kind === 'roundabout').map(n => n.id));
  const roundabouts = scenario.nodes.filter(n =>
    n.kind === 'roundabout' && ring.has(`r${n.row + 1}c${n.col}`) && ring.has(`r${n.row}c${n.col + 1}`));
  const rb = svg.append('g').attr('class', 'roundabouts').selectAll('g').data(roundabouts).join('g')
    .attr('transform', n => `translate(${(n.col + 1) * TILE},${(n.row + 1) * TILE})`);
  rb.append('circle').attr('r', TILE * 1.05).attr('fill', '#4a4e54').attr('stroke', '#9aa08f').attr('stroke-width', 2);
  rb.append('circle').attr('r', TILE * 0.45).attr('fill', '#8fbf6a').attr('stroke', '#fff').attr('stroke-width', 1.5);

  const entries = new Set(scenario.entries);
  const exits = new Set(scenario.exits);
  svg.append('g').attr('class', 'junctions').selectAll('circle')
    .data(scenario.nodes.filter(n => n.kind !== 'roundabout' && (n.kind !== 'dead-end' || entries.has(n.id) || exits.has(n.id))))
    .join('circle')
    .attr('cx', n => at(n.col)).attr('cy', n => at(n.row))
    .attr('r', n => (entries.has(n.id) || exits.has(n.id) ? TILE * 0.4 : TILE * 0.2))
    .attr('fill', n => (entries.has(n.id) ? '#2e7d32' : exits.has(n.id) ? '#c62828' : '#5c6168'))
    .append('title').text(n => `${n.id} · ${n.kind}`);
}
