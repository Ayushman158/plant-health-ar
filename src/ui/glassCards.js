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
  }

  setPlant(plantData) {
    this.currentPlant = plantData;
    this.render();
  }

  setMode(mode) {
    this.activeMode = mode;
    this.render();
  }

  render() {
    if (!this.currentPlant) return;
    const p = this.currentPlant;

    if (this.activeMode === 'spectral') {
      this.renderSpectralHUD(p);
      return;
    }

    if (this.activeMode === 'tissue') {
      this.renderTissueHUD(p);
      return;
    }

    // Default: 'vigor' mode
    this.renderVigorHUD(p);
  }

  renderVigorHUD(p) {
    const { metrics, colorScheme, vigor } = p;
    const m = metrics;

    // SVG Ring Geometry
    const size = 100;
    const strokeWidth = 7;
    const radiusOuter = 42;
    const circOuter = 2 * Math.PI * radiusOuter;
    const offsetOuter = circOuter - (circOuter * vigor) / 100;

    const radiusMid = 31;
    const circMid = 2 * Math.PI * radiusMid;
    const offsetMid = circMid - (circMid * m.hydration.value) / 100;

    const radiusInner = 20;
    const circInner = 2 * Math.PI * radiusInner;
    const offsetInner = circInner - (circInner * m.chlorophyll.value) / 100;

    this.container.innerHTML = `
      <div class="visionos-card glass-panel" style="--accent-color: ${colorScheme.primary}">
        <!-- Top Status Pill & Specular Header -->
        <div class="card-header">
          <div class="status-pill" style="--status-color: ${colorScheme.primary}">
            <span class="status-dot"></span>
            <span class="status-text">${p.statusLabel.toUpperCase()}</span>
          </div>
          <div class="specimen-badge">${p.name}</div>
        </div>

        <!-- Central Vitality Activity Rings & Big Score -->
        <div class="vitality-hero">
          <div class="rings-wrapper">
            <svg class="concentric-rings" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
              <!-- Background Tracks -->
              <circle class="ring-bg" cx="50" cy="50" r="${radiusOuter}" stroke-width="${strokeWidth}" />
              <circle class="ring-bg" cx="50" cy="50" r="${radiusMid}" stroke-width="${strokeWidth}" />
              <circle class="ring-bg" cx="50" cy="50" r="${radiusInner}" stroke-width="${strokeWidth}" />

              <!-- Outer: Overall Vigor (Pastel Mint / Peach) -->
              <circle class="ring-bar ring-vigor" cx="50" cy="50" r="${radiusOuter}"
                stroke-width="${strokeWidth}"
                stroke="${colorScheme.primary}"
                stroke-dasharray="${circOuter}"
                stroke-dashoffset="${offsetOuter}" />

              <!-- Middle: Hydration (Pastel Ice Blue) -->
              <circle class="ring-bar ring-hydra" cx="50" cy="50" r="${radiusMid}"
                stroke-width="${strokeWidth}"
                stroke="#bae6fd"
                stroke-dasharray="${circMid}"
                stroke-dashoffset="${offsetMid}" />

              <!-- Inner: Chlorophyll (Pastel Emerald) -->
              <circle class="ring-bar ring-chloro" cx="50" cy="50" r="${radiusInner}"
                stroke-width="${strokeWidth}"
                stroke="#86efac"
                stroke-dasharray="${circInner}"
                stroke-dashoffset="${offsetInner}" />
            </svg>
          </div>

          <!-- Hero Metrics Text -->
          <div class="vitality-score-block">
            <div class="vigor-num" style="color: ${colorScheme.primary}">${vigor}%</div>
            <div class="vigor-label">VIGOR INDEX</div>
          </div>
        </div>

        <!-- 4 Visual Semantic Telemetry Chips (Pastel Palette, Minimal Text) -->
        <div class="metrics-grid">
          <!-- 1. Chlorophyll -->
          <div class="metric-tile" style="--tile-color: #86efac">
            <div class="tile-top">
              <span class="tile-icon">🌿</span>
              <span class="tile-val">${m.chlorophyll.value}%</span>
            </div>
            <div class="tile-bar-bg">
              <div class="tile-bar-fill" style="width: ${m.chlorophyll.value}%; background: #86efac;"></div>
            </div>
            <div class="tile-name">CHLOROPHYLL</div>
          </div>

          <!-- 2. Hydration -->
          <div class="metric-tile" style="--tile-color: #bae6fd">
            <div class="tile-top">
              <span class="tile-icon">💧</span>
              <span class="tile-val">${m.hydration.value}%</span>
            </div>
            <div class="tile-bar-bg">
              <div class="tile-bar-fill" style="width: ${m.hydration.value}%; background: #bae6fd;"></div>
            </div>
            <div class="tile-name">HYDRATION</div>
          </div>

          <!-- 3. Light / PAR -->
          <div class="metric-tile" style="--tile-color: #fef08a">
            <div class="tile-top">
              <span class="tile-icon">☀️</span>
              <span class="tile-val">${m.solarPAR.value}%</span>
            </div>
            <div class="tile-bar-bg">
              <div class="tile-bar-fill" style="width: ${m.solarPAR.value}%; background: #fef08a;"></div>
            </div>
            <div class="tile-name">SOLAR FLUX</div>
          </div>

          <!-- 4. Cuticle Vigor -->
          <div class="metric-tile" style="--tile-color: #a7f3d0">
            <div class="tile-top">
              <span class="tile-icon">🛡️</span>
              <span class="tile-val">${m.cuticle.value}%</span>
            </div>
            <div class="tile-bar-bg">
              <div class="tile-bar-fill" style="width: ${m.cuticle.value}%; background: #a7f3d0;"></div>
            </div>
            <div class="tile-name">CUTICLE</div>
          </div>
        </div>

        <!-- Quick Hint -->
        <div class="card-footer-tip">
          <span>Tap leaf for spatial telemetry</span>
        </div>
      </div>
    `;
  }

  renderSpectralHUD(p) {
    this.container.innerHTML = `
      <div class="visionos-card glass-panel" style="--accent-color: #86efac">
        <div class="card-header">
          <div class="status-pill" style="--status-color: #86efac">
            <span class="status-dot"></span>
            <span class="status-text">NDVI SPECTRAL SCAN</span>
          </div>
          <div class="specimen-badge">Photosynthetic Index</div>
        </div>

        <!-- Spectral Heatmap Legend -->
        <div class="spectral-legend-card">
          <div class="spectral-gradient-bar"></div>
          <div class="spectral-legend-labels">
            <span class="lbl-low">Dormant</span>
            <span class="lbl-mid">Stressed</span>
            <span class="lbl-high">Vigorous PAR</span>
          </div>
        </div>

        <!-- Spectral Telemetry Visuals -->
        <div class="spectral-stat-row">
          <div class="spectral-stat">
            <div class="stat-big-num" style="color: #86efac;">0.78</div>
            <div class="stat-sub">ACTIVE NDVI</div>
          </div>
          <div class="spectral-stat">
            <div class="stat-big-num" style="color: #bae6fd;">420 nm</div>
            <div class="stat-sub">PEAK ABSORPTION</div>
          </div>
          <div class="spectral-stat">
            <div class="stat-big-num" style="color: #fef08a;">94%</div>
            <div class="stat-sub">CANOPY REFLECT</div>
          </div>
        </div>
      </div>
    `;
  }

  renderTissueHUD(p) {
    const t = p.tissueData;
    this.container.innerHTML = `
      <div class="visionos-card glass-panel" style="--accent-color: ${p.colorScheme.primary}">
        <div class="card-header">
          <div class="status-pill" style="--status-color: ${p.colorScheme.primary}">
            <span class="status-dot"></span>
            <span class="status-text">CELLULAR TISSUE</span>
          </div>
          <div class="specimen-badge">Micro Telemetry</div>
        </div>

        <div class="tissue-list">
          <div class="tissue-item">
            <div class="tissue-lbl">Transpiration Velocity</div>
            <div class="tissue-val" style="color: #bae6fd;">${t.transpirationRate}</div>
          </div>
          <div class="tissue-item">
            <div class="tissue-lbl">Leaf Temperature</div>
            <div class="tissue-val" style="color: #fef08a;">${t.leafTemp}</div>
          </div>
          <div class="tissue-item">
            <div class="tissue-lbl">Stomata Aperture</div>
            <div class="tissue-val" style="color: #86efac;">${t.stomataStatus}</div>
          </div>
          <div class="tissue-item">
            <div class="tissue-lbl">Pathogen Vulnerability</div>
            <div class="tissue-val" style="color: ${p.vigor > 80 ? '#86efac' : '#fed7aa'};">${t.pathogenRisk} Low</div>
          </div>
        </div>
      </div>
    `;
  }
}
