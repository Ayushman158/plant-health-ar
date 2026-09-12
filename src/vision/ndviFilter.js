/**
 * NDVI Spectral Filter
 * Simulates Normalized Difference Vegetation Index (NDVI) false-color infrared imaging.
 * Highlights high vs low photosynthetic active radiation (PAR) absorption in leaf tissue.
 */
export class NdviFilter {
  constructor(outputCanvas) {
    this.canvas = outputCanvas;
    this.ctx = outputCanvas.getContext('2d');
  }

  render(sourceCanvas) {
    if (!sourceCanvas || sourceCanvas.width === 0) return;

    this.canvas.width = sourceCanvas.width;
    this.canvas.height = sourceCanvas.height;

    this.ctx.drawImage(sourceCanvas, 0, 0);
    const imgData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const d = imgData.data;

    // Process each pixel into false-color spectral gradient
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];

      const sum = g + r;
      if (sum < 30) {
        // Dark background - keep dark slate
        d[i] = 20;
        d[i + 1] = 25;
        d[i + 2] = 35;
        continue;
      }

      // NDVI optical proxy
      const ndvi = (g - r) / (sum + 0.001);

      if (ndvi > 0.12 && g > b) {
        // High photosynthetic active area -> Pastel Mint / Emerald
        const intensity = Math.min(1.0, (ndvi - 0.12) / 0.25);
        d[i] = Math.round(134 * intensity + 30 * (1 - intensity));       // R
        d[i + 1] = Math.round(239 * intensity + 90 * (1 - intensity));   // G
        d[i + 2] = Math.round(172 * intensity + 60 * (1 - intensity));   // B
      } else if (ndvi > -0.05 && (g + r > 80)) {
        // Moderate / stressed tissue -> Soft Pastel Peach / Warm Ochre
        d[i] = 254;      // R
        d[i + 1] = 215;  // G
        d[i + 2] = 170;  // B
      } else {
        // Non-vegetative / background -> subtle cool monochrome
        const gray = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
        d[i] = Math.round(gray * 0.35 + 18);
        d[i + 1] = Math.round(gray * 0.35 + 24);
        d[i + 2] = Math.round(gray * 0.45 + 38);
      }
    }

    this.ctx.putImageData(imgData, 0, 0);
  }
}
