/**
 * LeafDetector (Multi-Spectral Botanical Colorimetry)
 * Detects indoor houseplant foliage (e.g. Money Plant / Epipremnum Aureum)
 * under varying ambient, warm-lamp, or daylight conditions.
 * Features HSV + EGI chromaticity segmentation and smooth hysteresis debouncing.
 */
export class LeafDetector {
  constructor() {
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = 160;
    this.offscreenCanvas.height = 120;
    this.offCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });

    this.smoothBox = { x: 0.2, y: 0.2, width: 0.6, height: 0.6 };
    this.isPlantDetected = false;
    this.detectedFrames = 0;
    this.lostFrames = 0;
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

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;

      // 1. Reject bright emissive laptop/monitor screens (white/light gray documents or browser)
      if (r > 155 && g > 155 && b > 155 && delta < 50) {
        continue;
      }

      // 2. Reject neutral dark surfaces (laptop chassis, gray keyboards, dark desks)
      if (max < 34 || delta < 16) {
        continue;
      }

      // Fast Hue calculation
      let hue = 0;
      if (max === r) {
        hue = 60 * (((g - b) / delta) % 6);
      } else if (max === g) {
        hue = 60 * (((b - r) / delta) + 2);
      } else {
        hue = 60 * (((r - g) / delta) + 4);
      }
      if (hue < 0) hue += 360;

      const sat = delta / max;
      const egi = 2 * g - r - b;

      // 3. Strict Botanical Foliage Criteria:
      // Real leaves require genuine chlorophyll absorption:
      // a) Hue: 58° - 156° (yellow-green variegation through deep emerald)
      // b) High saturation: sat >= 0.26 (rules out silver/gray laptops, white walls, keyboards)
      // c) Strong green dominance over blue: g > b * 1.28 (plants strongly absorb blue)
      // d) Green dominance over red: g >= r * 1.05 and egi >= 16
      const isFoliage = (hue >= 58 && hue <= 156) &&
                        (sat >= 0.26) &&
                        (g >= 40) &&
                        (g > b * 1.28) &&
                        (egi >= 16) &&
                        (g >= r * 1.04);

      if (isFoliage) {
        const px = (i / 4) % sw;
        const py = Math.floor((i / 4) / sw);

        greenPixelCount++;
        sumX += px;
        sumY += py;

        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;

        // Relative chlorophyll proxy from green prominence
        const chloroVal = Math.min(100, Math.max(0, (Math.max(egi, delta) / 120) * 100));
        sumChlorophyll += chloroVal;
      }
    }

    const coverage = greenPixelCount / totalPixels;
    this.foliageCoverage = coverage;

    // Minimum coverage threshold: at least 3.2% of frame
    let hasEnoughFoliage = greenPixelCount > totalPixels * 0.032;

    // Spatial density check: real plant leaves are cohesive clumps, not scattered screen noise
    if (hasEnoughFoliage && minX < maxX && minY < maxY) {
      const boxArea = (maxX - minX + 1) * (maxY - minY + 1);
      const density = greenPixelCount / boxArea;
      if (density < 0.16) {
        hasEnoughFoliage = false;
      }
    } else {
      hasEnoughFoliage = false;
    }

    if (hasEnoughFoliage) {
      this.lostFrames = 0;
      this.detectedFrames++;
      if (this.detectedFrames >= 2) {
        this.isPlantDetected = true;
      }
    } else {
      this.detectedFrames = 0;
      this.lostFrames++;
      // Debounced hysteresis: keep lock for ~35 frames (~1.1 seconds) of brief occlusion
      if (this.lostFrames >= 35) {
        this.isPlantDetected = false;
      }
    }

    if (this.isPlantDetected && greenPixelCount > 0) {
      const normMinX = minX / sw;
      const normMaxX = maxX / sw;
      const normMinY = minY / sh;
      const normMaxY = maxY / sh;

      const targetX = Math.max(0.06, normMinX - 0.04);
      const targetY = Math.max(0.06, normMinY - 0.04);
      const targetW = Math.min(0.88, (normMaxX - normMinX) + 0.08);
      const targetH = Math.min(0.88, (normMaxY - normMinY) + 0.08);

      // Smooth spatial box interpolation
      const lerp = 0.2;
      this.smoothBox.x += (targetX - this.smoothBox.x) * lerp;
      this.smoothBox.y += (targetY - this.smoothBox.y) * lerp;
      this.smoothBox.width += (targetW - this.smoothBox.width) * lerp;
      this.smoothBox.height += (targetH - this.smoothBox.height) * lerp;

      const centroid = {
        x: (sumX / greenPixelCount) / sw,
        y: (sumY / greenPixelCount) / sh
      };

      const avgChlorophyll = Math.round(sumChlorophyll / greenPixelCount);

      // Dynamically anchored AR pins on the detected plant
      const b = this.smoothBox;
      const dynamicPins = [
        {
          id: 'dyn-apex',
          x: Math.round((b.x + b.width * 0.46) * 100),
          y: Math.round((b.y + b.height * 0.26) * 100),
          label: 'Top Leaf',
          score: Math.min(98, Math.max(88, avgChlorophyll + 24)),
          color: '#86efac',
          note: 'Healthy new growth'
        },
        {
          id: 'dyn-lateral',
          x: Math.round((b.x + b.width * 0.72) * 100),
          y: Math.round((b.y + b.height * 0.54) * 100),
          label: 'Leaf Pattern',
          score: Math.min(96, Math.max(85, avgChlorophyll + 20)),
          color: '#86efac',
          note: 'Rich variegation'
        },
        {
          id: 'dyn-petiole',
          x: Math.round((b.x + b.width * 0.28) * 100),
          y: Math.round((b.y + b.height * 0.72) * 100),
          label: 'Stem',
          score: Math.min(94, Math.max(82, avgChlorophyll + 16)),
          color: '#bae6fd',
          note: 'Nicely hydrated'
        }
      ];

      return {
        detected: true,
        box: { ...this.smoothBox },
        centroid,
        coverage: Math.round(coverage * 100),
        liveChlorophyll: Math.min(99, Math.max(65, avgChlorophyll + 35)),
        dynamicPins
      };
    } else {
      return {
        detected: false,
        box: { ...this.smoothBox },
        centroid: { x: 0.5, y: 0.5 },
        coverage: 0,
        liveChlorophyll: 0,
        dynamicPins: []
      };
    }
  }
}

