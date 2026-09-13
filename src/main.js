import './index.css';
import { PLANT_PROFILES } from './data/plantProfiles.js';
import { CameraStream } from './vision/cameraStream.js';
import { LeafDetector } from './vision/leafDetector.js';
import { NdviFilter } from './vision/ndviFilter.js';
import { GyroParallax } from './spatial/gyroParallax.js';
import { PinManager } from './spatial/pinManager.js';
import { GlassCards } from './ui/glassCards.js';
import { SegmentedControl } from './ui/segmentedControl.js';
import { PlantDeck } from './ui/plantDeck.js';

class PlantVisionApp {
  constructor() {
    this.videoEl = document.getElementById('camera-video');
    this.displayCanvas = document.getElementById('display-canvas');
    this.spectralCanvas = document.getElementById('spectral-canvas');
    this.scanFrameEl = document.getElementById('spatial-scan-frame');
    this.pinsContainer = document.getElementById('spatial-pins-layer');
    this.cardAnchorEl = document.getElementById('spatial-card-anchor');
    this.cardClusterEl = document.getElementById('spatial-card-cluster');
    this.statusPillEl = document.getElementById('spatial-status-pill');
    this.statusTextEl = this.statusPillEl.querySelector('.status-text-content');
    this.segContainer = document.getElementById('mode-segmented-control');
    this.deckContainer = document.getElementById('specimen-deck-container');
    this.specimensToggleBtn = document.getElementById('specimens-toggle-btn');

    this.activePlantId = 'money_plant';
    this.activeMode = 'vigor';
    this.isDetected = false;

    this.cameraStream = new CameraStream(this.videoEl, this.displayCanvas);
    this.leafDetector = new LeafDetector();
    this.ndviFilter = new NdviFilter(this.spectralCanvas);
    this.parallax = new GyroParallax(this.cardAnchorEl);

    this.glassCards = new GlassCards(this.cardAnchorEl);
    this.glassCards.onMinimizeToggle = (minimized) => {
      if (minimized) {
        this.cardClusterEl.classList.add('is-minimized');
      } else {
        this.cardClusterEl.classList.remove('is-minimized');
      }
    };
    this.pinManager = new PinManager(this.pinsContainer, (selectedPin) => {
      this.onLeafPinSelected(selectedPin);
    });

    this.segmentedControl = new SegmentedControl(this.segContainer, (mode) => {
      this.onModeChanged(mode);
    });

    this.plantDeck = new PlantDeck(this.deckContainer, PLANT_PROFILES, (selection) => {
      this.onSourceSelected(selection);
    });

    this.initDrawer();
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

  async init() {
    // 1. Initial plant profile load
    this.loadPlantProfile(this.activePlantId);

    // 2. Start animation & CV loop
    this.startLoop();

    // 3. Try starting rear camera if supported, else fallback to initial specimen
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
    this.glassCards.setPlant(profile);
    this.pinManager.setPins(profile.pins);

    if (!this.cameraStream.isLiveCamera) {
      this.cameraStream.loadSpecimen(profile.specimenImage);
    }
  }

  onModeChanged(mode) {
    this.activeMode = mode;
    this.glassCards.setMode(mode);

    if (mode === 'spectral') {
      this.spectralCanvas.classList.add('active');
    } else {
      this.spectralCanvas.classList.remove('active');
    }
  }

  async onSourceSelected(selection) {
    // Collapse drawer after user picks
    this.deckContainer.classList.add('collapsed');
    const arrow = this.specimensToggleBtn?.querySelector('.specimen-arrow');
    if (arrow) arrow.textContent = '▾';

    if (selection === 'camera') {
      const ok = await this.cameraStream.startCamera();
      if (!ok) {
        alert('Camera access unavailable. Reverting to specimen mode.');
        this.plantDeck.setSelection(this.activePlantId, false);
      }
    } else {
      this.cameraStream.stopCamera();
      this.loadPlantProfile(selection);
    }
  }

  onLeafPinSelected(pin) {
    if (!pin) return;
    const card = this.cardAnchorEl.querySelector('.visionos-card');
    if (card) {
      card.style.transform = 'scale(1.02)';
      setTimeout(() => { card.style.transform = ''; }, 200);
    }
  }

  startLoop() {
    let lastCvTime = 0;

    const render = (time) => {
      // 1. Update Video / Specimen Canvas
      const hasFrame = this.cameraStream.renderFrame();

      // 2. Run Computer Vision Leaf Detection at ~30-60fps
      if (hasFrame && time - lastCvTime > 30) {
        lastCvTime = time;
        const analysis = this.leafDetector.analyze(this.displayCanvas);

        if (analysis && analysis.detected) {
          const b = analysis.box;
          const p = PLANT_PROFILES[this.activePlantId] || PLANT_PROFILES.money_plant;

          // Transition to DETECTED state
          if (!this.isDetected) {
            this.isDetected = true;
            this.statusPillEl.classList.remove('idle');
            this.statusPillEl.classList.add('detected');
            this.statusTextEl.textContent = `${p.name} Detected • ${p.vigor}% Vigor`;

            this.cardClusterEl.classList.remove('cluster-hidden');
            this.cardClusterEl.classList.add('cluster-visible');

            this.pinsContainer.classList.add('visible');

            this.scanFrameEl.classList.remove('idle');
            this.scanFrameEl.classList.add('locked');
          }

          // Smoothly track detected plant foliage box
          this.scanFrameEl.style.left = `${b.x * 100}%`;
          this.scanFrameEl.style.top = `${b.y * 100}%`;
          this.scanFrameEl.style.width = `${b.width * 100}%`;
          this.scanFrameEl.style.height = `${b.height * 100}%`;

          // Dynamically anchor AR pins on detected plant foliage
          if (analysis.dynamicPins && analysis.dynamicPins.length > 0) {
            this.pinManager.setPins(analysis.dynamicPins);
          }
        } else {
          // Transition to IDLE / SCANNING state (clean transparent view)
          if (this.isDetected) {
            this.isDetected = false;
            this.statusPillEl.classList.remove('detected');
            this.statusPillEl.classList.add('idle');
            this.statusTextEl.textContent = 'Scanning for plant...';

            this.cardClusterEl.classList.remove('cluster-visible');
            this.cardClusterEl.classList.add('cluster-hidden');

            this.pinsContainer.classList.remove('visible');

            this.scanFrameEl.classList.remove('locked');
            this.scanFrameEl.classList.add('idle');
          }

          // Subtle, delicate central scanning area
          this.scanFrameEl.style.left = '18%';
          this.scanFrameEl.style.top = '22%';
          this.scanFrameEl.style.width = '64%';
          this.scanFrameEl.style.height = '56%';
        }

        // 3. If in Spectral NDVI mode, render false-color infrared frame
        if (this.activeMode === 'spectral') {
          this.ndviFilter.render(this.displayCanvas);
        }
      }

      // 4. Update 3D Gyro / Pointer Parallax
      this.parallax.update();

      requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
  }
}

// Bootstrap on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new PlantVisionApp();
});
