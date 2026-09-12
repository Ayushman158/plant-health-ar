/**
 * PinManager
 * Manages spatial AR leaf marker pins anchored directly to plant foliage.
 * Supports tapping to drop new pins and inspecting localized leaf telemetry.
 */
export class PinManager {
  constructor(overlayContainer, onPinSelected) {
    this.container = overlayContainer;
    this.onPinSelected = onPinSelected;
    this.pins = [];
    this.activePinId = null;

    this.initInteraction();
  }

  initInteraction() {
    this.container.addEventListener('click', (e) => {
      // If clicked directly on canvas/background, create a new interactive pin!
      if (e.target.closest('.spatial-leaf-pin')) return;

      const rect = this.container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      // Randomize localized leaf score around 85-98%
      const localizedScore = Math.floor(82 + Math.random() * 16);
      const newPin = {
        id: 'user-pin-' + Date.now(),
        x: Math.round(x),
        y: Math.round(y),
        label: 'Leaf Point',
        score: localizedScore,
        color: localizedScore > 88 ? '#86efac' : '#fed7aa',
        note: 'Point inspection'
      };

      this.addPin(newPin);
      this.selectPin(newPin.id);

      // Trigger mobile haptic pulse
      if (navigator.vibrate) navigator.vibrate(25);
    });
  }

  setPins(pinList) {
    this.pins = [...pinList];
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
      pinEl.className = `spatial-leaf-pin ${this.activePinId === pin.id ? 'active' : ''}`;
      pinEl.style.left = `${pin.x}%`;
      pinEl.style.top = `${pin.y}%`;

      pinEl.innerHTML = `
        <div class="pin-target" style="--pin-color: ${pin.color}">
          <div class="pin-pulse"></div>
          <div class="pin-core"></div>
        </div>
        <div class="pin-leader-line"></div>
        <div class="pin-card-glass" style="--pin-color: ${pin.color}">
          <div class="pin-header">
            <span class="pin-dot" style="background: ${pin.color}"></span>
            <span class="pin-score">${pin.score}%</span>
          </div>
          <div class="pin-caption">${pin.label}</div>
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
