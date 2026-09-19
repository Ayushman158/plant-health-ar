import './index.css';
import { PLANT_PROFILES } from './data/plantProfiles.js';
import { CameraStream } from './vision/cameraStream.js';
import { LeafDetector } from './vision/leafDetector.js';
import { LeafTracer } from './vision/leafTracer.js';
import { NdviFilter } from './vision/ndviFilter.js';
import { PinManager } from './spatial/pinManager.js';
import { PlantSpeechBubble } from './ui/plantSpeechBubble.js';
import { ConditionCard } from './ui/conditionCard.js';
import { AiDocModal } from './ui/aiDocModal.js';
import { SegmentedControl } from './ui/segmentedControl.js';
import { PlantDeck } from './ui/plantDeck.js';

class MoneyPlantDocApp {
  constructor() {
    this.videoEl = document.getElementById('camera-video');
    this.displayCanvas = document.getElementById('display-canvas');
    this.tracerCanvas = document.getElementById('tracer-canvas');
    this.spectralCanvas = document.getElementById('spectral-canvas');
    this.scanFrameEl = document.getElementById('spatial-scan-frame');
    this.reticleHintEl = document.getElementById('reticle-hint');
    this.statusPillEl = document.getElementById('spatial-status-pill');
    this.activeSpecimenLabel = document.getElementById('active-specimen-label');
    this.pinsContainer = document.getElementById('spatial-pins-layer');
    this.shutterBtn = document.getElementById('main-diagnose-btn');
    this.deckContainer = document.getElementById('specimen-deck-container');
    this.specimensToggleBtn = document.getElementById('specimens-toggle-btn');
    this.bottomAiBtn = document.getElementById('bottom-ai-chat-btn');

    this.activePlantId = 'money_plant';
    this.activeMode = 'tracer'; // 'scan' | 'tracer' | 'rx'
    this.isDetected = false;

    // Vision Engines
    this.cameraStream = new CameraStream(this.videoEl, this.displayCanvas);
    this.leafDetector = new LeafDetector();
    this.leafTracer = new LeafTracer(this.tracerCanvas);
    this.ndviFilter = new NdviFilter(this.spectralCanvas);

    // Spatial Leaf Pins
    this.pinManager = new PinManager(this.pinsContainer, (pin) => {
      this.onLeafPinSelected(pin);
    });
    this.pinManager.setSourceCanvas(this.displayCanvas);

    // Conversational Plant Speech Bubble
    this.speechBubble = new PlantSpeechBubble(document.getElementById('plant-speech-bubble'));

    // Planto Minimal Floating Condition Card & Prescription
    this.conditionCard = new ConditionCard(
      document.getElementById('condition-card-anchor'),
      document.getElementById('prescription-modal')
    );

    // AI Doctor Consultation Modal (Gemma-Powered)
    this.aiDocModal = new AiDocModal(
      document.getElementById('ai-doc-modal'),
      this.bottomAiBtn
    );

    // Mode Selector
    this.segmentedControl = new SegmentedControl(
      document.getElementById('mode-segmented-control'),
      (mode) => this.onModeChanged(mode)
    );

    // Specimen Deck Carousel
    this.plantDeck = new PlantDeck(this.deckContainer, PLANT_PROFILES, (sel) => {
      this.onSourceSelected(sel);
    });

    this.initDrawer();
    this.initShutter();
    this.init();
  }

