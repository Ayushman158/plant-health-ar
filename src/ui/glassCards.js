/**
 * GlassCards UI Module
 * Renders the Apple VisionOS spatial frosted glass diagnostic interface,
 * featuring concentric SVG vitality rings, minimal text, and pastel semantic telemetry.
 */
export class GlassCards {
  constructor(containerEl) {
    this.container = containerEl;
    this.currentPlant = null;
    this.activeMode = 'vigor'; // 'vigor' | 'spectral' | 'tissue'
    this.isMinimized = false;
  }

  setPlant(plantData) {
    this.currentPlant = plantData;
    this.render();
  }

  setMode(mode) {
    this.activeMode = mode;
    this.render();
  }

  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    this.render();
    if (this.onMinimizeToggle) {
      this.onMinimizeToggle(this.isMinimized);
    }
  }

  render() {
    if (!this.currentPlant) return;
    const p = this.currentPlant;

    if (this.isMinimized) {
      this.renderMinimizedHUD(p);
      return;
    }

    if (this.activeMode === 'spectral') {
      this.renderSpectralHUD(p);
      this.bindHeaderActions();
      return;
    }

    if (this.activeMode === 'tissue') {
      this.renderTissueHUD(p);
      this.bindHeaderActions();
      return;
    }

    // Default: 'vigor' mode
    this.renderVigorHUD(p);
    this.bindHeaderActions();
  }

  renderMinimizedHUD(p) {
    this.container.innerHTML = `
      <div class="visionos-card glass-panel minimized-pill-card" style="--accent-color: ${p.colorScheme.primary}">
        <div class="minimized-inner-row">
          <span class="status-dot" style="background: ${p.colorScheme.primary}"></span>
          <span class="min-name">${p.name}</span>
          <span class="min-score" style="color: ${p.colorScheme.primary}">${p.vigor}% VIGOR</span>
          <button type="button" class="btn-expand-card" aria-label="Expand card">▲</button>
        </div>
      </div>
    `;

    const expandBtn = this.container.querySelector('.btn-expand-card');
    if (expandBtn) {
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMinimize();
      });
    }
  }

  renderVigorHUD(p) {
    const { metrics, colorScheme, vigor } = p;
    const m = metrics;

    // SVG Ring Geometry (Compact 52px)
    const radiusOuter = 21;
    const circOuter = 2 * Math.PI * radiusOuter;
    const offsetOuter = circOuter - (circOuter * vigor) / 100;

    const radiusMid = 14.5;
    const circMid = 2 * Math.PI * radiusMid;
    const offsetMid = circMid - (circMid * m.hydration.value) / 100;

    const radiusInner = 8;
    const circInner = 2 * Math.PI * radiusInner;
    const offsetInner = circInner - (circInner * m.chlorophyll.value) / 100;

    this.container.innerHTML = `
      <div class="visionos-card glass-panel compact-hud" style="--accent-color: ${colorScheme.primary}">
        <!-- Compact Header -->
        <div class="card-header compact-header">
          <div class="status-pill" style="--status-color: ${colorScheme.primary}">
            <span class="status-dot"></span>
            <span class="status-text">${p.statusLabel}</span>
          </div>
          <div class="card-header-actions">
            <span class="specimen-badge">${p.name}</span>
            <button type="button" class="btn-minimize-card" aria-label="Minimize card">▾</button>
          </div>
        </div>

        <!-- Unified Compact Body: Mini Rings (Left) + 4 Stat Chips (Right) -->
        <div class="compact-body">
          <!-- Left: Score with Mini Concentric Rings -->
          <div class="compact-rings-block">
            <div class="mini-rings-wrapper">
              <svg class="concentric-rings" viewBox="0 0 52 52" width="52" height="52">
                <circle class="ring-bg" cx="26" cy="26" r="21" stroke-width="4.2" />
                <circle class="ring-bg" cx="26" cy="26" r="14.5" stroke-width="4.2" />
                <circle class="ring-bg" cx="26" cy="26" r="8" stroke-width="4.2" />

                <!-- Outer: Health Score -->
                <circle class="ring-bar ring-vigor" cx="26" cy="26" r="21"
                  stroke-width="4.2"
                  stroke="${colorScheme.primary}"
                  stroke-dasharray="${circOuter}"
                  stroke-dashoffset="${offsetOuter}" />

                <!-- Middle: Water Level -->
                <circle class="ring-bar ring-hydra" cx="26" cy="26" r="14.5"
                  stroke-width="4.2"
                  stroke="#bae6fd"
                  stroke-dasharray="${circMid}"
                  stroke-dashoffset="${offsetMid}" />

                <!-- Inner: Leaf Vitality -->
                <circle class="ring-bar ring-chloro" cx="26" cy="26" r="8"
                  stroke-width="4.2"
                  stroke="#86efac"
                  stroke-dasharray="${circInner}"
                  stroke-dashoffset="${offsetInner}" />
              </svg>
            </div>
            <div class="compact-score-num" style="color: ${colorScheme.primary}">${vigor}%</div>
            <div class="compact-score-label">Health</div>
          </div>

          <!-- Right: 4 Sleek Micro Chips in 2x2 grid -->
          <div class="compact-stats-grid">
            <div class="compact-stat-chip">
              <div class="chip-row">
                <span class="chip-label">🌿 Leaves</span>
                <span class="chip-val" style="color: #86efac">${m.chlorophyll.value}%</span>
              </div>
              <div class="chip-bar"><div class="chip-fill" style="width: ${m.chlorophyll.value}%; background: #86efac"></div></div>
            </div>

            <div class="compact-stat-chip">
              <div class="chip-row">
                <span class="chip-label">💧 Water</span>
                <span class="chip-val" style="color: #bae6fd">${m.hydration.value}%</span>
              </div>
              <div class="chip-bar"><div class="chip-fill" style="width: ${m.hydration.value}%; background: #bae6fd"></div></div>
            </div>

            <div class="compact-stat-chip">
              <div class="chip-row">
                <span class="chip-label">☀️ Light</span>
                <span class="chip-val" style="color: #fef08a">${m.solarPAR.value}%</span>
              </div>
              <div class="chip-bar"><div class="chip-fill" style="width: ${m.solarPAR.value}%; background: #fef08a"></div></div>
            </div>

            <div class="compact-stat-chip">
              <div class="chip-row">
                <span class="chip-label">🛡️ Shine</span>
                <span class="chip-val" style="color: #a7f3d0">${m.cuticle.value}%</span>
              </div>
              <div class="chip-bar"><div class="chip-fill" style="width: ${m.cuticle.value}%; background: #a7f3d0"></div></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  bindHeaderActions() {
    const minBtn = this.container.querySelector('.btn-minimize-card');
    if (minBtn) {
      minBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMinimize();
      });
    }
  }

  renderSpectralHUD(p) {
    this.container.innerHTML = `
      <div class="visionos-card glass-panel compact-hud" style="--accent-color: #86efac">
        <div class="card-header compact-header">
          <div class="status-pill" style="--status-color: #86efac">
            <span class="status-dot"></span>
            <span class="status-text">LEAF ABSORPTION SCAN</span>
          </div>
          <div class="card-header-actions">
            <span class="specimen-badge">Live Map</span>
            <button type="button" class="btn-minimize-card" aria-label="Minimize card">▾</button>
          </div>
        </div>

        <!-- Spectral Heatmap Legend -->
        <div class="spectral-legend-card">
          <div class="spectral-gradient-bar"></div>
          <div class="spectral-legend-labels">
            <span class="lbl-low">Resting</span>
            <span class="lbl-mid">Growing</span>
            <span class="lbl-high">Peak Light Absorption</span>
          </div>
        </div>

        <!-- Spectral Telemetry Visuals -->
        <div class="spectral-stat-row">
          <div class="spectral-stat">
            <div class="stat-big-num" style="color: #86efac;">High</div>
            <div class="stat-sub">CHLOROPHYLL</div>
          </div>
          <div class="spectral-stat">
            <div class="stat-big-num" style="color: #bae6fd;">Strong</div>
            <div class="stat-sub">LIGHT CAPTURE</div>
          </div>
          <div class="spectral-stat">
            <div class="stat-big-num" style="color: #fef08a;">Optimal</div>
            <div class="stat-sub">GROWTH ENERGY</div>
          </div>
        </div>
      </div>
    `;
  }

  renderTissueHUD(p) {
    const tips = p.careTips || [];
    this.container.innerHTML = `
      <div class="visionos-card glass-panel compact-hud" style="--accent-color: ${p.colorScheme.primary}">
        <div class="card-header compact-header">
          <div class="status-pill" style="--status-color: ${p.colorScheme.primary}">
            <span class="status-dot"></span>
            <span class="status-text">DAILY CARE TIPS</span>
          </div>
          <div class="card-header-actions">
            <span class="specimen-badge">${p.name}</span>
            <button type="button" class="btn-minimize-card" aria-label="Minimize card">▾</button>
          </div>
        </div>

        <div class="care-tips-grid">
          ${tips.slice(0, 3).map(t => `
            <div class="care-tip-row">
              <span class="tip-icon">${t.icon}</span>
              <div class="tip-text">
                <span class="tip-title">${t.title}:</span>
                <span class="tip-desc">${t.desc}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
}
