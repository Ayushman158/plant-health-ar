/**
 * LeafAnchors — stable, tracked leaf regions.
 *
 * Connected components on the plant mask give us candidate leaf regions for the
 * *current* frame. On their own those are unusable as UI: component ordering
 * changes frame to frame, so "Leaf 01" would jump between leaves and a tapped
 * detail card would describe something else a moment later.
 *
 * So each anchor gets an identity that persists: between segmentation runs it
 * is carried by optical flow, and when new regions arrive they are matched to
 * existing anchors by proximity before any new identity is minted. An anchor
 * that is neither matched nor trackable decays and is retired.
 */

import { labelComponents } from './maskAnalysis.js';
import { FOLIAGE, CHLOROSIS, NECROSIS, VARIEGATION } from './leafDetector.js';

/** Regions smaller than this share of the plant mask are noise, not leaves. */
const MIN_REGION_SHARE = 0.018;
/** Cap on simultaneous markers — the brief calls for a few meaningful ones. */
const MAX_ANCHORS = 4;
/** Normalised distance within which a new region re-uses an existing identity. */
const MATCH_RADIUS = 0.14;
/** Frames an unmatched anchor survives on flow alone before being retired. */
const MAX_MISSES = 18;
/** Consecutive confirmations before an anchor is shown, to avoid flicker. */
const CONFIRM_FRAMES = 3;
/**
 * Yellowing share at which a region is flagged. Kept equal to the whole-frame
 * threshold in LeafDetector (16%) so a marker cannot read "Healthy" while the
 * result card reads "Possible yellowing" for the same foliage.
 */
const CHLOROSIS_THRESHOLD = 0.16;

export class LeafAnchors {
  constructor(flowTracker) {
    this.flow = flowTracker;
    this.anchors = [];
    this.nextOrdinal = 1;
  }

  /**
   * Carry every anchor forward on image motion. Called every frame, including
   * the many frames where no new segmentation result is available.
   */
  advance() {
    if (this.anchors.length === 0) return;

    const tracked = this.flow.track(this.anchors.map((a) => ({ x: a.x, y: a.y })));

    for (let i = 0; i < this.anchors.length; i++) {
      const anchor = this.anchors[i];
      const result = tracked[i];

      if (result.ok) {
        anchor.x = result.x;
        anchor.y = result.y;
        anchor.tracked = true;
      } else {
        // Flow lost it (textureless patch, motion blur, left frame). Hold the
        // last position but stop claiming it is tracked.
        anchor.tracked = false;
        anchor.misses++;
      }
    }

    this.anchors = this.anchors.filter((a) => a.misses < MAX_MISSES);
  }

  /**
   * Reconcile anchors against a fresh segmentation result.
   * @param mask binary plant mask
   * @param stats per-pixel colour labels from LeafDetector, for real per-leaf metrics
   */
  reconcile(mask, w, h, stats) {
    const totalPlant = countSet(mask);
    if (totalPlant === 0) {
      this.anchors = [];
      return;
    }

    const minArea = Math.max(20, Math.round(totalPlant * MIN_REGION_SHARE));
    const { components } = labelComponents(mask, w, h, minArea);
    const regions = components.slice(0, MAX_ANCHORS);

    const claimed = new Set();

    for (const region of regions) {
      const health = sampleRegionHealth(region, stats);
      const existing = this.findNearest(region.centroid, claimed);

      if (existing) {
        claimed.add(existing.id);
        // Ease toward the segmented centroid rather than snapping, so a marker
        // settles instead of twitching each time segmentation lands.
        existing.x += (region.centroid.x - existing.x) * 0.4;
        existing.y += (region.centroid.y - existing.y) * 0.4;
        existing.area = region.area;
        existing.bbox = region.bbox;
        existing.markerScale = markerScaleFor(region.area, totalPlant);
        existing.health = health;
        existing.misses = 0;
        existing.confirmations = Math.min(CONFIRM_FRAMES, existing.confirmations + 1);
      } else if (this.anchors.length < MAX_ANCHORS) {
        const anchor = {
          id: `leaf-${this.nextOrdinal}`,
          ordinal: this.nextOrdinal,
          x: region.centroid.x,
          y: region.centroid.y,
          area: region.area,
          bbox: region.bbox,
          markerScale: markerScaleFor(region.area, totalPlant),
          health,
          misses: 0,
          confirmations: 1,
          tracked: false,
        };
        this.nextOrdinal++;
        this.anchors.push(anchor);
        claimed.add(anchor.id);
      }
    }

    for (const anchor of this.anchors) {
      if (!claimed.has(anchor.id)) anchor.misses++;
    }

    this.anchors = this.anchors.filter((a) => a.misses < MAX_MISSES);
    this.anchors.sort((a, b) => a.ordinal - b.ordinal);
  }