  initDrawer() {
    if (!this.specimensToggleBtn) return;
    this.specimensToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deckContainer.classList.toggle('collapsed');
      const isCollapsed = this.deckContainer.classList.contains('collapsed');
      const arrow = this.specimensToggleBtn.querySelector('.specimen-arrow');
      if (arrow) arrow.textContent = isCollapsed ? '▾' : '▴';
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.specimens-trigger-wrapper')) {
        this.deckContainer.classList.add('collapsed');
        const arrow = this.specimensToggleBtn.querySelector('.specimen-arrow');
        if (arrow) arrow.textContent = '▾';
      }
    });
  }

  initShutter() {
    if (!this.shutterBtn) return;
    this.shutterBtn.addEventListener('click', () => {
      if (navigator.vibrate) navigator.vibrate([20, 50, 20]);

      // Trigger diagnostic flash & open prescription
      this.conditionCard.openPrescription();
    });
  }

  async init() {
    // 1. Initial plant profile load
    this.loadPlantProfile(this.activePlantId);

    // 2. Start animation & CV loop
    this.startLoop();

    // 3. Try starting camera, fallback to high-res specimen
    const cameraAvailable = await this.cameraStream.startCamera();
    if (cameraAvailable) {
      this.plantDeck.setSelection(this.activePlantId, true);
    } else {
      await this.cameraStream.loadSpecimen(PLANT_PROFILES[this.activePlantId].specimenImage);
    }
  }

  loadPlantProfile(plantId) {
    const profile = PLANT_PROFILES[plantId];
    if (!profile) return;

    this.activePlantId = plantId;
    this.activeSpecimenLabel.textContent = profile.commonName || profile.name;

    this.leafTracer.setColor(profile.colorScheme?.primary || '#86efac', profile.status);
    this.conditionCard.setProfile(profile);
    this.aiDocModal.setPlant(profile);
    this.pinManager.setPins(profile.pins || []);

    // Update status badge
    const statusDot = this.statusPillEl.querySelector('.status-dot');
    const statusLabel = this.statusPillEl.querySelector('.status-label');
    if (statusDot) statusDot.style.background = profile.colorScheme?.primary || '#86efac';
    if (statusLabel) {
      statusLabel.textContent = `${profile.vigor}% ${profile.statusLabel || 'Healthy'}`;
      statusLabel.style.color = profile.colorScheme?.primary || '#86efac';
    }

    if (!this.cameraStream.isLiveCamera) {
      this.cameraStream.loadSpecimen(profile.specimenImage);
    }
  }

  onModeChanged(mode) {
    this.activeMode = mode;

    if (mode === 'rx') {
      this.conditionCard.openPrescription();
    } else if (mode === 'scan') {
      this.spectralCanvas.classList.remove('active');
    } else if (mode === 'tracer') {
      this.conditionCard.closePrescription();
      this.spectralCanvas.classList.remove('active');
    }
  }

  async onSourceSelected(selection) {
    this.deckContainer.classList.add('collapsed');
    const arrow = this.specimensToggleBtn?.querySelector('.specimen-arrow');
    if (arrow) arrow.textContent = '▾';

    if (selection === 'camera') {
      const ok = await this.cameraStream.startCamera();
      if (!ok) {
        alert('Camera access unavailable on this device. Reverting to specimen mode.');
        this.plantDeck.setSelection(this.activePlantId, false);
      }
    } else {
      this.cameraStream.stopCamera();
      this.loadPlantProfile(selection);
    }
  }

  onLeafPinSelected(pin) {
    if (!pin) return;
    if (navigator.vibrate) navigator.vibrate(15);
  }

  startLoop() {
    let lastCvTime = 0;
    let latestAnalysis = null;

    const render = (time) => {
      // 1. Render Video or High-Res Botanical Specimen
      const hasFrame = this.cameraStream.renderFrame();

      // 2. Run Computer Vision Leaf Detection pass (~30-60 fps)
      if (hasFrame && time - lastCvTime > 25) {
        lastCvTime = time;
        latestAnalysis = this.leafDetector.analyze(this.displayCanvas);

        if (latestAnalysis && latestAnalysis.detected) {
          const b = latestAnalysis.box;
          const p = PLANT_PROFILES[this.activePlantId] || PLANT_PROFILES.money_plant;

          // Transition to DETECTED state
          if (!this.isDetected) {
            this.isDetected = true;
            this.scanFrameEl.classList.remove('idle');
            this.scanFrameEl.classList.add('locked');
            this.reticleHintEl.textContent = `${p.name} Focused`;
          }

          // Update Conversational Speech Bubble & Condition Card
          this.speechBubble.update(p, latestAnalysis);
          this.conditionCard.updateLiveTelemetry(latestAnalysis);

          // Update smooth tracking reticle box
          this.scanFrameEl.style.left = `${b.x * 100}%`;
          this.scanFrameEl.style.top = `${b.y * 100}%`;
          this.scanFrameEl.style.width = `${b.width * 100}%`;
          this.scanFrameEl.style.height = `${b.height * 100}%`;

          // Dynamically anchor AR pins on leaf foliage
          if (latestAnalysis.dynamicPins && latestAnalysis.dynamicPins.length > 0) {
            this.pinManager.setPins(latestAnalysis.dynamicPins);
          }
        } else {
          // Transition to IDLE state
          if (this.isDetected) {
            this.isDetected = false;
            this.scanFrameEl.classList.remove('locked');
            this.scanFrameEl.classList.add('idle');
            this.reticleHintEl.textContent = 'Place Money Plant in focus';

            this.scanFrameEl.style.left = '';
            this.scanFrameEl.style.top = '';
            this.scanFrameEl.style.width = '';
            this.scanFrameEl.style.height = '';
          }
          this.speechBubble.update(null, null);
        }

        // Spectral NDVI pass if requested
        if (this.spectralCanvas.classList.contains('active')) {
          this.ndviFilter.process(this.displayCanvas);
        }
      }

      // 3. Render Real-Time Luminous ASCII / Dot Matrix Leaf Tracing & Pixel-Trail
      this.leafTracer.render(latestAnalysis, this.displayCanvas);

      requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
  }
}

// Bootstrap Money Plant Doc application on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new MoneyPlantDocApp();
});
