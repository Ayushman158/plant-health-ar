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

/**
 * Longest edge of the frame actually handed to the model.
 *
 * A phone delivers 1080x1920, so the returned category mask was 2.07M pixels
 * and every stage downstream paid for it — the per-pixel ingest loop, then
 * component labelling allocating two 8MB typed arrays per reconcile. Measured
 * on device: 15fps. DeepLabV3 runs at 257x257 internally regardless, so the
 * extra resolution buys nothing and costs everything.
 */
const SEGMENT_INPUT_MAX = 512;

/**
 * How long a single segmentation may be outstanding before we assume its
 * callback is never coming and allow the next one.
 *
 * `segmentForVideo` can return normally and then simply never invoke its
 * callback — a dropped frame, a GPU hiccup, iOS reclaiming the WebGL context.
 * Without this, `inFlight` latches true, every later update returns early, and
 * segmentation is dead for the rest of the session. That is the "it detects
 * for a moment and then stops" failure.
 */
const INFLIGHT_TIMEOUT_MS = 900;

/**
 * A stall this long means the graph itself is wedged, not merely slow. Closing
 * and recreating it is the only thing that recovers a lost GPU context.
 */
const RELOAD_AFTER_STALL_MS = 9000;
const MAX_RELOADS = 3;

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
     * The clock handed to MediaPipe. It must increase strictly, and it must
     * also stay close to real time: VIDEO mode uses it for internal sync, and
     * a clock that drifts progressively further behind the wall clock degrades
     * over minutes rather than failing outright.
     *
     * An earlier version incremented a fixed 34ms per call while `update` ran
     * roughly every 120ms, so it fell behind by ~3.5x and the gap grew without
     * bound — fine for the first few seconds, useless later. Tracking
     * `performance.now()` while forcing strict monotonicity gives both
     * properties.
     */
    this.timestamp = 0;
    /** When a mask was last genuinely produced, for staleness checks. */
    this.lastIngestAt = 0;
    this.consecutiveFailures = 0;
    /** When the outstanding request started, for the watchdog. */
    this.inFlightSince = 0;
    this.droppedCallbacks = 0;

    /**
     * What the model actually saw: the most common non-background category and
     * its share of the frame. When the plant class comes back empty this is
     * the difference between "the model is broken" and "the model is looking
     * at a television".
     */
    this.dominantLabel = '-';
    this.dominantShare = 0;
    this.labels = [];

    // Frames are downscaled into this before being segmented.
    this.inputCanvas = document.createElement('canvas');
    this.inputCtx = this.inputCanvas.getContext('2d');
    this.reloads = 0;
    this.reloading = false;
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
      this.labels = this.segmenter.getLabels?.() || [];
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
    if (!this.available || this.reloading) return;

    if (this.inFlight) {
      // Watchdog: release a request whose callback never arrived, rather than
      // blocking every future frame behind it.
      if (timestampMs - this.inFlightSince < INFLIGHT_TIMEOUT_MS) return;
      this.inFlight = false;
      this.droppedCallbacks++;
      console.warn('[PlantSegmenter] segmentation callback never arrived; releasing slot');
    }

    if (timestampMs - this.lastRunAt < TARGET_INTERVAL_MS) return;
    if (!source || !source.width || !source.height) return;

    const input = this.downscale(source);
    if (!input) return;

    this.lastRunAt = timestampMs;
    this.inFlight = true;
    this.inFlightSince = timestampMs;
    // Real-time aligned, and strictly increasing even if the clock repeats.
    this.timestamp = Math.max(this.timestamp + 1, Math.round(timestampMs));

    try {
      this.segmenter.segmentForVideo(input, this.timestamp, (result) => {
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

  /** Aspect-preserving downscale, so normalised coordinates stay valid. */
  downscale(source) {
    const sw = source.videoWidth || source.width;
    const sh = source.videoHeight || source.height;
    if (!sw || !sh) return null;

    const scale = Math.min(1, SEGMENT_INPUT_MAX / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));

    if (this.inputCanvas.width !== w || this.inputCanvas.height !== h) {
      this.inputCanvas.width = w;
      this.inputCanvas.height = h;
    }

    this.inputCtx.drawImage(source, 0, 0, w, h);
    return this.inputCanvas;
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
    // Tally every class, not just the plant, so a zero result can be explained.
    const histogram = new Uint32Array(32);

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      const isPlant = cat === plant ? 1 : 0;
      this.mask[i] = isPlant;
      hits += isPlant;
      if (cat < 32) histogram[cat]++;
    }

    this.coverage = hits / categories.length;

    // Index 0 is background; the interesting answer is what else it found.
    let top = 0;
    let topCount = 0;
    for (let c = 1; c < 32; c++) {
      if (histogram[c] > topCount) { topCount = histogram[c]; top = c; }
    }
    this.dominantLabel = topCount > 0 ? (this.labels[top] || 'class ' + top) : 'none';
    this.dominantShare = topCount / categories.length;
  }

  /**
   * Recreate the graph after a hard stall. Recoverable failures are handled by
   * the watchdog; this is for a graph that has genuinely died, where no amount
   * of resubmitting frames will help.
   */
  async reloadIfStalled(timestampMs) {
    if (this.reloading || !this.available) return false;
    if (this.reloads >= MAX_RELOADS) return false;
    if (!this.lastIngestAt) return false;
    if (timestampMs - this.lastIngestAt < RELOAD_AFTER_STALL_MS) return false;

    this.reloading = true;
    this.reloads++;
    console.warn(`[PlantSegmenter] stalled for ${Math.round(timestampMs - this.lastIngestAt)}ms; recreating (attempt ${this.reloads})`);

    try {
      this.segmenter?.close();
    } catch (_) {
      /* already gone */
    }

    this.segmenter = null;
    this.available = false;
    this.mask = null;
    this.coverage = 0;
    this.inFlight = false;
    this.timestamp = 0;
    this.loading = false;

    const ok = await this.load();
    // Give the fresh graph a full grace period before the stall check bites
    // again, otherwise it would be torn down before it can produce anything.
    this.lastIngestAt = ok ? timestampMs : 0;
    this.reloading = false;
    return ok;
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
