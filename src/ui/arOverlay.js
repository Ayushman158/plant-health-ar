/**
 * ArOverlay — the canvas half of the AR layer.
 *
 * Draws only what carries information: the plant's contour, and optionally its
 * medial-axis structure. Labels and markers are DOM (see leafMarkers.js) so
 * text stays crisp and tappable.
 *
 * Deliberately absent: tracking-dot grids, scanlines, particles, reticles. The
 * plant is the subject; the overlay's job is to show that the system has
 * located it, not to decorate the frame.
 */

import { medialAxis } from '../vision/maskAnalysis.js';

const CONTOUR_COLOR = {
  healthy: 'rgba(134, 239, 172, 0.95)',
  watch: 'rgba(253, 224, 154, 0.95)',
  concern: 'rgba(252, 165, 165, 0.95)',
};

/** Seconds for the contour to draw itself on once the plant is first found. */
const REVEAL_DURATION = 0.55;

export class ArOverlay {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.status = 'healthy';
    this.reveal = 0;
    this.lastFrameTime = 0;
    this.structureMode = false;
    this.structure = [];

    // Scratch layers for depth-ordered compositing. `maskCanvas` holds the
    // plant silhouette; `sceneCanvas` is where ground geometry is drawn before
    // the silhouette is punched out of it.
    this.maskCanvas = document.createElement('canvas');
    this.maskCtx = this.maskCanvas.getContext('2d');
    this.sceneCanvas = document.createElement('canvas');
    this.sceneCtx = this.sceneCanvas.getContext('2d');
    this.maskVersion = null;

    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    window.matchMedia?.('(prefers-reduced-motion: reduce)')
      .addEventListener?.('change', (e) => { this.reducedMotion = e.matches; });
  }

  setStatus(status) {
    this.status = status in CONTOUR_COLOR ? status : 'healthy';
  }

  setStructureMode(enabled) {
    this.structureMode = enabled;
    if (!enabled) this.structure = [];
  }

  /**
   * Recompute the skeleton.
   *
   * The raw medial axis of a leafy mask is thousands of points — ridges run
   * along every leaf blade, not just the stems — and drawing them all fills the
   * plant with a solid blocky mesh. So it is thinned twice: keep only the
   * thicker half of the ridge (stems and midribs, not blade interiors), then
   * space the survivors apart so the result reads as a sparse trace over the
   * plant rather than a wireframe through it.
   */
  updateStructure(mask, w, h) {
    if (!this.structureMode || !mask) return;

    const raw = medialAxis(mask, w, h, { minThickness: 2.4, stride: 2 });
    this.structure = thin(raw, { keepShare: 0.5, minSpacing: 0.022, max: 160 });
  }

  render(analysis, displayCanvas, timeMs) {
    const dt = this.lastFrameTime ? Math.min(0.05, (timeMs - this.lastFrameTime) / 1000) : 0;
    this.lastFrameTime = timeMs;

    const w = displayCanvas.width || this.canvas.clientWidth;
    const h = displayCanvas.height || this.canvas.clientHeight;

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    const hasContour = analysis?.detected && analysis.contour?.length > 8;

    // Ease the reveal in and out so the outline never simply blinks on.
    const target = hasContour ? 1 : 0;
    if (this.reducedMotion) {
      this.reveal = target;
    } else {
      const rate = dt / REVEAL_DURATION;
      this.reveal += Math.sign(target - this.reveal) * Math.min(Math.abs(target - this.reveal), rate);
    }

    if (this.reveal <= 0.001 || !analysis?.contour?.length) return;

    // Ground geometry is drawn first and occluded by the plant, so it reads as
    // lying on the surface the plant stands on rather than painted over it.
    if (analysis.base && analysis.plantMask) {
      this.syncMask(analysis, w, h);
      this.drawGroundRing(analysis.base, w, h);
    }

    if (this.structureMode && this.structure.length) {
      this.drawStructure(this.structure, w, h);
    }

    this.drawContour(analysis.contour, w, h);
  }

  /** Rasterise the binary plant mask into an alpha layer at canvas scale. */
  syncMask(analysis, w, h) {
    const { plantMask, plantMaskWidth: mw, plantMaskHeight: mh } = analysis;
    if (!plantMask || !mw || !mh) return;

    if (this.maskCanvas.width !== mw || this.maskCanvas.height !== mh) {
      this.maskCanvas.width = mw;
      this.maskCanvas.height = mh;
    }

    const img = this.maskCtx.createImageData(mw, mh);
    const data = img.data;
    for (let i = 0, p = 3; i < plantMask.length; i++, p += 4) {
      data[p] = plantMask[i] ? 255 : 0;
    }
    this.maskCtx.putImageData(img, 0, 0);

    if (this.sceneCanvas.width !== w || this.sceneCanvas.height !== h) {
      this.sceneCanvas.width = w;
      this.sceneCanvas.height = h;
    }
  }

  /**
   * An ellipse on the surface at the base of the plant.
   *
   * Drawn into a scratch layer, then the plant silhouette is erased from that
   * layer before it is composited. The far side of the ring therefore
   * disappears behind the real pot instead of being painted across it — which
   * is the difference between geometry that sits in the scene and geometry that
   * sits on the screen. The occlusion is real: it comes from the segmentation
   * mask, not from a guessed depth.
   */
  drawGroundRing(base, w, h) {
    const ctx = this.sceneCtx;
    ctx.clearRect(0, 0, w, h);

    const cx = base.x * w;
    // Sit the ring slightly above the silhouette's lowest point, where a pot
    // actually meets the surface rather than where its shadow ends.
    const cy = (base.y - 0.012) * h;
    const rx = Math.max(12, base.radius * w * 1.18);
    // Fixed foreshortening. Without a horizon estimate this is a constant, and
    // a constant that looks right beats a made-up per-frame "measurement".
    const ry = rx * 0.26;

    const scale = Math.min(w, h) / 900;
    const colour = CONTOUR_COLOR[this.status];

    ctx.save();
    ctx.globalAlpha = this.reveal * 0.55;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = this.reveal * 0.16;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 1.3, ry * 1.3, 0, 0, Math.PI * 2);
    ctx.lineWidth = 1 * scale;
    ctx.stroke();
    ctx.restore();

    // Punch the plant out of the ring layer.
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(this.maskCanvas, 0, 0, w, h);
    ctx.restore();

    this.ctx.drawImage(this.sceneCanvas, 0, 0);
  }

  drawContour(points, w, h) {
    const ctx = this.ctx;
    const colour = CONTOUR_COLOR[this.status];

    ctx.save();
    ctx.beginPath();

    // Closed Catmull-Rom-ish path via midpoint quadratics — the points are
    // already resampled evenly, so this stays smooth without overshoot.
    const start = midpoint(points[points.length - 1], points[0]);
    ctx.moveTo(start.x * w, start.y * h);

    for (let i = 0; i < points.length; i++) {
      const curr = points[i];
      const next = points[(i + 1) % points.length];
      const mid = midpoint(curr, next);
      ctx.quadraticCurveTo(curr.x * w, curr.y * h, mid.x * w, mid.y * h);
    }
    ctx.closePath();

    const scale = Math.min(w, h) / 900;

    // A single soft pass for depth, then a thin crisp line. No pulsing: a
    // breathing outline reads as an effect, a still one reads as a measurement.
    ctx.globalAlpha = this.reveal * 0.5;
    ctx.strokeStyle = colour;
    ctx.shadowColor = colour;
    ctx.shadowBlur = 14 * scale;
    ctx.lineWidth = 3.2 * scale;
    ctx.stroke();

    ctx.globalAlpha = this.reveal * 0.92;
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.5 * scale;
    ctx.stroke();

    ctx.restore();
  }

  drawStructure(points, w, h) {
    const ctx = this.ctx;
    // Size against the shorter edge of the *displayed* area, not the canvas
    // backing store: the camera canvas is often far smaller than the screen and
    // gets upscaled, which turned sub-pixel dots into chunky blocks.
    const displayMin = Math.min(this.canvas.clientWidth || w, this.canvas.clientHeight || h);
    const unit = displayMin / Math.min(w, h);
    const dot = Math.max(0.6, 2.0 / unit);

    ctx.save();
    ctx.globalAlpha = this.reveal * 0.42;
    ctx.fillStyle = 'rgba(214, 245, 226, 0.85)';

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, dot, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

/**
 * Keep the thickest `keepShare` of ridge points, then greedily drop any that
 * sit within `minSpacing` (normalised) of one already kept.
 */
function thin(points, { keepShare, minSpacing, max }) {
  if (points.length === 0) return [];

  const sorted = [...points].sort((a, b) => b.thickness - a.thickness);
  const candidates = sorted.slice(0, Math.max(1, Math.round(sorted.length * keepShare)));

  const kept = [];
  const spacingSq = minSpacing * minSpacing;

  for (const p of candidates) {
    if (kept.length >= max) break;

    let tooClose = false;
    for (let i = 0; i < kept.length; i++) {
      const dx = kept[i].x - p.x;
      const dy = kept[i].y - p.y;
      if (dx * dx + dy * dy < spacingSq) { tooClose = true; break; }
    }

    if (!tooClose) kept.push(p);
  }

  return kept;
}

function midpoint(a, b) {
  return { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
}
