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
import { healthWithin } from './leafHealth.js';

/** Regions smaller than this share of the plant mask are noise, not leaves. */
const MIN_REGION_SHARE = 0.018;
/** Cap on simultaneous markers — the brief calls for a few meaningful ones. */
const MAX_ANCHORS = 4;
/** Normalised distance within which a new region re-uses an existing identity. */
const MATCH_RADIUS = 0.14;
/**
 * Miss budgets. These are counted in different units and were previously
 * shared, which is why leaf numbers ran into the hundreds on device: `advance`
 * runs every frame (~30 Hz) while `reconcile` runs per segmentation result
 * (~8 Hz), so a shared budget of 18 retired an anchor after 0.6s of imperfect
 * flow. It would then respawn with a brand new ordinal, over and over.
 */
const MAX_FLOW_MISSES = 45;      // ~1.5s of unreliable optical flow
const MAX_SEGMENT_MISSES = 5;    // ~0.6s of the region genuinely being gone
/** Consecutive confirmations before an anchor is shown, to avoid flicker. */
const CONFIRM_FRAMES = 3;

export class LeafAnchors {
  constructor(flowTracker) {
    this.flow = flowTracker;
    this.anchors = [];
    // Bumped whenever the set empties, so a recycled ordinal still yields a
    // fresh element id and the DOM marker animates in rather than teleporting.
    this.generation = 0;
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
        anchor.flowMisses++;
      }
    }

    this.retire();
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
    const { labels, components } = labelComponents(mask, w, h, minArea);
    const regions = components.slice(0, MAX_ANCHORS);

    const claimed = new Set();

    for (const region of regions) {
      const health = sampleRegionHealth(region, stats, { labels, w, h });
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
        existing.segmentMisses = 0;
        existing.flowMisses = 0;
        existing.confirmations = Math.min(CONFIRM_FRAMES, existing.confirmations + 1);
      } else if (this.anchors.length < MAX_ANCHORS) {
        const ordinal = this.claimOrdinal();
        const anchor = {
          id: `leaf-${ordinal}-${this.generation}`,
          ordinal,
          x: region.centroid.x,
          y: region.centroid.y,
          area: region.area,
          bbox: region.bbox,
          markerScale: markerScaleFor(region.area, totalPlant),
          health,
          segmentMisses: 0,
          flowMisses: 0,
          confirmations: 1,
          tracked: false,
        };
        this.anchors.push(anchor);
        claimed.add(anchor.id);
      }
    }

    for (const anchor of this.anchors) {
      if (!claimed.has(anchor.id)) anchor.segmentMisses++;
    }

    this.retire();
    this.anchors.sort((a, b) => a.ordinal - b.ordinal);
  }

  retire() {
    this.anchors = this.anchors.filter(
      (a) => a.flowMisses < MAX_FLOW_MISSES && a.segmentMisses < MAX_SEGMENT_MISSES,
    );
  }

  /**
   * Smallest unused slot in 1..MAX_ANCHORS. Leaf numbers are slot labels, not
   * a running total of everything ever seen — "Leaf 400" told the user nothing
   * except that the tracker had churned 400 times.
   */
  claimOrdinal() {
    const taken = new Set(this.anchors.map((a) => a.ordinal));
    for (let i = 1; i <= MAX_ANCHORS; i++) {
      if (!taken.has(i)) return i;
    }
    return MAX_ANCHORS;
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
    if (this.anchors.length) this.generation++;
    this.anchors = [];
  }
}


/**
 * Real per-region colour metrics, counted from pixels that actually belong to
 * this component rather than merely falling inside its bounding box. Leaves
 * are not rectangles, so a box around one also contains the gaps around it and
 * whatever is behind them, which silently diluted every per-leaf figure.
 */
function sampleRegionHealth(region, stats, geometry) {
  return healthWithin(stats, regionTest(region, geometry), region.bbox);
}

/**
 * Predicate testing whether a normalised point falls inside this component.
 * The component lives in plant-mask space, a different resolution from the
 * colour label mask, so the point is rescaled on each lookup.
 */
function regionTest(region, geometry) {
  if (!geometry?.labels) return () => true;

  const { labels, w, h } = geometry;
  return (nx, ny) => {
    const px = Math.min(w - 1, Math.max(0, Math.round(nx * w)));
    const py = Math.min(h - 1, Math.max(0, Math.round(ny * h)));
    return labels[py * w + px] === region.id;
  };
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
