/**
 * PlantAnalyzer — one frame in, one analysis out.
 *
 * Coordinates the three vision stages so the rest of the app never has to know
 * which one produced what:
 *
 *   1. LeafDetector   colour + photometrics, every frame  → health signal
 *   2. PlantSegmenter DeepLabV3 "potted plant", throttled → object identity
 *   3. FlowTracker    optical flow, every frame           → anchor persistence
 *
 * The analysis carries a `source` field saying whether the silhouette came from
 * real segmentation or the colour fallback, because the UI must not present a
 * colour threshold as object recognition.
 */

import { LeafDetector, FOLIAGE, CHLOROSIS, VARIEGATION } from './leafDetector.js';
import { PlantSegmenter } from './plantSegmenter.js';
import { FlowTracker } from './flowTracker.js';
import { LeafAnchors } from './leafAnchors.js';
import { labelComponents, silhouette } from './maskAnalysis.js';

/** Frames the silhouette is eased over, to settle jitter without feeling laggy. */
const CONTOUR_LERP = 0.35;

/**
 * Segmentation is only preferred when it explains at least this share of the
 * foliage the colour pass can see.
 *
 * DeepLabV3's "potted plant" class was trained on whole plants in context, so
 * on a macro shot of a single leaf it labels only a fraction of the frame —
 * measured at 9% where the colour pass saw 36%. Taking that mask anyway gives a
 * contour that hugs some incidental corner of the image instead of the leaf,
 * which looks like broken tracking. When the two disagree this badly, the
 * colour mask is the better description of what is actually on screen.
 */
const SEGMENTATION_AGREEMENT = 0.45;

export class PlantAnalyzer {
  constructor() {
    this.detector = new LeafDetector();
    this.segmenter = new PlantSegmenter();
    this.flow = new FlowTracker(160, 120);
    this.anchors = new LeafAnchors(this.flow);

    this.contour = [];
    this.smoothedContour = [];
    this.source = 'colour';
    this.segmenterReady = false;
    this.lastSegmentAt = -1;
  }

  async loadSegmenter() {
    this.segmenterReady = await this.segmenter.load();
    return this.segmenterReady;
  }

  /**
   * @param sourceCanvas the full-resolution frame
   * @param segmentSource frame source handed to MediaPipe (video or canvas)
   * @param timestampMs monotonic clock for the segmenter
   */
  analyze(sourceCanvas, segmentSource, timestampMs) {
    const colour = this.detector.analyze(sourceCanvas);
    if (!colour) return null;

    // Optical flow runs on every frame so anchors keep moving between the much
    // rarer segmentation results.
    this.flow.push(sourceCanvas);

    if (this.segmenterReady && segmentSource) {
      this.segmenter.update(segmentSource, timestampMs);
    }

    const colourFraction = countFoliage(colour.mask) / colour.mask.length;
    const useSegmentation = this.segmenter.hasMask() &&
      this.segmenter.coverage >= colourFraction * SEGMENTATION_AGREEMENT;

    this.source = useSegmentation ? 'segmentation' : 'colour';

    const plantMask = useSegmentation ? this.segmenter.mask : toBinary(colour.mask);
    const maskW = useSegmentation ? this.segmenter.width : colour.maskWidth;
    const maskH = useSegmentation ? this.segmenter.height : colour.maskHeight;

    const detected = useSegmentation ? this.segmenter.coverage > 0.012 : colour.detected;

    this.anchors.advance();

    if (detected) {
      this.updateContour(plantMask, maskW, maskH);

      // Reconcile only when a genuinely new segmentation result landed;
      // otherwise anchors would be re-snapped to the colour blob every frame,
      // which is what made the old markers look attached but behave stuck.
      const isFreshSegment = useSegmentation && this.segmenter.lastRunAt !== this.lastSegmentAt;
      if (isFreshSegment || !useSegmentation) {
        this.lastSegmentAt = this.segmenter.lastRunAt;
        this.anchors.reconcile(plantMask, maskW, maskH, {
          mask: colour.mask,
          width: colour.maskWidth,
          height: colour.maskHeight,
        });
      }
    } else {
      this.contour = [];
      this.smoothedContour = [];
      this.anchors.clear();
    }

    return {
      ...colour,
      detected,
      source: this.source,
      segmenterReady: this.segmenterReady,
      contour: this.smoothedContour,
      leaves: this.anchors.visible(),
      plantCoverage: useSegmentation
        ? Math.round(this.segmenter.coverage * 100)
        : colour.coverage,
    };
  }

  updateContour(mask, w, h) {
    const { components } = labelComponents(mask, w, h, Math.round(w * h * 0.004));
    if (components.length === 0) {
      this.contour = [];
      this.smoothedContour = [];
      return;
    }

    const points = silhouette(mask, w, h, components[0], { epsilon: 1.4, smoothing: 2 });
    if (points.length < 8) return;

    this.contour = points;

    // Point counts change whenever the traced boundary changes complexity, so
    // resample to a fixed ring before easing — otherwise consecutive frames
    // have no correspondence and the outline pops.
    const resampled = resample(points, 96);

    if (this.smoothedContour.length !== resampled.length) {
      this.smoothedContour = resampled;
      return;
    }

    for (let i = 0; i < resampled.length; i++) {
      this.smoothedContour[i].x += (resampled[i].x - this.smoothedContour[i].x) * CONTOUR_LERP;
      this.smoothedContour[i].y += (resampled[i].y - this.smoothedContour[i].y) * CONTOUR_LERP;
    }
  }

  reset() {
    this.flow.reset();
    this.anchors.clear();
    this.contour = [];
    this.smoothedContour = [];
  }
}

function countFoliage(labelMask) {
  let n = 0;
  for (let i = 0; i < labelMask.length; i++) {
    if (labelMask[i] === FOLIAGE || labelMask[i] === CHLOROSIS || labelMask[i] === VARIEGATION) n++;
  }
  return n;
}

function toBinary(labelMask) {
  const out = new Uint8Array(labelMask.length);
  for (let i = 0; i < labelMask.length; i++) {
    // Necrosis (3) is off-plant brown; exclude it from the silhouette so dead
    // background matter does not inflate the outline.
    out[i] = labelMask[i] === FOLIAGE || labelMask[i] === CHLOROSIS || labelMask[i] === VARIEGATION ? 1 : 0;
  }
  return out;
}

/** Resample a closed polyline to a fixed number of evenly spaced points. */
function resample(points, count) {
  const n = points.length;
  const cumulative = new Float64Array(n + 1);

  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    cumulative[i + 1] = cumulative[i] + Math.hypot(b.x - a.x, b.y - a.y);
  }

  const perimeter = cumulative[n];
  if (perimeter === 0) return points.map((p) => ({ x: p.x, y: p.y }));

  const out = [];
  let seg = 0;

  for (let i = 0; i < count; i++) {
    const target = (i / count) * perimeter;
    while (seg < n - 1 && cumulative[seg + 1] < target) seg++;

    const segLength = cumulative[seg + 1] - cumulative[seg];
    const t = segLength === 0 ? 0 : (target - cumulative[seg]) / segLength;
    const a = points[seg];
    const b = points[(seg + 1) % n];

    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }

  return out;
}
