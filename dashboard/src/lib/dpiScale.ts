// Non-linear slider scale for DPI. A linear track over e.g. 100..30000 leaves the
// common values a few pixels wide, so the track is split into three logarithmic
// segments and the everyday band 400..6400 gets 70 % of it (400..3200 alone gets
// about half). Ending the band at 6400 also keeps the preset ticks under the
// track far enough apart to label.

/** Slider positions run 0..RESOLUTION; values are snapped to the constraint grid. */
export const RESOLUTION = 1000;

const BAND_LOW = 400;
const BAND_HIGH = 6400;
/** Share of the track given to [min, BAND_LOW] and to [BAND_HIGH, max]. */
const EDGE_SHARE = 0.15;

/** Common DPI values offered as one-click presets when they fit the constraint. */
const PRESETS = [400, 800, 1200, 1600, 3200, 6400];

export interface DpiScale {
  min: number;
  /** Largest valid value: `max` itself when it lies on the step grid from `min`. */
  max: number;
  step: number;
  toValue: (position: number) => number;
  toPosition: (value: number) => number;
  snap: (value: number) => number;
  presets: number[];
}

type Point = [position: number, value: number];

function interpolate(a: Point, b: Point, f: number): number {
  // Logarithmic within a segment; linear if the segment touches zero.
  return a[1] > 0 ? a[1] * (b[1] / a[1]) ** f : a[1] + (b[1] - a[1]) * f;
}

function fraction(a: Point, b: Point, v: number): number {
  return a[1] > 0 ? Math.log(v / a[1]) / Math.log(b[1] / a[1]) : (v - a[1]) / (b[1] - a[1]);
}

export function dpiScale(min: number, max: number, step: number): DpiScale {
  const unit = step > 0 ? step : 1;
  const top = min + Math.floor((max - min) / unit) * unit;
  const snap = (v: number) => Math.min(top, Math.max(min, min + Math.round((v - min) / unit) * unit));

  const points: Point[] = [[0, min]];
  if (BAND_LOW > min && BAND_LOW < top) points.push([EDGE_SHARE, BAND_LOW]);
  if (BAND_HIGH < top && BAND_HIGH > min) points.push([1 - EDGE_SHARE, BAND_HIGH]);
  points.push([1, top]);

  const segment = (pick: (p: Point) => number, x: number): [Point, Point] => {
    for (let i = 1; i < points.length; i++) {
      const b = points[i] as Point;
      if (x <= pick(b) || i === points.length - 1) return [points[i - 1] as Point, b];
    }
    return [points[0] as Point, points[1] as Point];
  };

  const toValue = (position: number) => {
    const p = Math.min(1, Math.max(0, position / RESOLUTION));
    if (p <= 0) return min;
    if (p >= 1) return top;
    const [a, b] = segment((pt) => pt[0], p);
    return snap(interpolate(a, b, (p - a[0]) / (b[0] - a[0])));
  };

  const toPosition = (value: number) => {
    const v = Math.min(top, Math.max(min, value));
    if (top === min) return 0;
    const [a, b] = segment((pt) => pt[1], v);
    return Math.round((a[0] + (b[0] - a[0]) * fraction(a, b, v)) * RESOLUTION);
  };

  const presets = PRESETS.filter((v) => v >= min && v <= top && (v - min) % unit === 0);
  return { min, max: top, step: unit, toValue, toPosition, snap, presets };
}
