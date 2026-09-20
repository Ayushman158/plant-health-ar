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

    setText(this.title, headlineFor(status, diag));
    setText(this.desc, summaryFor(diag, analysis));
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
    this.sheetStatus.innerHTML = `<span class="status-dot"></span>${detected ? statusLabel(status) : 'No plant detected'}`;

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

function statusFor(diag) {
  if (diag.category === 'necrosis') return 'concern';
  if (diag.category === 'chlorosis') return 'watch';
  if (diag.healthScore >= 85) return 'healthy';
  if (diag.healthScore >= 70) return 'watch';
  return 'concern';
}

function statusLabel(status) {
  return { healthy: 'Healthy', watch: 'Worth watching', concern: 'Needs attention' }[status] || 'Unknown';
}

function headlineFor(status, diag) {
  if (diag.category === 'necrosis') return 'Possible edge browning';
  if (diag.category === 'chlorosis') return 'Possible yellowing';
  if (diag.category === 'dim') return 'Low light';
  if (diag.category === 'bright') return 'Strong direct light';
  return status === 'healthy' ? 'Looks healthy' : 'Worth a closer look';
}

function summaryFor(diag, analysis) {
  switch (diag.category) {
    case 'chlorosis':
      return 'Some yellowing in the foliage. Check soil moisture and drainage.';
    case 'necrosis':
      return 'Dry, brown leaf margins. Often low humidity or dry air.';
    case 'dim':
      return `Room light reads around ${analysis.light?.lux} lx. Brighter indirect light would help.`;
    case 'bright':
      return `Light reads around ${analysis.light?.lux} lx. Shield it from harsh midday sun.`;
    default:
      return 'Your money plant looks vibrant with no major issues detected.';
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
