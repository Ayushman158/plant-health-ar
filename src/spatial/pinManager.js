/**
 * PinManager
 * Manages spatial AR leaf marker pins anchored directly to plant foliage.
 * Pins appear as subtle, elegant glowing target anchors that expand a compact
 * glass popover only when tapped by the user.
 */
export class PinManager {
  constructor(overlayContainer, onPinSelected) {
    this.container = overlayContainer;
    this.onPinSelected = onPinSelected;
    this.pins = [];
    this.activePinId = null;
    this.sourceCanvas = null;

    this.initInteraction();
  }

  setSourceCanvas(canvas) {
    this.sourceCanvas = canvas;
  }

  initInteraction() {
    // Tap on canvas background: deselect active pin or create user inspection loupe
    this.container.addEventListener('click', (e) => {
      const pinTarget = e.target.closest('.spatial-leaf-pin');
      if (pinTarget) return;

      // If a pin was open, tapping outside closes it
      if (this.activePinId) {
        this.activePinId = null;
        this.render();
        return;
      }

      const rect = this.container.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const pctX = (clickX / rect.width) * 100;
      const pctY = (clickY / rect.height) * 100;

      // Sample actual color from canvas if available
      let localizedScore = Math.floor(91 + Math.random() * 6);
      let localizedNote = 'Vibrant chlorophyll';

      if (this.sourceCanvas && this.sourceCanvas.width > 0) {
        try {
          const ctx = this.sourceCanvas.getContext('2d');
          const sampleX = Math.floor((clickX / rect.width) * this.sourceCanvas.width);
          const sampleY = Math.floor((clickY / rect.height) * this.sourceCanvas.height);
          const pixel = ctx.getImageData(sampleX, sampleY, 1, 1).data;
          const r = pixel[0], g = pixel[1], b = pixel[2];

          if (g > r && g > b) {
            localizedScore = Math.min(98, Math.max(88, Math.round((g / 255) * 60 + 38)));
            localizedNote = 'Healthy leaf blade';
          } else if (r > 120 && g > 120 && b < 100) {
            localizedScore = 93;
            localizedNote = 'Golden variegation';
          } else {
            localizedScore = 90;
            localizedNote = 'Active leaf tissue';
          }
        } catch (_) {
          // fallback gracefully
        }
      }

      const loupePin = {
        id: 'loupe-pin-' + Date.now(),
        x: Math.round(pctX),
        y: Math.round(pctY),
        label: 'Selected Leaf Spot',
        score: localizedScore,
        color: '#86efac',
        note: localizedNote,
        isUserLoupe: true
      };

      // Replace any previous user loupe pin
      this.pins = this.pins.filter(p => !p.isUserLoupe);
      this.addPin(loupePin);
      this.selectPin(loupePin.id);

      if (navigator.vibrate) navigator.vibrate(20);
    });
  }

  setPins(pinList) {
    // Preserve active user loupe pin if one exists
    const userPins = this.pins.filter(p => p.isUserLoupe);
    this.pins = [...pinList, ...userPins];
    this.render();
  }

  addPin(pin) {
    this.pins.push(pin);
    this.render();
  }

  selectPin(pinId) {
    this.activePinId = this.activePinId === pinId ? null : pinId;
    this.render();
    if (this.onPinSelected) {
      const selected = this.pins.find(p => p.id === this.activePinId);
      this.onPinSelected(selected);
    }
  }

  render() {
    this.container.innerHTML = '';

    this.pins.forEach(pin => {
      const pinEl = document.createElement('div');
      const isLoupe = pin.isUserLoupe;
      const isActive = this.activePinId === pin.id;
      pinEl.className = `spatial-leaf-pin ${isActive ? 'active' : ''} ${isLoupe ? 'loupe-pin' : ''}`;
      pinEl.style.left = `${pin.x}%`;
      pinEl.style.top = `${pin.y}%`;

      pinEl.innerHTML = `
        <div class="pin-target" style="--pin-color: ${pin.color || '#86efac'}">
          <div class="pin-pulse"></div>
          <div class="pin-core"></div>
        </div>
        <div class="pin-card-popover" style="--pin-color: ${pin.color || '#86efac'}">
          <div class="popover-row">
            <span class="popover-dot" style="background: ${pin.color || '#86efac'}"></span>
            <span class="popover-title">${pin.label}</span>
            <span class="popover-score">${pin.score}%</span>
          </div>
          ${pin.note ? `<div class="popover-note">${pin.note}</div>` : ''}
        </div>
      `;

      pinEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectPin(pin.id);
        if (navigator.vibrate) navigator.vibrate(20);
      });

      this.container.appendChild(pinEl);
    });
  }
}
