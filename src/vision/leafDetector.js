/**
 * LeafDetector (Colorimetric Computer Vision)
 * Performs real-time pixel segmentation to detect plant foliage,
 * computing bounding box, centroid, and vegetative health indicators.
 */
export class LeafDetector {
  constructor() {
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = 160;
    this.offscreenCanvas.height = 120;
    this.offCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });

    this.smoothBox = { x: 0.15, y: 0.15, width: 0.7, height: 0.7 };
    this.isPlantDetected = false;
    this.foliageCoverage = 0;
  }

  analyze(sourceCanvas) {
    if (!sourceCanvas || sourceCanvas.width === 0 || sourceCanvas.height === 0) {
      return null;
    }

    const sw = this.offscreenCanvas.width;
    const sh = this.offscreenCanvas.height;

    // Draw downsampled frame for 60fps computer vision pass
    this.offCtx.drawImage(sourceCanvas, 0, 0, sw, sh);
    const frameData = this.offCtx.getImageData(0, 0, sw, sh);
    const data = frameData.data;

    let greenPixelCount = 0;
    let minX = sw, maxX = 0, minY = sh, maxY = 0;
    let sumX = 0, sumY = 0;

    let sumChlorophyll = 0;

    const totalPixels = sw * sh;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Excess Green Index (EGI = 2*G - R - B)
      const egi = 2 * g - r - b;

      // Foliage criteria: prominent green channel or high EGI with sufficient brightness
      const isGreen = egi > 14 && g > 38 && g > r * 1.05;

      if (isGreen) {
        const px = (i / 4) % sw;
        const py = Math.floor((i / 4) / sw);

        greenPixelCount++;
        sumX += px;
        sumY += py;

        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;

        // Relative chlorophyll concentration proxy
        const chloroVal = Math.min(100, Math.max(0, (egi / 150) * 100));
        sumChlorophyll += chloroVal;
      }
    }

    const coverage = greenPixelCount / totalPixels;
    this.foliageCoverage = coverage;

    if (greenPixelCount > totalPixels * 0.04) {
      this.isPlantDetected = true;

      const normMinX = minX / sw;
      const normMaxX = maxX / sw;
      const normMinY = minY / sh;
      const normMaxY = maxY / sh;

      const targetX = Math.max(0.08, normMinX - 0.04);
      const targetY = Math.max(0.08, normMinY - 0.04);
      const targetW = Math.min(0.88, (normMaxX - normMinX) + 0.08);
      const targetH = Math.min(0.88, (normMaxY - normMinY) + 0.08);

      // Smooth box interpolation for steady spatial reticle
      const lerp = 0.18;
      this.smoothBox.x += (targetX - this.smoothBox.x) * lerp;
      this.smoothBox.y += (targetY - this.smoothBox.y) * lerp;
      this.smoothBox.width += (targetW - this.smoothBox.width) * lerp;
      this.smoothBox.height += (targetH - this.smoothBox.height) * lerp;

      const centroid = {
        x: (sumX / greenPixelCount) / sw,
        y: (sumY / greenPixelCount) / sh
      };

      const avgChlorophyll = Math.round(sumChlorophyll / greenPixelCount);

      return {
        detected: true,
        box: { ...this.smoothBox },
        centroid,
        coverage: Math.round(coverage * 100),
        liveChlorophyll: Math.min(99, Math.max(60, avgChlorophyll + 40))
      };
    } else {
      this.isPlantDetected = false;
      return {
        detected: false,
        box: { ...this.smoothBox },
        centroid: { x: 0.5, y: 0.5 },
        coverage: 0,
        liveChlorophyll: 0
      };
    }
  }
}
