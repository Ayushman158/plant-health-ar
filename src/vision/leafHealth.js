/**
 * Per-leaf health from the colour label mask.
 *
 * Shared by both region sources so they cannot drift apart: the connected
 * components that drive the live markers, and the SAM masks behind leaf
 * inspection. Both answer the same question — of the foliage pixels inside
 * this shape, how many are yellowing, browning or variegated — and both report
 * how many pixels that judgement rests on.
 */

import { FOLIAGE, CHLOROSIS, NECROSIS, VARIEGATION } from './leafDetector.js';

/** Matches the whole-frame threshold in LeafDetector so the two agree. */
export const CHLOROSIS_THRESHOLD = 0.16;
export const NECROSIS_THRESHOLD = 0.1;
export const VARIEGATION_THRESHOLD = 0.25;

/** Fewer sampled pixels than this and the proportions are not worth reporting. */
const MIN_SAMPLES = 12;

export const UNKNOWN = Object.freeze({
  status: 'unknown',
  label: 'Not analysed',
  samples: 0,
  chlorosisRate: 0,
  necrosisRate: 0,
  variegationRate: 0,
});

/**
 * @param stats  the colour label mask: {mask, width, height}
 * @param inShape predicate (nx, ny) => boolean, in normalised frame coordinates
 * @param bounds optional normalised {x, y, width, height} to limit the scan
 */
export function healthWithin(stats, inShape, bounds) {
  if (!stats?.mask) return { ...UNKNOWN };

  const { mask: labels, width: lw, height: lh } = stats;

  const b = bounds || { x: 0, y: 0, width: 1, height: 1 };
  const x0 = Math.max(0, Math.floor(b.x * lw));
  const y0 = Math.max(0, Math.floor(b.y * lh));
  const x1 = Math.min(lw - 1, Math.ceil((b.x + b.width) * lw));
  const y1 = Math.min(lh - 1, Math.ceil((b.y + b.height) * lh));

  let foliage = 0;
  let chlorosis = 0;
  let necrosis = 0;
  let variegation = 0;

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!inShape((x + 0.5) / lw, (y + 0.5) / lh)) continue;

      switch (labels[y * lw + x]) {
        case FOLIAGE: foliage++; break;
        case CHLOROSIS: chlorosis++; foliage++; break;
        case NECROSIS: necrosis++; break;
        case VARIEGATION: variegation++; foliage++; break;
        default: break;
      }
    }
  }

  return summarise({ foliage, chlorosis, necrosis, variegation });
}

export function summarise({ foliage, chlorosis, necrosis, variegation }) {
  const samples = foliage + necrosis;
  if (samples < MIN_SAMPLES) return { ...UNKNOWN };

  const chlorosisRate = chlorosis / samples;
  const necrosisRate = necrosis / samples;
  const variegationRate = variegation / samples;

  let status = 'healthy';
  let label = 'Healthy';

  if (necrosisRate >= NECROSIS_THRESHOLD) {
    status = 'concern';
    label = 'Possible edge browning';
  } else if (chlorosisRate >= CHLOROSIS_THRESHOLD) {
    status = 'watch';
    label = 'Possible yellowing';
  } else if (variegationRate >= VARIEGATION_THRESHOLD) {
    label = 'Healthy, variegated';
  }

  return {
    status,
    label,
    samples,
    chlorosisRate: Math.round(chlorosisRate * 100),
    necrosisRate: Math.round(necrosisRate * 100),
    variegationRate: Math.round(variegationRate * 100),
  };
}
