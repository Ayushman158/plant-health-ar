/**
 * LeafMarkers — the DOM half of the AR layer.
 *
 * One small marker per tracked leaf region, positioned through the cover
 * transform so it sits on the actual leaf, and reusing its element across
 * frames so the browser can keep it composited instead of rebuilding the layer
 * 60 times a second. (The previous implementation cleared `innerHTML` and
 * recreated every pin each frame, which also meant a marker could never be
 * mid-tap.)
 *
 * Tapping a marker opens a compact card next to it. The card shows only what
 * was actually measured for that region.
 */

import { toScreen } from './viewportMap.js';

/** Matches the region status threshold in leafAnchors.js, so the card's status
 *  line and its colour row cannot describe the same leaf differently. */
const YELLOWING_THRESHOLD = 16;

const STATUS_TEXT = {
  healthy: 'Healthy',
  watch: 'Possible yellowing',
  concern: 'Possible browning',
  unknown: 'Not analysed',
};

export class LeafMarkers {
  constructor(container) {
    this.container = container;
    this.elements = new Map();
    this.selectedId = null;

    this.container.addEventListener('click', (e) => {
      const marker = e.target.closest('.leaf-marker');
      if (!marker) {
        this.select(null);
        return;
      }
      const { id } = marker.dataset;
      this.select(this.selectedId === id ? null : id);
    });
  }

  select(id) {
    if (this.selectedId === id) return;
    this.selectedId = id;

    for (const [markerId, el] of this.elements) {
      el.root.classList.toggle('is-open', markerId === id);
    }

    if (navigator.vibrate && id) navigator.vibrate(12);
  }

  /**
   * @param leaves tracked anchors from LeafAnchors
   * @param transform cover transform for the current frame and viewport
   */
  update(leaves, transform) {
    const seen = new Set();

    for (const leaf of leaves) {
      seen.add(leaf.id);
      let entry = this.elements.get(leaf.id);

      if (!entry) {
        entry = this.createMarker(leaf);
        this.elements.set(leaf.id, entry);
        this.container.appendChild(entry.root);
        // Next frame, so the entrance transition has a starting state to run from.
        requestAnimationFrame(() => entry.root.classList.add('is-present'));
      }

      const { x, y } = toScreen(leaf.x, leaf.y, transform);
      entry.root.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
      entry.root.classList.toggle('is-drifting', !leaf.tracked);

      this.updateContent(entry, leaf);
    }

    for (const [id, entry] of this.elements) {
      if (seen.has(id)) continue;
      entry.root.classList.remove('is-present');
      entry.root.addEventListener('transitionend', () => entry.root.remove(), { once: true });
      // Belt and braces: if the transition never fires (tab hidden, reduced
      // motion), the node would otherwise leak.
      setTimeout(() => entry.root.remove(), 400);
      this.elements.delete(id);
      if (this.selectedId === id) this.select(null);
    }
  }

  createMarker(leaf) {
    const root = document.createElement('div');
    root.className = 'leaf-marker';
    root.dataset.id = leaf.id;

    root.innerHTML = `
      <button type="button" class="leaf-marker-dot" aria-expanded="false">
        <span class="leaf-marker-ring"></span>
        <span class="leaf-marker-core"></span>
      </button>
      <div class="leaf-marker-card" role="group">
        <div class="leaf-marker-head">
          <span class="leaf-marker-name"></span>
          <span class="leaf-marker-status"><span class="leaf-status-dot"></span><span class="leaf-status-text"></span></span>
        </div>
        <dl class="leaf-marker-metrics"></dl>
      </div>
    `;

    return {
      root,
      button: root.querySelector('.leaf-marker-dot'),
      name: root.querySelector('.leaf-marker-name'),
      statusText: root.querySelector('.leaf-status-text'),
      metrics: root.querySelector('.leaf-marker-metrics'),
      lastSignature: '',
    };
  }

  updateContent(entry, leaf) {
    const health = leaf.health || {};
    const status = health.status || 'unknown';
    const name = `Leaf ${String(leaf.ordinal).padStart(2, '0')}`;

    entry.root.dataset.status = status;
    entry.button.setAttribute(
      'aria-label',
      `${name}, ${health.label || STATUS_TEXT[status]}. Tap for detail.`,
    );

    // Text writes are the expensive part; skip them unless something changed.
    const signature = `${status}|${health.label}|${health.chlorosisRate}|${health.necrosisRate}|${health.variegationRate}`;
    if (signature === entry.lastSignature) return;
    entry.lastSignature = signature;

    entry.name.textContent = name;
    entry.statusText.textContent = health.label || STATUS_TEXT[status];

    if (status === 'unknown') {
      entry.metrics.innerHTML = `<div class="leaf-metric"><dt>Colour</dt><dd>Too few pixels to read</dd></div>`;
      return;
    }

    entry.metrics.innerHTML = `
      <div class="leaf-metric"><dt>Colour</dt><dd>${describeColour(health)}</dd></div>
      <div class="leaf-metric"><dt>Edge browning</dt><dd>${describeBrowning(health.necrosisRate)}</dd></div>
      <div class="leaf-metric leaf-metric-note"><dt>Basis</dt><dd>Colour of ${health.samples} sampled points</dd></div>
    `;
  }

  clear() {
    for (const [, entry] of this.elements) entry.root.remove();
    this.elements.clear();
    this.selectedId = null;
  }
}

function describeColour(health) {
  if (health.chlorosisRate >= YELLOWING_THRESHOLD) return `Yellowing across ${health.chlorosisRate}%`;
  if (health.variegationRate >= 25) return `Variegated, ${health.variegationRate}% gold`;
  return 'Mostly normal';
}

function describeBrowning(rate) {
  if (!rate) return 'None seen';
  if (rate >= 20) return 'Noticeable';
  if (rate >= 10) return 'Minor';
  return 'Trace';
}
