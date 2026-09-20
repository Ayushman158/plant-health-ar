import './index.css';
import { CameraStream } from './vision/cameraStream.js';
import { LeafDetector } from './vision/leafDetector.js';
import { LeafTracer } from './vision/leafTracer.js';
import { PinManager } from './spatial/pinManager.js';
import { ConditionCard } from './ui/conditionCard.js';
import { AiDocModal } from './ui/aiDocModal.js';

class MoneyPlantDocApp {
  constructor() {
    this.videoEl = document.getElementById('camera-video');
    this.displayCanvas = document.getElementById('display-canvas');
    this.tracerCanvas = document.getElementById('tracer-canvas');
    this.scanFrameEl = document.getElementById('spatial-scan-frame');
    this.statusPillEl = document.getElementById('spatial-status-pill');
    this.statusTextEl = document.getElementById('scanner-status-text');
    this.pinsContainer = document.getElementById('spatial-pins-layer');

    // Action Controls
    this.scanPlantBtn = document.getElementById('btn-scan-plant');
    this.galleryBtn = document.getElementById('btn-gallery');
    this.galleryFileInput = document.getElementById('gallery-file-input');
    this.tipsBtn = document.getElementById('btn-tips');
    this.tipsModal = document.getElementById('tips-modal');
    this.closeTipsBtn = document.getElementById('close-tips-btn');

    this.isDetected = false;
    this.latestAnalysis = null;

    // Vision Engines
    this.cameraStream = new CameraStream(this.videoEl, this.displayCanvas);
    this.leafDetector = new LeafDetector();
    this.leafTracer = new LeafTracer(this.tracerCanvas);

    // Spatial Leaf Annotations
    this.pinManager = new PinManager(this.pinsContainer, (pin) => {
      this.onLeafPinSelected(pin);
    });
    this.pinManager.setSourceCanvas(this.displayCanvas);

    // Primary Result Card & Diagnosis Sheet
    this.conditionCard = new ConditionCard(
      document.getElementById('condition-card-anchor'),
      document.getElementById('prescription-modal')
    );

    // AI Doctor Consultation Modal (Gemma)
    this.aiDocModal = new AiDocModal(
      document.getElementById('ai-doc-modal'),
      null // opened via diagnosis sheet button
    );

    // Wire up "Ask Plant Doctor" button inside diagnosis sheet
    this.conditionCard.setAiConsultCallback((analysis) => {
      this.aiDocModal.open();
    });

    this.initControls();
    this.init();
  }

