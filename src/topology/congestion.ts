/** Colour of the congestion overlay for a road. */
export interface CongestionStyle {
  color: string,
  opacity: number,
}

type Rgb = [number, number, number];

interface Stop { at: number, color: Rgb }

const STOPS: Stop[] = [
  { at: 0.2, color: [67, 160, 71] },
  { at: 0.65, color: [253, 216, 53] },
  { at: 0.85, color: [251, 140, 0] },
  { at: 1, color: [211, 47, 47] },
];

const clamp = (ratio: number): number => Math.min(1, Math.max(0, ratio));

const mix = (from: Rgb, to: Rgb, t: number): Rgb =>
  from.map((channel, i) => Math.round(channel + (to[i] - channel) * t)) as Rgb;

/**
 * Maps the share of a road's jam density in use to a traffic-light colour:
 * green when the first vehicles appear, yellow halfway, orange when it is
 * nearly full and red at a standstill; a road driven without sharing it
 * (ratio 0) is green too. Roads no vehicle has used (undefined) stay
 * transparent so the asphalt and its markings remain visible.
 */
export function congestionStyle(ratio: number | undefined): CongestionStyle {
  if (ratio === undefined) return { color: 'transparent', opacity: 0 };
  const value = clamp(ratio);
  const upper = Math.max(0, STOPS.findIndex(stop => stop.at >= value));
  const to = STOPS[upper];
  const from = STOPS[Math.max(0, upper - 1)];
  const t = to.at === from.at ? 0 : clamp((value - from.at) / (to.at - from.at));
  const [r, g, b] = mix(from.color, to.color, t);
  return {
    color: `rgb(${r}, ${g}, ${b})`,
    opacity: 0.45 + 0.5 * value,
  };
}
