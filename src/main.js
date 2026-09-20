import './index.css';

import { CameraStream } from './vision/cameraStream.js';
import { PlantAnalyzer } from './vision/plantAnalyzer.js';
import { ArOverlay } from './ui/arOverlay.js';
import { LeafMarkers } from './ui/leafMarkers.js';
import { Diagnosis } from './ui/diagnosis.js';
import { Sheet } from './ui/sheet.js';
import { coverTransform } from './ui/viewportMap.js';
import { statusFor, statusChipLabel } from './ui/status.js';

/** Vision runs at ~30 Hz; the overlay still draws every frame. */
const ANALYSIS_INTERVAL_MS = 33;
/** How long "Plant detected" shows before the guidance layer clears. */
const DETECTED_HOLD_MS = 900;
/** Frames the structure skeleton is reused before recomputing. */
const STRUCTURE_INTERVAL_MS = 240;

class App {
  constructor() {
    this.stage = document.getElementById('stage');
    this.video = document.getElementById('camera-video');
    this.displayCanvas = document.getElementById('display-canvas');

    this.analyzer = new PlantAnalyzer();
    this.camera = new CameraStream(this.video, this.displayCanvas);
    this.overlay = new ArOverlay(document.getElementById('ar-canvas'));

    this.markers = new LeafMarkers(document.getElementById('marker-layer'));

    this.diagnosis = new Diagnosis({
      cardWrap: document.getElementById('result-card-wrap'),
      card: document.getElementById('result-card'),
      sheetRoot: document.getElementById('diagnosis-sheet'),
    });

    this.tipsSheet = new Sheet(document.getElementById('tips-sheet'));

    this.guidance = document.getElementById('guidance');
    this.guidanceTitle = document.getElementById('guidance-title');
    this.guidanceBody = document.getElementById('guidance-body');
    this.statusChip = document.getElementById('status-chip');
    this.statusText = document.getElementById('status-text');
    this.scanButton = document.getElementById('btn-scan');
    this.structureButton = document.getElementById('btn-structure');

    /** 'searching' | 'detected' | 'tracking' */
    this.phase = 'searching';
    this.detectedAt = 0;
    this.lastAnalysisAt = 0;
    this.lastStructureAt = 0;
    this.latest = null;

    this.bindControls();
    this.start();
  }

