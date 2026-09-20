/**
 * FlowTracker — pyramidal Lucas-Kanade sparse optical flow.
 *
 * This is the piece that makes a marker *anchored* rather than *recomputed*.
 * Segmentation runs a few times a second and gives regions for the current
 * frame only; between those runs an anchor rides the actual image motion, so
 * it stays on the leaf it was placed on when the camera pans, instead of
 * snapping to wherever the largest blob happens to be now.
 *
 * Honest limits: this is 2D image-plane tracking. It has no depth, no camera
 * pose and no map of the scene, so it drifts under rotation and cannot recover
 * an anchor that leaves the frame and comes back. It is genuine frame-to-frame
 * tracking, not world tracking.
 */

const PYRAMID_LEVELS = 3;
const WINDOW_RADIUS = 5;         // 11x11 window
const MAX_ITERATIONS = 6;
const CONVERGENCE_EPSILON = 0.02;
// Below this the 2x2 structure tensor is near-singular: flat, textureless
// patches where flow is unconstrained (the aperture problem). Drop rather than
// report a confident-looking but meaningless displacement.
const MIN_EIGENVALUE = 0.0012;
/**
 * Mean squared intensity error (0..1 scale) above which the matched patch is
 * not really the patch we started from. Checked on EVERY exit path: a point
 * that exhausts its iterations without converging has failed just as surely as
 * one that diverged, and returning it unchecked reports a confidently wrong
 * displacement — which looks exactly like a marker sliding off its leaf.
 */
const MAX_MEAN_SQUARED_ERROR = 0.012;
/** Displacement beyond this many pixels per level is not a plausible match. */
const MAX_DISPLACEMENT = 24;

export class FlowTracker {
  constructor(width = 160, height = 120) {
    this.width = width;
    this.height = height;

    this.scratch = document.createElement('canvas');
    this.scratch.width = width;
    this.scratch.height = height;
    this.scratchCtx = this.scratch.getContext('2d', { willReadFrequently: true });

    this.prevPyramid = null;
    this.currPyramid = null;
  }

  /** Grab the frame as a grayscale pyramid and make it the current one. */
  push(sourceCanvas) {
    if (!sourceCanvas || !sourceCanvas.width || !sourceCanvas.height) return false;

    this.scratchCtx.drawImage(sourceCanvas, 0, 0, this.width, this.height);
    const { data } = this.scratchCtx.getImageData(0, 0, this.width, this.height);

    const gray = new Float32Array(this.width * this.height);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      gray[p] = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    }

    this.prevPyramid = this.currPyramid;
    this.currPyramid = buildPyramid(gray, this.width, this.height, PYRAMID_LEVELS);
    return this.prevPyramid !== null;
  }

  /**
   * Track normalised points from the previous frame into the current one.
   * @returns array of `{x, y, ok}` in normalised coordinates, index-aligned.
   */
  track(points) {
    if (!this.prevPyramid || !this.currPyramid || points.length === 0) {
      return points.map((p) => ({ x: p.x, y: p.y, ok: false }));
    }

    return points.map((p) => {
      const px = p.x * this.width;
      const py = p.y * this.height;
      const result = this.trackPoint(px, py);

      if (!result) return { x: p.x, y: p.y, ok: false };
      return {
        x: clamp01(result.x / this.width),
        y: clamp01(result.y / this.height),
        ok: true,
      };
    });
  }

  trackPoint(px, py) {
    let gx = 0;
    let gy = 0;

    for (let level = PYRAMID_LEVELS - 1; level >= 0; level--) {
      const prev = this.prevPyramid[level];
      const curr = this.currPyramid[level];
      const scale = 1 / (1 << level);

      const lx = px * scale;
      const ly = py * scale;

      // Carry the coarse estimate down: each level down doubles the offset.
      gx *= 2;
      gy *= 2;

      const flow = lucasKanade(prev, curr, lx, ly, gx, gy);
      if (!flow) return null;

      gx = flow.dx;
      gy = flow.dy;
    }

    const nx = px + gx;
    const ny = py + gy;
    if (nx < 0 || ny < 0 || nx >= this.width || ny >= this.height) return null;

    return { x: nx, y: ny };
  }

  reset() {
    this.prevPyramid = null;
    this.currPyramid = null;
  }
}