  findNearest(centroid, claimed) {
    let best = null;
    let bestDist = MATCH_RADIUS;

    for (const anchor of this.anchors) {
      if (claimed.has(anchor.id)) continue;
      const dist = Math.hypot(anchor.x - centroid.x, anchor.y - centroid.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = anchor;
      }
    }

    return best;
  }

  /** Anchors stable enough to show. */
  visible() {
    return this.anchors.filter((a) => a.confirmations >= CONFIRM_FRAMES);
  }

  get(id) {
    return this.anchors.find((a) => a.id === id) || null;
  }

  clear() {
    this.anchors = [];
  }
}

/**
 * Annotation size from the region's share of the plant. A near leaf fills more
 * of the mask than a far one, so this is a real apparent-size cue — but it is
 * only that, and a genuinely large distant leaf will read as near.
 */
function markerScaleFor(area, totalPlant) {
  if (!totalPlant) return 1;
  const share = Math.sqrt(area / totalPlant);
  return Math.min(1.3, Math.max(0.82, 0.68 + share * 0.95));
}

function countSet(mask) {
  let n = 0;
  for (let i = 0; i < mask.length; i++) n += mask[i] ? 1 : 0;
  return n;
}

/**
 * Real per-region colour metrics, read from the label mask the colour pass
 * already produced. Every number here is counted from pixels inside this
 * region's bounding box — nothing is assigned by position or invented.
 */
function sampleRegionHealth(region, stats) {
  const fallback = { foliage: 0, chlorosis: 0, necrosis: 0, variegation: 0, samples: 0 };
  if (!stats || !stats.mask) return { ...fallback, status: 'unknown', label: 'Not analysed' };

  const { mask: labels, width: lw, height: lh } = stats;
  const x0 = Math.max(0, Math.floor(region.bbox.x * lw));
  const y0 = Math.max(0, Math.floor(region.bbox.y * lh));
  const x1 = Math.min(lw - 1, Math.ceil((region.bbox.x + region.bbox.width) * lw));
  const y1 = Math.min(lh - 1, Math.ceil((region.bbox.y + region.bbox.height) * lh));

  let foliage = 0;
  let chlorosis = 0;
  let necrosis = 0;
  let variegation = 0;

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      switch (labels[y * lw + x]) {
        case FOLIAGE: foliage++; break;
        case CHLOROSIS: chlorosis++; foliage++; break;
        case NECROSIS: necrosis++; break;
        case VARIEGATION: variegation++; foliage++; break;
        default: break;
      }
    }
  }

  const samples = foliage + necrosis;
  if (samples < 12) {
    return { ...fallback, status: 'unknown', label: 'Not analysed' };
  }

  const chlorosisRate = chlorosis / samples;
  const necrosisRate = necrosis / samples;
  const variegationRate = variegation / samples;

  let status = 'healthy';
  let label = 'Healthy';

  if (necrosisRate >= 0.1) {
    status = 'concern';
    label = 'Possible edge browning';
  } else if (chlorosisRate >= CHLOROSIS_THRESHOLD) {
    status = 'watch';
    label = 'Possible yellowing';
  } else if (variegationRate >= 0.25) {
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