  bindControls() {
    this.scanButton.addEventListener('click', () => this.capture());

    document.getElementById('btn-tips').addEventListener('click', () => {
      if (navigator.vibrate) navigator.vibrate(12);
      this.tipsSheet.open();
    });

    const galleryInput = document.getElementById('gallery-input');
    document.getElementById('btn-gallery').addEventListener('click', () => galleryInput.click());

    galleryInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        await this.camera.loadSpecimen(event.target.result);
        // A still image has no motion, so previously tracked anchors are
        // meaningless against it.
        this.analyzer.reset();
        this.markers.clear();
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    });

    this.structureButton.addEventListener('click', () => {
      const enabled = this.structureButton.getAttribute('aria-pressed') !== 'true';
      this.structureButton.setAttribute('aria-pressed', String(enabled));
      this.overlay.setStructureMode(enabled);
      if (navigator.vibrate) navigator.vibrate(12);
    });

    // Drop the flow history when the camera has been paused — the next frame
    // is unrelated to the last one, and tracking across that gap is nonsense.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.analyzer.reset();
    });
  }

  async start() {
    this.loop();

    const ok = await this.camera.startCamera();
    if (!ok) {
      this.setGuidance('Camera unavailable', 'Allow camera access, or choose a photo from your gallery.');
    }

    // Segmentation loads after the camera so the viewfinder is live first; the
    // colour pass carries detection until the model is ready.
    await this.analyzer.loadSegmenter();
  }

  capture() {
    if (navigator.vibrate) navigator.vibrate([24, 40, 24]);

    this.stage.classList.add('is-capturing');
    setTimeout(() => this.stage.classList.remove('is-capturing'), 320);

    this.diagnosis.openSheet(this.camera.captureSnapshot());
  }

  setPhase(phase) {
    if (this.phase === phase) return;
    this.phase = phase;

    if (phase === 'detected') {
      this.detectedAt = performance.now();
      this.setGuidance('Plant detected', 'Hold steady while the scan settles.');
      this.guidance.classList.add('is-visible');
      if (navigator.vibrate) navigator.vibrate(18);
    } else if (phase === 'searching') {
      this.setGuidance('Find a plant', 'Point your camera at a plant to start scanning.');
      this.guidance.classList.add('is-visible');
      this.markers.clear();
    }
  }

  setGuidance(title, body) {
    if (this.guidanceTitle.textContent !== title) this.guidanceTitle.textContent = title;
    if (this.guidanceBody.textContent !== body) this.guidanceBody.textContent = body;
  }

  setStatus(status, label) {
    if (this.statusChip.dataset.status !== status) this.statusChip.dataset.status = status;
    if (this.statusText.textContent !== label) this.statusText.textContent = label;
  }

  loop = () => {
    const now = performance.now();
    const hasFrame = this.camera.renderFrame();

    if (hasFrame && now - this.lastAnalysisAt >= ANALYSIS_INTERVAL_MS) {
      this.lastAnalysisAt = now;
      // Segment the video element directly when live (MediaPipe can decode it
      // without a readback), and the composited canvas otherwise, so gallery
      // photos get real segmentation rather than silently falling back.
      this.latest = this.analyzer.analyze(
        this.displayCanvas,
        this.camera.isLiveCamera ? this.video : this.displayCanvas,
        now,
      );
      this.applyAnalysis(this.latest, now);
    }

    if (this.latest) {
      this.overlay.render(this.latest, this.displayCanvas, now);
      this.positionMarkers();
    }

    requestAnimationFrame(this.loop);
  };

  applyAnalysis(analysis, now) {
    if (!analysis) return;

    if (!analysis.detected) {
      this.setPhase('searching');
      this.setStatus('idle', 'Searching');
      this.diagnosis.update(analysis);
      this.markers.update([], this.transform());
      return;
    }

    if (this.phase === 'searching') this.setPhase('detected');

    if (this.phase === 'detected' && now - this.detectedAt > DETECTED_HOLD_MS) {
      this.phase = 'tracking';
      this.guidance.classList.remove('is-visible');
    }

    const status = statusFor(analysis.diagnosis);
    this.overlay.setStatus(status);
    this.setStatus(status, statusChipLabel(status));

    if (this.overlay.structureMode && now - this.lastStructureAt > STRUCTURE_INTERVAL_MS) {
      this.lastStructureAt = now;
      const seg = this.analyzer.segmenter;
      if (seg.hasMask()) this.overlay.updateStructure(seg.mask, seg.width, seg.height);
    }

    this.diagnosis.update(analysis);
    this.scanButton.dataset.armed = 'true';
  }

  transform() {
    return coverTransform(
      this.displayCanvas.width,
      this.displayCanvas.height,
      window.innerWidth,
      window.innerHeight,
    );
  }

  positionMarkers() {
    if (!this.latest?.detected || this.phase === 'searching') {
      this.markers.update([], this.transform());
      return;
    }

    const transform = this.transform();
    this.markers.update(this.latest.leaves || [], transform);

    // Flip a marker's card inboard when it would otherwise run off the right
    // edge. Done here rather than in CSS because it depends on live position.
    for (const [, entry] of this.markers.elements) {
      const x = entry.root.getBoundingClientRect().left;
      entry.root.classList.toggle('flip-left', x > window.innerWidth * 0.55);
    }
  }
}



window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  // Debug handle: harmless in production and invaluable when diagnosing the
  // vision pipeline on a real device, where there is no other way to look in.
  window.__plantApp = app;
});
