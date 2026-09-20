/**
 * LeafSegmenter — precise single-leaf masks via SlimSAM.
 *
 * The leaf regions elsewhere in this app are connected components of the plant
 * mask. That is honest but coarse: two touching leaves are one component, and a
 * component's outline is the outline of a *blob*, not of a leaf. SAM is
 * promptable — give it a point and it returns the mask of the specific object
 * under that point — so tapping a leaf can produce that leaf's actual boundary.
 *
 * Cost shapes the design. The vision encoder is the expensive half and runs on
 * a whole frame; the prompt decoder is cheap and runs per click. So this
 * operates on a *frozen* frame: the user taps, the frame is held, the encoder
 * runs once, and from then on every tap on that still image decodes in
 * milliseconds. Running the encoder on live video would be far slower and the
 * mask would be stale by the time it arrived.
 *
 * Everything is loaded lazily on first use — roughly 27 MB of runtime and
 * weights — so a user who never inspects a leaf never pays for it.
 */

const MODEL_ID = 'slimsam';

/** A leaf should occupy a plausible slice of the frame — not a speck, not everything. */
const MIN_MASK_SHARE = 0.01;
const MAX_MASK_SHARE = 0.75;

function assetUrl(relativePath) {
  return new URL(relativePath, document.baseURI).href;
}

/**
 * Pick which of SAM's candidate masks is the leaf.
 *
 * SAM emits three nested guesses (roughly subpart, part, whole) plus a
 * predicted-IoU score for each. Trusting the score alone does not work here:
 * measured on a monstera leaf the scores ran [0.65, 0.78, 0.85] while the
 * masks covered [18.7%, 0.2%, 0.1%] of the frame — so the highest-scored
 * candidate was 774 pixels of speckle and the leaf was the one it rated worst.
 *
 * So: keep candidates covering a plausible share of the frame, and among those
 * take the best-scored. If none qualify, fall back to the largest.
 */
function chooseMask(source, numMasks, channelStride, scores) {
  let bestEligible = -1;
  let bestEligibleScore = -Infinity;
  let largest = -1;
  let largestCount = 0;

  for (let c = 0; c < numMasks; c++) {
    const offset = c * channelStride;
    let count = 0;
    for (let i = 0; i < channelStride; i++) {
      if (source[offset + i]) count++;
    }

    if (count > largestCount) {
      largestCount = count;
      largest = c;
    }

    const share = count / channelStride;
    if (share < MIN_MASK_SHARE || share > MAX_MASK_SHARE) continue;

    const score = scores?.[c] ?? 0;
    if (score > bestEligibleScore) {
      bestEligibleScore = score;
      bestEligible = c;
    }
  }

  if (bestEligible >= 0) return bestEligible;
  return largestCount > 0 ? largest : -1;
}

export class LeafSegmenter {
  constructor() {
    this.model = null;
    this.processor = null;
    this.status = 'idle'; // idle | loading | ready | failed
    this.failureReason = null;

    this.embeddings = null;
    this.imageInputs = null;
    this.frameWidth = 0;
    this.frameHeight = 0;

    this.onProgress = null;
  }

  get isReady() {
    return this.status === 'ready';
  }

  async load() {
    if (this.status === 'ready') return true;
    if (this.status === 'loading') return this.loadPromise;

    this.status = 'loading';
    this.loadPromise = this.doLoad();
    return this.loadPromise;
  }

