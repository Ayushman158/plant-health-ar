/**
 * SegmentedControl (Minimalist View Mode Selector)
 * Switch between Live Camera, ASCII/Dot Matrix Tracing, and Doctor Prescription.
 */
export class SegmentedControl {
  constructor(containerEl, onModeChange) {
    this.container = containerEl;
    this.onModeChange = onModeChange;
    this.modes = [
      {
        id: 'scan',
        label: 'Camera',
        iconSvg: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`
      },
      {
        id: 'tracer',
        label: 'Tracing',
        iconSvg: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/></svg>`
      },
      {
        id: 'rx',
        label: 'Rx Sheet',
        iconSvg: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`
      }
    ];
    this.activeMode = 'tracer';

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
            <span class="pill-icon" aria-hidden="true">${m.iconSvg}</span>
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
