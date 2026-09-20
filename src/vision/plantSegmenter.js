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

    try {
      this.segmenter.segmentForVideo(source, timestampMs, (result) => {
        try {
          this.ingest(result);
        } finally {
          result.close?.();
          this.inFlight = false;
        }
      });
    } catch (err) {
      this.inFlight = false;
      // A single bad frame (zero-size canvas mid-resize, out-of-order
      // timestamp) should not disable segmentation for the rest of the session.
      console.debug('[PlantSegmenter] frame skipped:', err?.message);
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

  /** True once a usable plant mask has actually been produced. */
  hasMask() {
    return this.available && this.mask !== null && this.coverage > 0.004;
  }

  dispose() {
    try {
      this.segmenter?.close();
    } catch (_) {
      /* already torn down */
    }
    this.segmenter = null;
    this.available = false;
  }
}
