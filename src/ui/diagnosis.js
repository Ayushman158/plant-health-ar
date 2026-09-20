/**
 * Diagnosis — the result card and the detail sheet.
 *
 * Both read the same analysis. The wording is deliberately hedged ("possible",
 * "estimate", "visible signs") because every number here comes from leaf colour
 * and frame brightness, not from a soil probe or a light meter. Where the old
 * UI showed "Hydration: Good", nothing in the pipeline measured hydration — the
 * value was a relabelling of leaf colour — so that tile now reports ambient
 * light, which is actually derived from the frame.
 */

import { Sheet } from './sheet.js';
import { statusFor, statusSheetLabel, headlineFor, summaryFor } from './status.js';

const DISCLOSURE =
  'Estimated from leaf colour and frame brightness in the camera image. ' +
  'This is a visual indication, not a soil, nutrient or light measurement.';

export class Diagnosis {
  constructor({ cardWrap, card, sheetRoot }) {
    this.cardWrap = cardWrap;
    this.card = card;
    this.sheet = new Sheet(sheetRoot);

    this.title = document.getElementById('result-title');
    this.desc = document.getElementById('result-desc');
    this.score = document.getElementById('result-score');

    this.sheetStatus = document.getElementById('diagnosis-status');
    this.metricVitality = document.getElementById('metric-vitality');
    this.metricFoliage = document.getElementById('metric-foliage');
    this.metricLight = document.getElementById('metric-light');
    this.metricConcerns = document.getElementById('metric-concerns');
    this.tipWater = document.getElementById('tip-water');
    this.tipLight = document.getElementById('tip-light');
    this.disclosure = document.getElementById('diagnosis-disclosure');

    this.captureFrame = document.getElementById('capture-frame');
    this.captureImage = document.getElementById('capture-image');

    this.latest = null;
    this.card.addEventListener('click', () => this.openSheet());
  }

  /** Live card content. Called on every analysis tick. */
  update(analysis) {
    this.latest = analysis;

    if (!analysis?.detected) {
      this.cardWrap.classList.remove('is-visible');
      return;
    }

    const diag = analysis.diagnosis || {};
    const status = statusFor(diag);
    const score = diag.healthScore;

    this.cardWrap.classList.add('is-visible');
    this.card.dataset.status = status;

    setText(this.title, headlineFor(diag, status));
    setText(this.desc, summaryFor(diag, analysis, status));
    setText(this.score, `${score}%`);
  }

  openSheet(snapshotDataUrl = null) {
    const analysis = this.latest;
    const diag = analysis?.diagnosis || {};
    const detected = Boolean(analysis?.detected);
    const status = detected ? statusFor(diag) : 'idle';

    if (snapshotDataUrl) {
      this.captureImage.src = snapshotDataUrl;
      this.captureFrame.hidden = false;
    } else {
      this.captureFrame.hidden = true;
    }

    this.sheetStatus.dataset.status = status;
    this.sheetStatus.innerHTML = `<span class="status-dot"></span>${detected ? statusSheetLabel(status) : 'No plant detected'}`;

    setText(this.metricVitality, detected ? `${diag.healthScore}%` : '—');
    setText(this.metricFoliage, detected ? foliageLabel(diag) : '—');
    setText(this.metricLight, detected ? (analysis.light?.label ?? '—') : '—');
    setText(this.metricConcerns, detected ? concernLabel(diag) : '—');

    setText(this.tipWater, diag.category === 'chlorosis'
      ? 'Let the top 2–3 cm of soil dry out fully before watering again.'
      : 'Water when the top 2–3 cm of soil becomes dry.');

    setText(this.tipLight, diag.category === 'dim'
      ? 'Move it nearer a window with filtered, indirect light.'
      : 'Keep in bright, indirect light.');

    const basis = detected && analysis.source === 'segmentation'
      ? 'Plant located with on-device image segmentation. '
      : detected
        ? 'Plant located by leaf-colour analysis only; segmentation is unavailable on this device. '
        : '';

    setText(this.disclosure, basis + DISCLOSURE);

    this.sheet.open();
  }
}





function foliageLabel(diag) {
  if (diag.category === 'chlorosis') return 'Yellowing';
  if (diag.category === 'necrosis') return 'Dry margins';
  return 'Healthy';
}

function concernLabel(diag) {
  if (diag.category === 'chlorosis') return 'Possible overwatering';
  if (diag.category === 'necrosis') return 'Dry leaf tips';
  // Light has its own tile; repeating it here just filled two cells with the
  // same words. This tile is specifically about the foliage.
  if (diag.category === 'dim' || diag.category === 'bright') return 'None on the foliage';
  return 'None detected';
}

function setText(el, value) {
  if (el && el.textContent !== value) el.textContent = value;
}
