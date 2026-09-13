/**
 * SegmentedControl (VisionOS Floating Mode Pill)
 * High-precision Apple VisionOS sliding pill switcher for diagnostic modes.
 */
export class SegmentedControl {
  constructor(containerEl, onModeChange) {
    this.container = containerEl;
    this.onModeChange = onModeChange;
    this.modes = [
      { id: 'vigor', label: 'Overview', icon: '✦' },
      { id: 'spectral', label: 'Leaf Scan', icon: '🔍' },
      { id: 'tissue', label: 'Care Tips', icon: '💡' }
    ];
    this.activeMode = 'vigor';

    this.render();
  }

  setMode(modeId) {
    if (this.activeMode === modeId) return;
    this.activeMode = modeId;
    this.render();
    if (this.onModeChange) this.onModeChange(modeId);
    if (navigator.vibrate) navigator.vibrate(15);
  }

  render() {
    this.container.innerHTML = `
      <nav class="visionos-segmented-control" role="tablist">
        ${this.modes.map(m => `
          <button 
            type="button" 
            role="tab" 
            aria-selected="${this.activeMode === m.id}"
            class="seg-pill-btn ${this.activeMode === m.id ? 'active' : ''}" 
            data-mode="${m.id}">
            <span class="seg-icon">${m.icon}</span>
            <span class="seg-label">${m.label}</span>
          </button>
        `).join('')}
      </nav>
    `;

    this.container.querySelectorAll('.seg-pill-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mode = btn.dataset.mode;
        this.setMode(mode);
      });
    });
  }
}
