/**
 * PlantSegmenter — real object segmentation via MediaPipe ImageSegmenter.
 *
 * Runs DeepLabV3 (Pascal VOC) and keeps only the "potted plant" category. This
 * is what turns detection from "green pixels are somewhere in frame" into an
 * actual object mask with a real silhouette, including concavities between
 * leaves that a colour threshold can never recover.
 *
 * Everything here is optional. If the WASM runtime or the model fails to load —
 * older iOS Safari, blocked asset, low memory — `available` stays false and the
 * caller falls back to the colour mask. The UI must reflect which one is live
 * rather than claiming segmentation it did not get.
 */

// Segmentation is the expensive stage; the colour pass and the render loop run
// every frame regardless, so this only needs to be fast enough to feel attached.
const TARGET_INTERVAL_MS = 120;

// Pascal VOC index for "potted plant". Resolved from getLabels() at runtime;
// this is only the fallback if the label list comes back in an unexpected shape.
const POTTED_PLANT_FALLBACK_INDEX = 16;

/**
 * A mask older than this is no longer evidence about what the camera sees.
 * Generous enough to ride out a few rejected frames, short enough that the UI
 * drops back to "no plant" rather than describing a scene that has moved on.
 */
const STALE_AFTER_MS = 700;

function assetUrl(relativePath) {
  return new URL(relativePath, document.baseURI).href;
}

export class PlantSegmenter {
  constructor() {
    this.segmenter = null;
    this.available = false;
    this.loading = false;
    this.failureReason = null;

    this.plantIndex = POTTED_PLANT_FALLBACK_INDEX;

    /** Binary plant mask, 1 byte per pixel, at `width` x `height`. */
    this.mask = null;
    this.width = 0;
    this.height = 0;
    /** Fraction of the frame the plant occupies, 0..1. */
    this.coverage = 0;
    this.lastRunAt = 0;
    this.inFlight = false;

    /**
     * MediaPipe requires strictly increasing timestamps and rejects a frame
     * that does not advance its internal clock. Driving that from
     * `performance.now()` is fragile — the clock can be re-based, and any
     * rejected frame used to be swallowed, leaving the previous mask in place.
     * A private counter can only ever go up.
     */
    this.timestamp = 0;
    /** When a mask was last genuinely produced, for staleness checks. */
    this.lastIngestAt = 0;
    this.consecutiveFailures = 0;
  }

  async load() {
    if (this.loading || this.available) return this.available;
    this.loading = true;

    try {
      const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');

      const fileset = await FilesetResolver.forVisionTasks(assetUrl('mediapipe/wasm'));

      this.segmenter = await ImageSegmenter.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: assetUrl('models/deeplab_v3.tflite'),
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      });

      this.resolvePlantIndex();
      this.available = true;
    } catch (err) {
      this.failureReason = err?.message || String(err);
      console.warn('[PlantSegmenter] unavailable, falling back to colour mask:', err);
      this.available = false;
    } finally {
      this.loading = false;
    }

    return this.available;
  }

  resolvePlantIndex() {
    try {
      const labels = this.segmenter.getLabels?.() || [];
      const idx = labels.findIndex((l) => /potted\s*plant|pottedplant/i.test(l));
      if (idx >= 0) this.plantIndex = idx;
    } catch (_) {
      // Keep the Pascal VOC fallback.
    }
  }

  /**
   * Segment a video frame. Throttled internally and non-blocking: returns
   * immediately and the caller keeps using the previous mask until a new one
   * lands. `timestampMs` must increase monotonically or MediaPipe rejects it.
   */
  update(source, timestampMs) {
    if (!this.available || this.inFlight) return;
    if (timestampMs - this.lastRunAt < TARGET_INTERVAL_MS) return;
    if (!source || !source.width || !source.height) return;

    this.lastRunAt = timestampMs;
    this.inFlight = true;
    this.timestamp += 34;

    try {
      this.segmenter.segmentForVideo(source, this.timestamp, (result) => {
        try {
          this.ingest(result);
          this.lastIngestAt = timestampMs;
          this.consecutiveFailures = 0;
        } finally {
          result.close?.();
          this.inFlight = false;
        }
      });
    } catch (err) {
      this.inFlight = false;
      this.consecutiveFailures++;
      // A single bad frame (zero-size canvas mid-resize) is survivable, but it
      // must not pass silently: the previous mask stays in memory, and
      // reporting it as current is how the app ends up confidently describing
      // a plant that is no longer in front of the camera.
      if (this.consecutiveFailures === 1 || this.consecutiveFailures % 30 === 0) {
        console.warn('[PlantSegmenter] frame rejected:', err?.message);
      }
    }
  }

  ingest(result) {
    const categoryMask = result.categoryMask;
    if (!categoryMask) return;

    const w = categoryMask.width;
    const h = categoryMask.height;
    const categories = categoryMask.getAsUint8Array();

    if (!this.mask || this.width !== w || this.height !== h) {
      this.mask = new Uint8Array(w * h);
      this.width = w;
      this.height = h;
    }

    const plant = this.plantIndex;
    let hits = 0;
    for (let i = 0; i < categories.length; i++) {
      const isPlant = categories[i] === plant ? 1 : 0;
      this.mask[i] = isPlant;
      hits += isPlant;
    }

    this.coverage = hits / categories.length;
  }

  /**
   * True once a usable and *current* plant mask exists. A mask older than
   * STALE_AFTER_MS is treated as absent rather than reported as live.
   */
  hasMask(nowMs = this.lastRunAt) {
    if (!this.available || this.mask === null) return false;
    if (nowMs - this.lastIngestAt > STALE_AFTER_MS) return false;
    return this.coverage > 0.004;
  }

  dispose() {
    try {
      this.segmenter?.close();
    } catch (_) {
      /* already torn down */
    }
    this.segmenter = null;
    this.available = false;
    this.mask = null;
    this.coverage = 0;
    this.lastIngestAt = 0;
  }
}