  initControls() {
    // 1. Scan Plant Primary Action Button
    if (this.scanPlantBtn) {
      this.scanPlantBtn.addEventListener('click', () => {
        if (navigator.vibrate) navigator.vibrate([30, 50, 30]);

        // Capture high-resolution live snapshot from camera canvas
        const snapshot = this.cameraStream.captureSnapshot();

        // Update result card thumbnail
        const thumbImg = document.getElementById('result-card-thumb');
        if (thumbImg && snapshot) {
          thumbImg.src = snapshot;
        }

        // Open Apple-style Diagnosis Bottom Sheet
        this.conditionCard.openPrescription(this.latestAnalysis, snapshot);
      });
    }

    // 2. Gallery Button & File Upload
    if (this.galleryBtn && this.galleryFileInput) {
      this.galleryBtn.addEventListener('click', () => {
        if (navigator.vibrate) navigator.vibrate(15);
        this.galleryFileInput.click();
      });

      this.galleryFileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
          const dataUrl = event.target.result;
          await this.cameraStream.loadSpecimen(dataUrl);

          const thumbImg = document.getElementById('result-card-thumb');
          if (thumbImg) {
            thumbImg.src = dataUrl;
          }
        };
        reader.readAsDataURL(file);
      });
    }

    // 3. Tips Button & Bottom Sheet
    if (this.tipsBtn && this.tipsModal) {
      this.tipsBtn.addEventListener('click', () => {
        if (navigator.vibrate) navigator.vibrate(15);
        this.tipsModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
      });
    }

    if (this.closeTipsBtn && this.tipsModal) {
      this.closeTipsBtn.addEventListener('click', () => {
        this.tipsModal.classList.add('hidden');
        document.body.style.overflow = '';
      });

      this.tipsModal.addEventListener('click', (e) => {
        if (e.target === this.tipsModal) {
          this.tipsModal.classList.add('hidden');
          document.body.style.overflow = '';
        }
      });
    }
  }

  async init() {
    // Start computer vision rendering loop
    this.startLoop();

    // Request and start camera
    const cameraAvailable = await this.cameraStream.startCamera();
    if (!cameraAvailable) {
      // Graceful fallback to high-res specimen image if browser restricts camera
      await this.cameraStream.loadSpecimen('https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&w=1000&q=85');
    }
  }

  onLeafPinSelected(pin) {
    if (!pin) return;
    if (navigator.vibrate) navigator.vibrate(15);
  }

  startLoop() {
    let lastCvTime = 0;

    const render = (time) => {
      // 1. Render Video Frame from Camera
      const hasFrame = this.cameraStream.renderFrame();

      // 2. Real-Time Computer Vision Detection (~30 fps)
      if (hasFrame && time - lastCvTime > 30) {
        lastCvTime = time;
        this.latestAnalysis = this.leafDetector.analyze(this.displayCanvas);
        const analysis = this.latestAnalysis;

        if (analysis && analysis.detected) {
          const b = analysis.box;
          const diag = analysis.diagnosis || {};

          // Transition to DETECTED state
          if (!this.isDetected) {
            this.isDetected = true;
            this.scanFrameEl.classList.remove('idle');
            this.scanFrameEl.classList.add('locked');
            if (this.statusPillEl) {
              this.statusPillEl.className = 'status-pill-badge optimal';
            }
          }

          if (this.statusTextEl) {
            if (diag.healthScore >= 80) {
              this.statusTextEl.textContent = 'Healthy';
              if (this.statusPillEl) this.statusPillEl.className = 'status-pill-badge optimal';
            } else if (diag.healthScore >= 65) {
              this.statusTextEl.textContent = 'Moderate';
              if (this.statusPillEl) this.statusPillEl.className = 'status-pill-badge warning';
            } else {
              this.statusTextEl.textContent = 'Attention';
              if (this.statusPillEl) this.statusPillEl.className = 'status-pill-badge alert';
            }
          }

          // Dynamic contour tracer color
          const tracerColor = diag.healthScore >= 80 ? '#86efac' : (diag.healthScore >= 65 ? '#fed7aa' : '#fca5a5');
          this.leafTracer.setColor(tracerColor, diag.category);

          // Update primary result card
          this.conditionCard.updateLiveTelemetry(analysis);

          // Position minimal 4 corner brackets smoothly
          this.scanFrameEl.style.left = `${b.x * 100}%`;
          this.scanFrameEl.style.top = `${b.y * 100}%`;
          this.scanFrameEl.style.width = `${b.width * 100}%`;
          this.scanFrameEl.style.height = `${b.height * 100}%`;

          // Spatial leaf annotations
          if (analysis.dynamicPins && analysis.dynamicPins.length > 0) {
            this.pinManager.setPins(analysis.dynamicPins);
          }
        } else {
          // Transition to IDLE searching state
          if (this.isDetected) {
            this.isDetected = false;
            this.scanFrameEl.classList.remove('locked');
            this.scanFrameEl.classList.add('idle');
            if (this.statusPillEl) {
              this.statusPillEl.className = 'status-pill-badge searching';
            }
            if (this.statusTextEl) {
              this.statusTextEl.textContent = 'Scanning...';
            }

            this.scanFrameEl.style.left = '';
            this.scanFrameEl.style.top = '';
            this.scanFrameEl.style.width = '';
            this.scanFrameEl.style.height = '';

            this.pinManager.setPins([]);
          }

          if (analysis) {
            this.conditionCard.updateLiveTelemetry(analysis);
          }
        }
      }

      // 3. Render Smooth Glowing AR Outline, Central Marker & Keypoints
      this.leafTracer.render(this.latestAnalysis, this.displayCanvas);

      requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
  }
}

// Bootstrap application on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new MoneyPlantDocApp();
});
