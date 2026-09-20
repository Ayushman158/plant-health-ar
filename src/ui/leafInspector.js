/**
 * LeafInspector — the frozen-frame leaf inspection flow.
 *
 * Holds the current frame, runs SAM once on it, traces the exact leaf under
 * the tapped point, and reports colour metrics counted inside that mask rather
 * than inside a blob's bounding box.
 *
 * Freezing is a design choice, not a limitation to apologise for: the mask
 * belongs to one specific frame, so showing it over a moving feed would drift
 * away from the leaf it describes. Holding the frame makes the reading and the
 * picture agree.
 */

import { silhouette, labelComponents } from '../vision/maskAnalysis.js';
import { healthWithin } from '../vision/leafHealth.js';
import { toFrame } from './viewportMap.js';

export class LeafInspector {
  constructor({ segmenter, stage, onStateChange }) {
    this.segmenter = segmenter;
    this.stage = stage;
    this.onStateChange = onStateChange;

    this.active = false;
    this.busy = false;
    this.outline = [];
    this.result = null;

    this.panel = document.getElementById('inspect-panel');
    this.titleEl = document.getElementById('inspect-title');
    this.statusEl = document.getElementById('inspect-status');
    this.bodyEl = document.getElementById('inspect-body');
    this.progressEl = document.getElementById('inspect-progress');
    this.closeBtn = document.getElementById('inspect-close');

    this.closeBtn.addEventListener('click', () => this.exit());

    this.segmenter.onProgress = (fraction) => {
      this.progressEl.style.setProperty('--progress', `${Math.round(fraction * 100)}%`);
    };
  }

  /**
   * @param frameCanvas the live camera canvas, sampled now and held
   * @param colourStats the colour label mask for this frame
   * @param point normalised {x, y} on the frame
   * @param leafName label to show, e.g. "Leaf 02"
   */
  async inspect(frameCanvas, colourStats, point, leafName) {
    if (this.busy) return;
    this.busy = true;

    this.active = true;
    this.result = null;
    this.outline = [];
    this.stage.classList.add('is-inspecting');
    this.panel.hidden = false;
    requestAnimationFrame(() => this.panel.classList.add('is-open'));
    this.onStateChange?.(true);

    this.titleEl.textContent = leafName || 'Leaf';
    this.setPhase('loading', 'Loading the leaf model…');

    try {
      const ready = await this.segmenter.load();
      if (!ready) {
        this.setPhase('failed', 'Leaf tracing is unavailable on this device.');
        this.bodyEl.innerHTML = `<p class="inspect-note">The precise-outline model could not load. The live leaf markers still work — they use region detection rather than per-leaf segmentation.</p>`;
        return;
      }

      this.setPhase('working', 'Tracing the leaf…');
      await this.segmenter.encode(frameCanvas);

      const segmented = await this.segmenter.segmentAt(point.x, point.y);
      if (!segmented) {
        this.setPhase('failed', 'Could not trace that leaf.');
        this.bodyEl.innerHTML = `<p class="inspect-note">Try tapping nearer the centre of a leaf.</p>`;
        return;
      }

      this.buildOutline(segmented);
      this.report(segmented, colourStats);
    } catch (err) {
      console.warn('[LeafInspector] failed:', err);
      this.setPhase('failed', 'Leaf tracing failed.');
      this.bodyEl.innerHTML = `<p class="inspect-note">${escapeHtml(err?.message || 'Unknown error')}</p>`;
    } finally {
      this.busy = false;
    }
  }

  buildOutline(segmented) {
    const { mask, width, height } = segmented;

    // SAM can return a few disconnected specks alongside the leaf; trace the
    // largest component so the outline is the leaf, not the noise.
    const minArea = Math.round(width * height * 0.0015);
    const { components } = labelComponents(mask, width, height, minArea);
    if (components.length === 0) return;

    this.outline = silhouette(mask, width, height, components[0], {
      epsilon: 1.8,
      smoothing: 3,
    });
    this.maskInfo = { mask, width, height, component: components[0] };
  }

  report(segmented, colourStats) {
    const { mask, width, height } = segmented;

    const inMask = (nx, ny) => {
      const px = Math.min(width - 1, Math.max(0, Math.round(nx * width)));
      const py = Math.min(height - 1, Math.max(0, Math.round(ny * height)));
      return mask[py * width + px] === 1;
    };

    const bounds = this.maskInfo?.component?.bbox;
    const health = healthWithin(colourStats, inMask, bounds);
    this.result = health;

    const area = this.maskInfo?.component?.area ?? 0;
    const sharePercent = ((area / (width * height)) * 100).toFixed(1);

    this.setPhase('done', health.label);
    this.statusEl.dataset.status = health.status;

    if (health.status === 'unknown') {
      this.bodyEl.innerHTML = `<p class="inspect-note">Traced, but too few foliage pixels inside the outline to report colour.</p>`;
      return;
    }

    this.bodyEl.innerHTML = `
      <dl class="inspect-metrics">
        ${metric('Yellowing', `${health.chlorosisRate}%`)}
        ${metric('Edge browning', `${health.necrosisRate}%`)}
        ${metric('Variegation', `${health.variegationRate}%`)}
        ${metric('Leaf area', `${sharePercent}% of frame`)}
      </dl>
      <p class="inspect-note">
        Counted inside the traced outline, from ${health.samples} foliage pixels.
        Outline confidence ${(segmented.score * 100).toFixed(0)}%.
      </p>
    `;
  }

  setPhase(phase, text) {
    this.panel.dataset.phase = phase;
    this.statusEl.textContent = text;
    if (phase !== 'done') this.statusEl.dataset.status = '';
    if (phase !== 'loading') this.progressEl.style.removeProperty('--progress');
  }

  exit() {
    if (!this.active) return;
    this.active = false;
    this.outline = [];
    this.result = null;
    this.maskInfo = null;
    this.segmenter.clearFrame();

    this.stage.classList.remove('is-inspecting');
    this.panel.classList.remove('is-open');
    setTimeout(() => { if (!this.active) this.panel.hidden = true; }, 320);
    this.onStateChange?.(false);
  }

  /** Map a tap in viewport pixels to a normalised frame point. */
  static pointFromTap(clientX, clientY, transform) {
    return toFrame(clientX, clientY, transform);
  }
}

function metric(label, value) {
  return `<div class="inspect-metric"><dt>${label}</dt><dd>${value}</dd></div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
