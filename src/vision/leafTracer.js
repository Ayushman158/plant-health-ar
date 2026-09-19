/**
 * LeafTracer — Luminous Dot-Matrix & ASCII Leaf Contour Scanner
 * Inspired by Claryx organic dot matrix, ASCII tulip floral tracing,
 * and Fancy Components pixel-trail interactions.
 */
export class LeafTracer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.scanProgress = 0; // 0 to 1 for sweep wave
    this.pointerTrails = [];
    this.lastPointer = null;

    // ASCII characters ordered by visual density (inspired by reference image 2 & 3)
    this.asciiRamp = ['2', '*', '+', 'e', '/', '•', 'o', '·'];

    this.activeColor = '#86efac';
    this.activeStatus = 'optimal';

    this.initPointerListener();
  }

  setColor(hexColor, status = 'optimal') {
    this.activeColor = hexColor || '#86efac';
    this.activeStatus = status;
  }

  initPointerListener() {
    const onMove = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      this.addPixelTrail(x, y);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
  }

  addPixelTrail(x, y) {
    // Pixel-trail particle (Fancy Components inspired)
    const size = 16;
    const gridX = Math.floor(x / size) * size;
    const gridY = Math.floor(y / size) * size;

    // Avoid duplicate tiles at same position
    if (this.pointerTrails.some(p => p.x === gridX && p.y === gridY && p.life > 0.6)) {
      return;
    }

    this.pointerTrails.push({
      x: gridX,
      y: gridY,
      size,
      life: 1.0,
      char: this.asciiRamp[Math.floor(Math.random() * this.asciiRamp.length)]
    });

    if (this.pointerTrails.length > 80) {
      this.pointerTrails.shift();
    }
  }

  render(analysis, sourceCanvas) {
    const w = this.canvas.width = sourceCanvas.width || window.innerWidth;
    const h = this.canvas.height = sourceCanvas.height || window.innerHeight;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);

    // 1. Advance scanning sweep wave
    this.scanProgress = (this.scanProgress + 0.012) % 1.0;

    // 2. Render ASCII / Dot Matrix Silhouette Tracing on Detected Plant Leaves
    if (analysis && analysis.detected && analysis.mask) {
      this.renderLeafMatrix(analysis, w, h);
    }

    // 3. Render Interactive Pixel Trail (Fancy Components style)
    this.renderPixelTrails(w, h);
  }

  renderLeafMatrix(analysis, viewW, viewH) {
    const ctx = this.ctx;
    const mask = analysis.mask;
    const mw = analysis.maskWidth;
    const mh = analysis.maskHeight;

    if (!mask || mw === 0 || mh === 0) return;

    // Step size for matrix grid on screen
    const step = 14; // spacing between dot/char glyphs
    const cols = Math.floor(viewW / step);
    const rows = Math.floor(viewH / step);

    ctx.font = '500 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const sweepY = this.scanProgress * viewH;
    const sweepBand = 70;

    for (let r = 0; r < rows; r++) {
      const screenY = r * step + step / 2;
      const normY = screenY / viewH;
      const maskY = Math.floor(normY * mh);
      if (maskY < 0 || maskY >= mh) continue;

      // Distance from active scan sweep line
      const distToSweep = Math.abs(screenY - sweepY);
      const isNearSweep = distToSweep < sweepBand;
      const sweepBoost = isNearSweep ? (1.0 - distToSweep / sweepBand) * 0.45 : 0;

      for (let c = 0; c < cols; c++) {
        const screenX = c * step + step / 2;
        const normX = screenX / viewW;
        const maskX = Math.floor(normX * mw);
        if (maskX < 0 || maskX >= mw) continue;

        const maskVal = mask[maskY * mw + maskX];
        if (maskVal === 0) continue; // Not foliage

        // Determine glyph & color based on botanical pathology
        let glyph = '•';
        let color = this.activeColor;
        let baseAlpha = 0.55;

        if (maskVal === 2) {
          // Chlorosis / Yellowing
          glyph = '+';
          color = '#fef08a'; // Soft primrose
          baseAlpha = 0.8;
        } else if (maskVal === 3) {
          // Necrosis / Burn
          glyph = '*';
          color = '#fca5a5'; // Soft coral
          baseAlpha = 0.9;
        } else if (maskVal === 4) {
          // Variegation
          glyph = '2';
          color = '#fef08a';
          baseAlpha = 0.75;
        } else {
          // Normal chlorophyll leaf tissue
          const charIdx = (c + r) % this.asciiRamp.length;
          glyph = this.asciiRamp[charIdx];
          baseAlpha = 0.65;
        }

        const finalAlpha = Math.min(1.0, baseAlpha + sweepBoost);

        // Draw soft glowing dot / ASCII character
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = isNearSweep ? 8 : 4;
        ctx.fillStyle = color;
        ctx.globalAlpha = finalAlpha;

        // Alternate between glowing circle dot (Claryx style) and ASCII char (Tulip style)
        if ((c + r) % 3 === 0) {
          ctx.beginPath();
          const dotRadius = isNearSweep ? 2.6 : 1.9;
          ctx.arc(screenX, screenY, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillText(glyph, screenX, screenY);
        }

        ctx.restore();
      }
    }

    // Draw scanning laser sweep line across active plant bounding box
    if (analysis.box) {
      const b = analysis.box;
      const laserY = b.y * viewH + this.scanProgress * (b.height * viewH);
      const startX = b.x * viewW;
      const endX = (b.x + b.width) * viewW;

      ctx.save();
      const grad = ctx.createLinearGradient(startX, laserY, endX, laserY);
      grad.addColorStop(0, 'rgba(134, 239, 172, 0)');
      grad.addColorStop(0.5, this.activeColor);
      grad.addColorStop(1, 'rgba(134, 239, 172, 0)');

      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = this.activeColor;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(startX, laserY);
      ctx.lineTo(endX, laserY);
      ctx.stroke();
      ctx.restore();
    }
  }

  renderPixelTrails(w, h) {
    const ctx = this.ctx;
    if (this.pointerTrails.length === 0) return;

    for (let i = this.pointerTrails.length - 1; i >= 0; i--) {
      const p = this.pointerTrails[i];
      p.life -= 0.035;

      if (p.life <= 0) {
        this.pointerTrails.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.life * 0.7;
      ctx.fillStyle = this.activeColor;
      ctx.shadowColor = this.activeColor;
      ctx.shadowBlur = 8;

      // Draw glowing pixel tile (Fancy Components pixel-trail)
      ctx.fillRect(p.x + 1, p.y + 1, p.size - 2, p.size - 2);

      // Draw center ASCII character
      ctx.fillStyle = '#05080c';
      ctx.font = '600 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.char, p.x + p.size / 2, p.y + p.size / 2);

      ctx.restore();
    }
  }
}
