/**
 * PlantDeck (Specimen & Camera Source Switcher)
 * Minimal VisionOS horizontal carousel allowing users to switch between
 * physical camera scanning and calibrated botanical specimens.
 */
export class PlantDeck {
  constructor(containerEl, plantProfiles, onSelect) {
    this.container = containerEl;
    this.profiles = plantProfiles;
    this.onSelect = onSelect;
    this.currentId = 'monstera';
    this.isLive = false;

    this.render();
  }

  setSelection(id, isLive = false) {
    this.currentId = id;
    this.isLive = isLive;
    this.render();
  }

  render() {
    const plantKeys = Object.keys(this.profiles);

    this.container.innerHTML = `
      <div class="specimen-deck-bar">
        <!-- Live Camera Mode Option -->
        <button type="button" class="specimen-chip ${this.isLive ? 'active live-active' : ''}" data-source="camera">
          <span class="chip-dot" style="background: #86efac;"></span>
          <span class="chip-text">Live AR Lens</span>
        </button>

        <div class="deck-divider"></div>

        <!-- Botanical Specimens -->
        ${plantKeys.map(key => {
          const p = this.profiles[key];
          const isActive = !this.isLive && this.currentId === key;
          return `
            <button 
              type="button" 
              class="specimen-chip ${isActive ? 'active' : ''}" 
              data-plant-id="${p.id}">
              <span class="chip-dot" style="background: ${p.colorScheme.primary};"></span>
              <span class="chip-text">${p.name.split(' ')[0]}</span>
            </button>
          `;
        }).join('')}
      </div>
    `;

    this.container.querySelectorAll('.specimen-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btn.dataset.source === 'camera') {
          this.setSelection(this.currentId, true);
          if (this.onSelect) this.onSelect('camera');
        } else {
          const plantId = btn.dataset.plantId;
          this.setSelection(plantId, false);
          if (this.onSelect) this.onSelect(plantId);
        }
        if (navigator.vibrate) navigator.vibrate(15);
      });
    });
  }
}
