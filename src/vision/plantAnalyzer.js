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

import { LeafDetector, FOLIAGE, CHLOROSIS, NECROSIS, VARIEGATION } from './leafDetector.js';
import { PlantSegmenter } from './plantSegmenter.js';
import { FlowTracker } from './flowTracker.js';
import { LeafAnchors } from './leafAnchors.js';
import { HealthStabilizer } from './healthStabilizer.js';
import { labelComponents, silhouette, shapeStats } from './maskAnalysis.js';

/** Frames the silhouette is eased over, to settle jitter without feeling laggy. */
const CONTOUR_LERP = 0.35;

/**
 * Minimum share of the frame DeepLabV3 must label "potted plant" before we
 * agree a plant is present.
 *
 * Segmentation GATES detection. An earlier version fell back to the colour
 * mask whenever segmentation found less foliage than colour did, which meant a
 * confident "this is not a plant" from the model was overridden by "but there
 * is green in frame" — and a green-capped bottle of hand sanitiser was reported
 * as a healthy money plant with three leaves. Colour cannot tell foliage from
 * packaging; only the object model can, so the object model decides.
 */
const MIN_PLANT_COVERAGE = 0.012;

/**
 * Fallback acceptance when the object model does not recognise a plant.
 *
 * DeepLabV3 knows 21 Pascal VOC classes and is unreliable on casual phone
 * framing: measured on our own specimens it called a macro leaf shot "person"
 * and another "bottle". Gating detection on it alone therefore fails on
 * exactly the shots a user is most likely to take, which is why the scanner
 * stopped finding anything.
 *
 * So when the model is unsure, fall back to the *shape* of the green region
 * rather than merely its presence. `fill` — the share of its bounding box the
 * region occupies — separates the two cases in measurement: foliage is ragged
 * and gappy (0.44-0.74 across six specimens) while packaging is a solid block
 * (1.00 for a cap, a packet and a book). Compactness was also tried and
 * discarded: it overlapped (0.768 for a leaf close-up against 0.755 for a
 * bottle cap) and would have misclassified both.
 *
 * This is a heuristic, not recognition. Detections that rest on it are marked
 * `provisional` and the diagnosis sheet says so.
 */
const PROVISIONAL_MAX_FILL = 0.82;
const PROVISIONAL_MIN_AREA = 0.03;

/**
 * If the model loaded but has not produced a single mask this long after we
 * started feeding it frames, stop waiting and fall back to colour detection.
 *
 * Gating detection on segmentation is right, but it means any silent failure
 * inside the model takes the whole app down — which is exactly what happened
 * when frames were fed from a `display: none` video element on iOS. A scanner
 * that detects nothing at all is worse than one that occasionally
 * over-reports, so long as it says which mode it is in.
 */
const DEGRADED_AFTER_MS = 4000;

export class PlantAnalyzer {
  constructor() {
    this.detector = new LeafDetector();
    this.segmenter = new PlantSegmenter();
    this.flow = new FlowTracker(160, 120);
    this.anchors = new LeafAnchors(this.flow);
    this.health = new HealthStabilizer();

    this.contour = [];
    this.smoothedContour = [];
    this.source = 'colour';
    this.segmenterReady = false;
    this.lastSegmentAt = -1;
    this.base = null;
    this.plantMask = null;
    this.plantMaskW = 0;
    this.plantMaskH = 0;
    /** When we first fed the loaded segmenter a frame. */
    this.firstSegmentAttemptAt = 0;
    this.degraded = false;
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
      if (!this.firstSegmentAttemptAt) this.firstSegmentAttemptAt = timestampMs;
      this.segmenter.update(segmentSource, timestampMs);
    }

    // How long since the model last delivered anything — measured from the
    // first attempt if it has never delivered at all.
    //
    // This deliberately covers BOTH failure shapes. An earlier version only
    // handled "never delivered", on the reasoning that a later gap was just
    // staleness that hasMask() would absorb. But hasMask() returning false
    // means "no plant", so a model that worked and then wedged left the app
    // detecting nothing, permanently, with nothing said about it — which is
    // precisely the "detects at first, then stops" report.
    const since = this.segmenter.lastIngestAt || this.firstSegmentAttemptAt;
    const stalledFor = this.firstSegmentAttemptAt > 0 ? timestampMs - since : 0;

    // Recovers on its own: one successful ingest moves `since` forward.
    this.degraded = this.segmenter.available && stalledFor > DEGRADED_AFTER_MS;

    if (this.degraded) {
      // Fire and forget — a wedged graph only comes back if it is recreated.
      this.segmenter.reloadIfStalled(timestampMs);
    }

    // Shape of the green region, as a second opinion on whether it is
    // foliage-shaped at all rather than merely green.
    this.shape = shapeStats(toBinary(colour.mask), colour.maskWidth, colour.maskHeight);

    const hasModel = this.segmenter.available && !this.degraded;

    const confident = hasModel &&
      this.segmenter.hasMask(timestampMs) &&
      this.segmenter.coverage >= MIN_PLANT_COVERAGE;

    const foliageShaped = Boolean(this.shape) &&
      this.shape.areaShare >= PROVISIONAL_MIN_AREA &&
      this.shape.fill <= PROVISIONAL_MAX_FILL;

