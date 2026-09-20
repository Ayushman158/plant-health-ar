/**
 * LeafTracer — Minimal Modern Botanical AR Contour & Marker System
 * 
 * Replaces dense cyberpunk matrix/ASCII grids with:
 * 1. A subtle, glowing mint-green vector contour hugging the detected plant silhouette.
 * 2. An elegant central AR marker ((🍃)) positioned directly over the plant.
 * 3. Minimal rounded corner brackets and a few subtle tracking anchor nodes.
 * 
 * Complies with the Apple Camera × modern plant-care app aesthetic.
 */

export class LeafTracer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.activeColor = '#86efac';
    this.activeStatus = 'optimal';

    // Animation & temporal smoothing
    this.pulsePhase = 0;
    this.smoothedContour = [];
    this.smoothedCentroid = { x: 0.5, y: 0.5 };
    this.hasTarget = false;
  }

  setColor(hexColor, status = 'optimal') {
    this.activeColor = hexColor || '#86efac';
    this.activeStatus = status;
  }

  render(analysis, sourceCanvas) {
    const w = this.canvas.width = sourceCanvas.width || window.innerWidth;
    const h = this.canvas.height = sourceCanvas.height || window.innerHeight;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);

    this.pulsePhase += 0.04;

    if (!analysis || !analysis.detected) {
      this.hasTarget = false;
      this.smoothedContour = [];
      return;
    }

    this.hasTarget = true;

    // 1. Render glowing plant contour outline
    if (analysis.mask) {
      this.renderPlantContour(analysis, w, h);
    }

    // 2. Render subtle tracking points (sparse keypoints, not a dense grid)
    this.renderSubtleTrackingNodes(analysis, w, h);

    // 3. Render central AR marker on the plant centroid
    if (analysis.centroid) {
      this.renderCentralMarker(analysis.centroid, w, h);
    }
  }

  /**
   * Extract boundary points from 160x120 mask and render a smooth glowing organic outline
   */
  renderPlantContour(analysis, viewW, viewH) {
    const ctx = this.ctx;
    const mask = analysis.mask;
    const mw = analysis.maskWidth;
    const mh = analysis.maskHeight;

    if (!mask || mw === 0 || mh === 0) return;

    // Step 1: Extract perimeter boundary points
    const step = 2; // sample resolution
    const rawBoundary = [];

    for (let y = 1; y < mh - 1; y += step) {
      for (let x = 1; x < mw - 1; x += step) {
        const idx = y * mw + x;
        if (mask[idx] > 0) {
          // Check if it's an edge pixel (at least one 4-neighbor is background)
          const isEdge = mask[idx - 1] === 0 ||
                         mask[idx + 1] === 0 ||
                         mask[idx - mw] === 0 ||
                         mask[idx + mw] === 0;

          if (isEdge) {
            rawBoundary.push({
              x: (x / mw) * viewW,
              y: (y / mh) * viewH
            });
          }
        }
      }
    }

    if (rawBoundary.length < 8) return;

    // Step 2: Compute centroid for radial sorting (creates smooth closed contour loop)
    let cx = 0, cy = 0;
    for (let i = 0; i < rawBoundary.length; i++) {
      cx += rawBoundary[i].x;
      cy += rawBoundary[i].y;
    }
    cx /= rawBoundary.length;
    cy /= rawBoundary.length;

    // Sort radially around centroid into sectors for a clean organic boundary
    const sectors = 36;
    const sectorBests = new Array(sectors).fill(null);

    for (let i = 0; i < rawBoundary.length; i++) {
      const pt = rawBoundary[i];
      const dx = pt.x - cx;
      const dy = pt.y - cy;
      const dist = Math.hypot(dx, dy);
      let angle = Math.atan2(dy, dx);
      if (angle < 0) angle += Math.PI * 2;

      const sectorIdx = Math.floor((angle / (Math.PI * 2)) * sectors) % sectors;
      if (!sectorBests[sectorIdx] || dist > sectorBests[sectorIdx].dist) {
        sectorBests[sectorIdx] = { x: pt.x, y: pt.y, dist };
      }
    }

    // Filter non-empty sectors
    const loopPoints = [];
    for (let s = 0; s < sectors; s++) {
      if (sectorBests[s]) {
        loopPoints.push({ x: sectorBests[s].x, y: sectorBests[s].y });
      } else {
        // Fallback: interpolate between neighboring sectors
        let prev = null, next = null;
        for (let step = 1; step < sectors; step++) {
          const pIdx = (s - step + sectors) % sectors;
          if (!prev && sectorBests[pIdx]) prev = sectorBests[pIdx];
          const nIdx = (s + step) % sectors;
          if (!next && sectorBests[nIdx]) next = sectorBests[nIdx];
          if (prev && next) break;
        }
        if (prev && next) {
          loopPoints.push({
            x: (prev.x + next.x) * 0.5,
            y: (prev.y + next.y) * 0.5
          });
        }
      }
    }

    if (loopPoints.length < 6) return;

    // Temporal smoothing (Lerp with previous frame to eliminate jitter)
    if (this.smoothedContour.length !== loopPoints.length) {
      this.smoothedContour = loopPoints.map(p => ({ ...p }));
    } else {
      const lerp = 0.35;
      for (let i = 0; i < loopPoints.length; i++) {
        this.smoothedContour[i].x += (loopPoints[i].x - this.smoothedContour[i].x) * lerp;
        this.smoothedContour[i].y += (loopPoints[i].y - this.smoothedContour[i].y) * lerp;
      }
    }

    const pts = this.smoothedContour;

    // Step 3: Draw the soft glowing mint contour
    ctx.save();
    ctx.beginPath();

    // Start with midpoint between first and last point
    const firstMidX = (pts[0].x + pts[pts.length - 1].x) * 0.5;
    const firstMidY = (pts[0].y + pts[pts.length - 1].y) * 0.5;
    ctx.moveTo(firstMidX, firstMidY);

    for (let i = 0; i < pts.length; i++) {
      const curr = pts[i];
      const next = pts[(i + 1) % pts.length];
      const midX = (curr.x + next.x) * 0.5;
      const midY = (curr.y + next.y) * 0.5;
      ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
    }
    ctx.closePath();

    // Subtle breathing pulse on the glow
    const glowIntensity = 8 + Math.sin(this.pulsePhase) * 3;

    // Outer soft atmospheric glow
    ctx.strokeStyle = this.activeColor;
    ctx.shadowColor = this.activeColor;
    ctx.shadowBlur = glowIntensity;
    ctx.lineWidth = 2.2;
    ctx.globalAlpha = 0.85;
    ctx.stroke();

    // Crisp inner core line
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.45;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Render central AR marker ((🍃)) on the plant centroid
   */
  renderCentralMarker(centroid, viewW, viewH) {
    const ctx = this.ctx;

    // Smooth centroid coordinates
    this.smoothedCentroid.x += (centroid.x - this.smoothedCentroid.x) * 0.25;
    this.smoothedCentroid.y += (centroid.y - this.smoothedCentroid.y) * 0.25;

    const cx = this.smoothedCentroid.x * viewW;
    const cy = this.smoothedCentroid.y * viewH;

    ctx.save();
    ctx.translate(cx, cy);

    // Subtle gentle pulse
    const pulseScale = 1.0 + Math.sin(this.pulsePhase * 1.5) * 0.04;
    const pulseAlpha = 0.65 + Math.sin(this.pulsePhase * 1.5) * 0.18;

    // Outer subtle curved brackets: ( (   ) )
    const bracketRadius = 26 * pulseScale;
    const arcLen = Math.PI * 0.22;

    ctx.strokeStyle = this.activeColor;
    ctx.lineWidth = 1.6;
    ctx.shadowColor = this.activeColor;
    ctx.shadowBlur = 8;
    ctx.globalAlpha = pulseAlpha;

    // Left outer arc
    ctx.beginPath();
    ctx.arc(0, 0, bracketRadius, Math.PI - arcLen, Math.PI + arcLen);
    ctx.stroke();

    // Right outer arc
    ctx.beginPath();
    ctx.arc(0, 0, bracketRadius, -arcLen, arcLen);
    ctx.stroke();

    // Top outer arc
    ctx.beginPath();
    ctx.arc(0, 0, bracketRadius, -Math.PI * 0.5 - arcLen, -Math.PI * 0.5 + arcLen);
    ctx.stroke();

    // Bottom outer arc
    ctx.beginPath();
    ctx.arc(0, 0, bracketRadius, Math.PI * 0.5 - arcLen, Math.PI * 0.5 + arcLen);
    ctx.stroke();

    // Inner frosted circle disc
    const innerRadius = 17;
    ctx.shadowBlur = 6;
    ctx.fillStyle = 'rgba(10, 18, 13, 0.65)';
    ctx.beginPath();
    ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = this.activeColor;
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = 0.9;
    ctx.stroke();

    // Botanical Leaf Glyph in center
    ctx.fillStyle = '#86efac';
    ctx.strokeStyle = '#86efac';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 4;

    // Leaf outline vector path
    ctx.beginPath();
    // Leaf shape scaled to ~16px
    ctx.moveTo(0, -7);
    ctx.bezierCurveTo(5, -6, 7, -1, 6, 4);
    ctx.bezierCurveTo(4, 7, 1, 8, 0, 9);
    ctx.bezierCurveTo(-1, 8, -4, 7, -6, 4);
    ctx.bezierCurveTo(-7, -1, -5, -6, 0, -7);
    ctx.closePath();
    ctx.stroke();

    // Center leaf vein
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(0, 8);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Render a few sparse, elegant tracking points rather than an overwhelming grid
   */
  renderSubtleTrackingNodes(analysis, viewW, viewH) {
    if (!analysis.box) return;
    const ctx = this.ctx;
    const b = analysis.box;

    // Key spatial anchor points around the plant
    const keyNodes = [
      { x: (b.x + b.width * 0.35) * viewW, y: (b.y + b.height * 0.22) * viewH, delay: 0 },
      { x: (b.x + b.width * 0.68) * viewW, y: (b.y + b.height * 0.32) * viewH, delay: 1.2 },
      { x: (b.x + b.width * 0.26) * viewW, y: (b.y + b.height * 0.62) * viewH, delay: 2.4 },
      { x: (b.x + b.width * 0.74) * viewW, y: (b.y + b.height * 0.65) * viewH, delay: 3.6 },
    ];

    ctx.save();
    for (const node of keyNodes) {
      const phase = this.pulsePhase + node.delay;
      const alpha = 0.35 + Math.sin(phase) * 0.25;
      if (alpha <= 0.1) continue;

      ctx.fillStyle = this.activeColor;
      ctx.shadowColor = this.activeColor;
      ctx.shadowBlur = 6;
      ctx.globalAlpha = alpha;

      ctx.beginPath();
      ctx.arc(node.x, node.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