  async doLoad() {
    try {
      const { env, SamModel, AutoProcessor } = await import('@huggingface/transformers');

      // The weights are ours and served from this origin.
      env.allowRemoteModels = false;
      env.allowLocalModels = true;
      env.localModelPath = assetUrl('models/');

      // The onnxruntime WASM binaries are deliberately NOT self-hosted.
      // onnxruntime ships several builds (plain, asyncify, jsep, jspi) and
      // transformers.js picks between them from browser and Safari-version
      // feature detection. Pinning `wasmPaths` to our own folder overrides
      // that choice and then 404s on whichever variant it actually wanted —
      // and hosting all of them costs ~60 MB. Its own resolution is left
      // alone; if the fetch fails, `load()` reports failure and the app runs
      // without leaf tracing.
      env.backends.onnx.wasm.numThreads = 1;

      const progress = (p) => {
        if (p.status === 'progress' && this.onProgress && p.total) {
          this.onProgress(p.loaded / p.total, p.file);
        }
      };

      this.model = await SamModel.from_pretrained(MODEL_ID, {
        dtype: 'q8',
        progress_callback: progress,
      });
      this.processor = await AutoProcessor.from_pretrained(MODEL_ID, {
        progress_callback: progress,
      });

      this.status = 'ready';
      return true;
    } catch (err) {
      this.failureReason = err?.message || String(err);
      this.status = 'failed';
      console.warn('[LeafSegmenter] unavailable:', err);
      return false;
    }
  }

  /**
   * Encode one frame. Expensive — call once per frozen frame, then decode as
   * many points against it as the user taps.
   */
  async encode(sourceCanvas) {
    if (!this.isReady) return false;

    const { RawImage } = await import('@huggingface/transformers');

    // SlimSAM works at 1024px; handing it a full 1080p frame wastes time in
    // resizing without improving the mask.
    const maxSide = 1024;
    const scale = Math.min(1, maxSide / Math.max(sourceCanvas.width, sourceCanvas.height));
    const w = Math.round(sourceCanvas.width * scale);
    const h = Math.round(sourceCanvas.height * scale);

    const scratch = document.createElement('canvas');
    scratch.width = w;
    scratch.height = h;
    scratch.getContext('2d').drawImage(sourceCanvas, 0, 0, w, h);

    const blob = await new Promise((r) => scratch.toBlob(r, 'image/jpeg', 0.92));
    const image = await RawImage.fromBlob(blob);

    this.imageInputs = await this.processor(image);
    this.embeddings = await this.model.get_image_embeddings(this.imageInputs);
    this.frameWidth = w;
    this.frameHeight = h;

    return true;
  }

  /**
   * Decode the mask of whatever object sits under a normalised point.
   * @returns {{mask: Uint8Array, width: number, height: number, score: number}|null}
   */
  async segmentAt(nx, ny) {
    if (!this.isReady || !this.embeddings) return null;

    const { Tensor } = await import('@huggingface/transformers');

    const reshaped = this.imageInputs.reshaped_input_sizes[0];
    const point = [nx * reshaped[1], ny * reshaped[0]];

    const input_points = new Tensor('float32', point, [1, 1, 1, 2]);
    const input_labels = new Tensor('int64', [1n], [1, 1, 1]);

    const outputs = await this.model({ ...this.embeddings, input_points, input_labels });

    const masks = await this.processor.post_process_masks(
      outputs.pred_masks,
      this.imageInputs.original_sizes,
      this.imageInputs.reshaped_input_sizes,
    );

    // post_process_masks returns a Tensor, not a RawImage: dims are
    // [batch, numMasks, height, width] and the data is one bool plane per
    // candidate mask, laid out channel-major.
    const raw = masks[0];
    const [, numMasks, fullHeight, fullWidth] = raw.dims;
    const channelStride = fullWidth * fullHeight;
    const source = raw.data;
    const scores = outputs.iou_scores.data;

    const best = chooseMask(source, numMasks, channelStride, scores);
    if (best < 0) return null;
    const offset = best * channelStride;

    // Downsample for the geometry pass. Tracing a boundary around 840k pixels
    // is slow and yields a contour far finer than anything visible on a phone;
    // the rest of the pipeline works at a few hundred pixels for the same
    // reason.
    const step = Math.max(1, Math.ceil(Math.max(fullWidth, fullHeight) / 320));
    const width = Math.floor(fullWidth / step);
    const height = Math.floor(fullHeight / step);

    const mask = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      const sy = y * step;
      for (let x = 0; x < width; x++) {
        mask[y * width + x] = source[offset + sy * fullWidth + x * step] ? 1 : 0;
      }
    }

    return { mask, width, height, score: scores[best] };
  }

  /** Drop the frozen frame's embeddings; the model stays loaded. */
  clearFrame() {
    this.embeddings = null;
    this.imageInputs = null;
  }
}