function buildPyramid(gray, width, height, levels) {
  const pyramid = [{ data: gray, width, height }];

  for (let i = 1; i < levels; i++) {
    const prev = pyramid[i - 1];
    const w = Math.max(1, prev.width >> 1);
    const h = Math.max(1, prev.height >> 1);
    const data = new Float32Array(w * h);

    // 2x2 box downsample — cheap and adequate at these resolutions.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sx = x << 1;
        const sy = y << 1;
        const x1 = Math.min(sx + 1, prev.width - 1);
        const y1 = Math.min(sy + 1, prev.height - 1);
        data[y * w + x] = 0.25 * (
          prev.data[sy * prev.width + sx] +
          prev.data[sy * prev.width + x1] +
          prev.data[y1 * prev.width + sx] +
          prev.data[y1 * prev.width + x1]
        );
      }
    }

    pyramid.push({ data, width: w, height: h });
  }

  return pyramid;
}

function sample(img, x, y) {
  // Bilinear sample with edge clamping; sub-pixel accuracy is the whole point
  // of iterating, so nearest-neighbour here would stall convergence.
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;

  const cx0 = clampInt(x0, 0, img.width - 1);
  const cy0 = clampInt(y0, 0, img.height - 1);
  const cx1 = clampInt(x0 + 1, 0, img.width - 1);
  const cy1 = clampInt(y0 + 1, 0, img.height - 1);

  const a = img.data[cy0 * img.width + cx0];
  const b = img.data[cy0 * img.width + cx1];
  const c = img.data[cy1 * img.width + cx0];
  const d = img.data[cy1 * img.width + cx1];

  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

function lucasKanade(prev, curr, x, y, initialDx, initialDy) {
  if (x < 1 || y < 1 || x >= prev.width - 1 || y >= prev.height - 1) return null;

  let sumIxx = 0;
  let sumIyy = 0;
  let sumIxy = 0;

  const gradX = [];
  const gradY = [];
  const template = [];

  for (let wy = -WINDOW_RADIUS; wy <= WINDOW_RADIUS; wy++) {
    for (let wx = -WINDOW_RADIUS; wx <= WINDOW_RADIUS; wx++) {
      const sx = x + wx;
      const sy = y + wy;

      const ix = (sample(prev, sx + 1, sy) - sample(prev, sx - 1, sy)) * 0.5;
      const iy = (sample(prev, sx, sy + 1) - sample(prev, sx, sy - 1)) * 0.5;

      gradX.push(ix);
      gradY.push(iy);
      template.push(sample(prev, sx, sy));

      sumIxx += ix * ix;
      sumIyy += iy * iy;
      sumIxy += ix * iy;
    }
  }

  const det = sumIxx * sumIyy - sumIxy * sumIxy;
  const trace = sumIxx + sumIyy;
  if (det <= 1e-9) return null;

  // Smaller eigenvalue of the structure tensor — the Shi-Tomasi cornerness.
  const disc = Math.sqrt(Math.max(0, trace * trace - 4 * det));
  const minEigen = (trace - disc) * 0.5 / template.length;
  if (minEigen < MIN_EIGENVALUE) return null;

  let dx = initialDx;
  let dy = initialDy;
  let meanSquaredError = Infinity;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let sumIxt = 0;
    let sumIyt = 0;
    let residual = 0;
    let k = 0;

    for (let wy = -WINDOW_RADIUS; wy <= WINDOW_RADIUS; wy++) {
      for (let wx = -WINDOW_RADIUS; wx <= WINDOW_RADIUS; wx++, k++) {
        const it = sample(curr, x + wx + dx, y + wy + dy) - template[k];
        sumIxt += gradX[k] * it;
        sumIyt += gradY[k] * it;
        residual += it * it;
      }
    }

    meanSquaredError = residual / template.length;

    // Solve G * step = -b for the 2x2 system.
    const stepX = -(sumIyy * sumIxt - sumIxy * sumIyt) / det;
    const stepY = -(sumIxx * sumIyt - sumIxy * sumIxt) / det;

    dx += stepX;
    dy += stepY;

    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
    if (Math.abs(dx) > MAX_DISPLACEMENT || Math.abs(dy) > MAX_DISPLACEMENT) return null;

    if (Math.hypot(stepX, stepY) < CONVERGENCE_EPSILON) break;
  }

  // Validate the final patch match regardless of how the loop ended.
  if (meanSquaredError > MAX_MEAN_SQUARED_ERROR) return null;

  return { dx, dy };
}

function clampInt(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
