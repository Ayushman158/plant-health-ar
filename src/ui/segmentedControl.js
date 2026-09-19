/**
 * SegmentedControl (Minimalist View Mode Selector)
 * Switch between Live Scanner, ASCII/Dot Matrix Tracing, and Doctor Prescription.
 */
export class SegmentedControl {
  constructor(containerEl, onModeChange) {
    this.container = containerEl;
    this.onModeChange = onModeChange;
    this.modes = [
      { id: 'scan', label: 'Camera', icon: '📷' },
      { id: 'tracer', label: 'Tracing', icon: '✨' },
      { id: 'rx', label: 'Prescription', icon: '🩺' }
    ];
    this.activeMode = 'tracer'; // Default to show off the gorgeous tracing!

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
      <div class="mode-pill-selector" role="tablist">
        ${this.modes.map(m => `
          <button 
            type="button" 
            role="tab" 
            aria-selected="${this.activeMode === m.id}"
            class="mode-pill-btn ${this.activeMode === m.id ? 'active' : ''}" 
            data-mode="${m.id}">
            <span class="pill-icon">${m.icon}</span>
            <span class="pill-label">${m.label}</span>
          </button>
        `).join('')}
      </div>
    `;

    this.container.querySelectorAll('.mode-pill-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mode = btn.dataset.mode;
        this.setMode(mode);
      });
    });
  }
}
