/** Vehicles per tile at which a road is considered fully jammed. */
export const JAM_DENSITY = 2;
/** Fraction of the speed limit kept on a jammed road, so traffic never stops. */
export const MIN_SPEED_FACTOR = 0.1;
/** Shorter roads (roundabout arms, exit ramps) count as this many tiles to compute their density. */
export const MIN_DENSITY_LENGTH = 4;
/** Real length of one map tile. */
export const TILE_METERS = 50;

/** Traffic density (vehicles / road length) normalised to [0, 1]. */
export const congestionRatio = (vehicles: number, length: number): number =>
  Math.min(1, vehicles / Math.max(length, MIN_DENSITY_LENGTH) / JAM_DENSITY);

/** Greenshields-like speed: the denser the road, the slower its vehicles. */
export const congestedSpeed = (limit: number, vehicles: number, length: number): number =>
  limit * Math.max(MIN_SPEED_FACTOR, 1 - congestionRatio(vehicles, length));

/** Converts a speed in km/h into tiles per second. */
export const tilesPerSecond = (kmh: number): number => kmh / 3.6 / TILE_METERS;

/** Converts an A* time (tiles / km/h) into seconds. */
export const toSeconds = (tilesPerKmh: number): number => tilesPerKmh * 3.6 * TILE_METERS;
