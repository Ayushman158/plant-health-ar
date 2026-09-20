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
    this.reticleHintEl = document.getElementById('reticle-hint');
    this.statusPillEl = document.getElementById('spatial-status-pill');
    this.statusTextEl = document.getElementById('scanner-status-text');
    this.activeSpecimenLabel = document.getElementById('active-specimen-label');
    this.pinsContainer = document.getElementById('spatial-pins-layer');
    this.shutterBtn = document.getElementById('main-diagnose-btn');
    this.cameraFlipBtn = document.getElementById('camera-flip-btn');
    this.bottomAiBtn = document.getElementById('bottom-ai-chat-btn');

    this.isDetected = false;
    this.latestAnalysis = null;

    // Vision Engines
    this.cameraStream = new CameraStream(this.videoEl, this.displayCanvas);
    this.leafDetector = new LeafDetector();
    this.leafTracer = new LeafTracer(this.tracerCanvas);

    // Spatial Leaf Pins
    this.pinManager = new PinManager(this.pinsContainer, (pin) => {
      this.onLeafPinSelected(pin);
    });
    this.pinManager.setSourceCanvas(this.displayCanvas);

    // Live Floating Condition Card & Prescription
    this.conditionCard = new ConditionCard(
      document.getElementById('condition-card-anchor'),
      document.getElementById('prescription-modal')
    );

    // AI Doctor Consultation Modal
    this.aiDocModal = new AiDocModal(
      document.getElementById('ai-doc-modal'),
      this.bottomAiBtn
    );

    // Connect prescription modal's "Ask AI Doc" button
    this.conditionCard.setAiConsultCallback((analysis) => {
      this.aiDocModal.open();
    });

    this.initControls();
    this.init();
  }

  initControls() {
    // Camera Flip / Switcher
    if (this.cameraFlipBtn) {
      this.cameraFlipBtn.addEventListener('click', async () => {
        if (navigator.vibrate) navigator.vibrate(15);
        if (this.cameraFlipBtn) {
          this.cameraFlipBtn.disabled = true;
        }
        await this.cameraStream.flipCamera();
        if (this.cameraFlipBtn) {
          this.cameraFlipBtn.disabled = false;
        }
      });
    }

    // Shutter Scan & Diagnose Button
    if (this.shutterBtn) {
      this.shutterBtn.addEventListener('click', () => {
        if (navigator.vibrate) navigator.vibrate([25, 60, 25]);

        // Capture live frame snapshot from camera canvas
        const snapshot = this.cameraStream.captureSnapshot();

        // Trigger diagnostic clinical prescription modal
        this.conditionCard.openPrescription(this.latestAnalysis, snapshot);
      });
    }
  }

  async init() {
    // 1. Start computer vision rendering loop
    this.startLoop();

    // 2. Request and start live camera
    const cameraAvailable = await this.cameraStream.startCamera();
    if (cameraAvailable) {
      if (this.activeSpecimenLabel) {
        this.activeSpecimenLabel.textContent = 'Live Camera Active';
      }
    } else {
      if (this.activeSpecimenLabel) {
        this.activeSpecimenLabel.textContent = 'Camera Unavailable · Test Mode';
      }
      // Fallback to high-res specimen image if browser strictly blocks camera
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

      // 2. Run Real-Time Computer Vision Leaf Detection pass (~30 fps)
      if (hasFrame && time - lastCvTime > 28) {
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

          if (this.reticleHintEl) {
            this.reticleHintEl.textContent = analysis.distanceTip || 'Money Plant Locked';
          }
          if (this.statusTextEl) {
            this.statusTextEl.textContent = `${diag.healthScore}% Healthy`;
          }

          // Update dynamic color on tracer based on diagnosis
          const tracerColor = diag.healthScore >= 80 ? '#86efac' : (diag.healthScore >= 65 ? '#fed7aa' : '#fca5a5');
          this.leafTracer.setColor(tracerColor, diag.category);

          // Update live condition card telemetry and advice
          this.conditionCard.updateLiveTelemetry(analysis);

          // Update smooth tracking reticle box
          this.scanFrameEl.style.left = `${b.x * 100}%`;
          this.scanFrameEl.style.top = `${b.y * 100}%`;
          this.scanFrameEl.style.width = `${b.width * 100}%`;
          this.scanFrameEl.style.height = `${b.height * 100}%`;

          // Dynamically anchor AR pins on leaf foliage
          if (analysis.dynamicPins && analysis.dynamicPins.length > 0) {
            this.pinManager.setPins(analysis.dynamicPins);
          }
        } else {
          // Transition to IDLE state
          if (this.isDetected) {
            this.isDetected = false;
            this.scanFrameEl.classList.remove('locked');
            this.scanFrameEl.classList.add('idle');
            if (this.statusPillEl) {
              this.statusPillEl.className = 'status-pill-badge';
            }
            if (this.reticleHintEl) {
              this.reticleHintEl.textContent = 'Align Money Plant in Viewfinder';
            }
            if (this.statusTextEl) {
              this.statusTextEl.textContent = 'Searching...';
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

      // 3. Render Real-Time Luminous ASCII / Dot Matrix Leaf Tracing & Pixel-Trail
      this.leafTracer.render(this.latestAnalysis, this.displayCanvas);

      requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
  }
}

// Bootstrap Money Plant Doc application on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new MoneyPlantDocApp();
});