    // Colour alone never decides: it must also look like foliage rather than
    // like a box.
    const provisional = !confident && colour.detected && foliageShaped;

    const detected = confident || provisional;
    const confidence = confident ? 'recognised' : (provisional ? 'provisional' : 'none');

    // Geometry follows whichever source actually found the plant.
    const useSegMask = confident;
    const plantMask = useSegMask ? this.segmenter.mask : toBinary(colour.mask);
    const maskW = useSegMask ? this.segmenter.width : colour.maskWidth;
    const maskH = useSegMask ? this.segmenter.height : colour.maskHeight;

    this.anchors.advance();

    if (detected) {
      this.plantMask = plantMask;
      this.plantMaskW = maskW;
      this.plantMaskH = maskH;
      this.updateContour(plantMask, maskW, maskH);

      // Reconcile only when a genuinely new segmentation result landed;
      // otherwise anchors would be re-snapped to the colour blob every frame,
      // which is what made the old markers look attached but behave stuck.
      const isFreshSegment = hasModel && this.segmenter.lastRunAt !== this.lastSegmentAt;
      if (isFreshSegment || !hasModel) {
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
      this.plantMask = null;
      this.base = null;
      this.anchors.clear();
    }

    // Recount the pathology rates using only pixels inside the plant, so
    // background yellows and greens cannot drag the score around.
    const confined = detected && useSegMask && plantMask
      ? confineDiagnosis(colour, plantMask, maskW, maskH)
      : colour.diagnosis;

    const diagnosis = detected
      ? this.health.update(confined, colour.light?.lux ?? 400, timestampMs)
      : colour.diagnosis;

    return {
      ...colour,
      diagnosis,
      detected,
      source: confident ? 'segmentation' : 'shape+colour',
      segmenterReady: this.segmenterReady,
      contour: this.smoothedContour,
      base: this.base,
      degraded: !hasModel,
      shape: this.shape,
      confidence,
      segmenterHealth: {
        available: this.segmenter.available,
        stalledForMs: Math.round(stalledFor),
        droppedCallbacks: this.segmenter.droppedCallbacks,
        reloads: this.segmenter.reloads,
        lastCoverage: this.segmenter.coverage,
      },
      plantMask: this.plantMask,
      plantMaskWidth: this.plantMaskW,
      plantMaskHeight: this.plantMaskH,
      leaves: this.anchors.visible(),
      plantCoverage: hasModel
        ? Math.round(this.segmenter.coverage * 100)
        : colour.coverage,
    };
  }

  updateContour(mask, w, h) {
    const { components } = labelComponents(mask, w, h, Math.round(w * h * 0.004));
    if (components.length === 0) {
      this.contour = [];
      this.smoothedContour = [];
      this.base = null;
      return;
    }

    // Where the plant meets the surface, used to anchor the grounding ring.
    // Bottom-centre of the dominant component's bounding box.
    const bbox = components[0].bbox;
    const base = {
      x: bbox.x + bbox.width * 0.5,
      y: bbox.y + bbox.height,
      radius: bbox.width * 0.5,
    };
    this.base = this.base
      ? {
          x: this.base.x + (base.x - this.base.x) * 0.2,
          y: this.base.y + (base.y - this.base.y) * 0.2,
          radius: this.base.radius + (base.radius - this.base.radius) * 0.2,
        }
      : base;

    // Calmer than the pixel-accurate trace: at 256px mask resolution upscaled
    // to a phone screen, every boundary wobble is magnified ~6x and the outline
    // reads as noisy rather than confident.
    const points = silhouette(mask, w, h, components[0], { epsilon: 2.4, smoothing: 3 });
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
    this.health.reset();
    this.contour = [];
    this.smoothedContour = [];
    this.base = null;
    this.plantMask = null;
    // Deliberately NOT resetting firstSegmentAttemptAt/degraded: whether the
    // model works on this device is a property of the device, not of the
    // current frame, and re-arming the grace period on every reset would make
    // the app flip between modes.
  }
}

/**
 * Recompute chlorosis/necrosis/variegation counting only pixels that fall
 * inside the segmented plant. Without this, a yellow packet or a green box
 * behind the plant is measured as part of its foliage.
 */
function confineDiagnosis(colour, plantMask, mw, mh) {
  const labels = colour.mask;
  const lw = colour.maskWidth;
  const lh = colour.maskHeight;

  let foliage = 0;
  let chlorosis = 0;
  let necrosis = 0;
  let variegation = 0;

  for (let y = 0; y < lh; y++) {
    const my = Math.min(mh - 1, Math.round((y / lh) * mh));
    for (let x = 0; x < lw; x++) {
      const mx = Math.min(mw - 1, Math.round((x / lw) * mw));
      if (!plantMask[my * mw + mx]) continue;

      switch (labels[y * lw + x]) {
        case FOLIAGE: foliage++; break;
        case CHLOROSIS: chlorosis++; foliage++; break;
        case NECROSIS: necrosis++; break;
        case VARIEGATION: variegation++; foliage++; break;
        default: break;
      }
    }
  }

  const total = foliage + necrosis;
  if (total < 24) return colour.diagnosis;

  return {
    ...colour.diagnosis,
    chlorosisRate: Math.round((chlorosis / total) * 100),
    necrosisRate: Math.round((necrosis / total) * 100),
    variegationRate: Math.round((variegation / total) * 100),
  };
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
