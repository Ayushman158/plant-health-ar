/**
 * LeafDetector — per-pixel colour and photometric analysis.
 *
 * This is a genuine measurement of the frame: hue/saturation/excess-green
 * classification per pixel, ambient light estimated from mean Rec.709 luma, and
 * a focus proxy from the summed luma gradient. It is *not* object recognition —
 * it knows "this pixel looks like foliage", not "this is a plant". Object
 * identity comes from PlantSegmenter; this pass supplies the health signal and
 * the fallback mask when segmentation is unavailable.
 */

/** Values written into the label mask. */
export const BACKGROUND = 0;
export const FOLIAGE = 1;
export const CHLOROSIS = 2;
export const NECROSIS = 3;
export const VARIEGATION = 4;

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

    // Rolling photometric lux light meter
    this.smoothLux = 420;

    // Foliage binary/intensity mask for real-time ASCII/dot-matrix leaf tracing
    this.leafMask = new Uint8Array(this.offscreenCanvas.width * this.offscreenCanvas.height);
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

    this.leafMask.fill(0);

    let greenPixelCount = 0;
    let minX = sw, maxX = 0, minY = sh, maxY = 0;
    let sumX = 0, sumY = 0;
    let sumChlorophyll = 0;

    // Pathology counters on detected foliage
    let chlorosisPixels = 0;
    let necrosisPixels = 0;
    let variegationPixels = 0;

    // Photometric ambient light calculation
    let totalLuma = 0;
    let sharpnessSum = 0;
    let prevLuma = 0;

    const totalPixels = sw * sh;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Photometric luma calculation (Rec. 709)
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      totalLuma += luma;

      // Real-time focus & sharpness indicator (horizontal gradient difference)
      if (i > 0) {
        sharpnessSum += Math.abs(luma - prevLuma);
      }
      prevLuma = luma;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;

      // 1. Reject bright emissive laptop/monitor screens (white/light gray documents or browser)
      if (r > 190 && g > 190 && b > 190 && delta < 32) {
        continue;
      }

      // 2. Reject neutral dark surfaces (laptop chassis, gray keyboards, dark desks)
      if (max < 26 && delta < 10) {
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

      // 3. Reject human skin tones (hue < 38° or > 340° with red prominence)
      if ((hue < 38 || hue > 340) && r > g && g >= b && (delta / max) > 0.15) {
        continue;
      }

      const sat = delta / max;
      const egi = 2 * g - r - b;

      // 4. Calibrated Botanical Foliage Criteria (Webcam & Mobile Indoor Tuned):
      // Supports Golden Pothos / Money Plant variegation (yellow-gold hues),
      // indoor auto-white-balance, and real chlorophyll absorption:
      // a) Hue: 42° - 165° (golden variegation 42°-65° through deep emerald 70°-165°)
      // b) Saturation: sat >= 0.16 (holds under indoor webcam exposure)
      // c) Green prominence: g >= 32, g > b * 1.08, and egi >= 6
      const isFoliage = (hue >= 42 && hue <= 165) &&
                        (sat >= 0.16) &&
                        (g >= 32) &&
                        (g > b * 1.08) &&
                        (egi >= 6);

      if (isFoliage) {
        const pixIdx = (i / 4);
        const px = pixIdx % sw;
        const py = Math.floor(pixIdx / sw);

        greenPixelCount++;
        sumX += px;
        sumY += py;

        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;

        // Relative chlorophyll proxy from green prominence
        const chloroVal = Math.min(100, Math.max(20, Math.round(((egi + delta) / 100) * 100)));
        sumChlorophyll += chloroVal;

        let maskVal = 1;
        // - Chlorosis (yellowing/water stress): Hue 42°-56° with high brightness
        if (hue >= 42 && hue <= 56 && g > 70) {
          chlorosisPixels++;
          maskVal = 2;
        }
        // - Variegation (golden marbling in Money Plants): Hue 57°-76° with moderate-to-high saturation
        else if (hue >= 57 && hue <= 76 && sat >= 0.24) {
          variegationPixels++;
          maskVal = 4;
        }
        this.leafMask[pixIdx] = maskVal;
      } else {
        const pixIdx = (i / 4);
        // - Necrosis check on boundary pixels: brown crispy leaf edges (dry air/underwatering)
        if (hue >= 18 && hue <= 40 && sat >= 0.22 && luma < 130 && luma > 24) {
          necrosisPixels++;
          this.leafMask[pixIdx] = 3;
        }
      }
    }

    // Photometric ambient room light (Lux estimation)
    const avgLuma = totalLuma / totalPixels;
    const instantLux = Math.round(Math.pow(avgLuma / 255, 1.6) * 1400 + 40);
    this.smoothLux += (instantLux - this.smoothLux) * 0.12;
    const currentLux = Math.round(this.smoothLux);

    let lightStatus = {
      lux: currentLux,
      label: 'Bright Indirect',
      status: 'optimal',
      tip: 'Ideal lighting for Money Plant'
    };
    if (currentLux < 220) {
      lightStatus = {
        lux: currentLux,
        label: 'Low Light',
        status: 'dim',
        tip: 'Dim room light; place closer to indirect window light'
      };
    } else if (currentLux > 900) {
      lightStatus = {
        lux: currentLux,
        label: 'Direct Sun',
        status: 'bright',
        tip: 'Direct sunlight; protect tender leaves from scorching'
      };
    }

    // Pre-flight Focus & Sharpness Quality
    const avgSharpness = sharpnessSum / totalPixels;
    const isSharpFocus = avgSharpness > 10;

    const coverage = greenPixelCount / totalPixels;
    this.foliageCoverage = coverage;

    // Minimum coverage threshold: at least 0.8% of frame (detects even single leaves / small vines)
    const hasEnoughFoliage = greenPixelCount >= Math.round(totalPixels * 0.008);

    if (hasEnoughFoliage) {
      this.lostFrames = 0;
      this.detectedFrames++;
      if (this.detectedFrames >= 1) {
        this.isPlantDetected = true;
      }
    } else {
      this.detectedFrames = 0;
      this.lostFrames++;
      // Debounced hysteresis: keep lock for ~30 frames of brief movement
      if (this.lostFrames >= 30) {
        this.isPlantDetected = false;
      }
    }

    if (this.isPlantDetected && greenPixelCount > 0) {
      const normMinX = minX / sw;
      const normMaxX = maxX / sw;
      const normMinY = minY / sh;
      const normMaxY = maxY / sh;

      const targetX = Math.max(0.04, normMinX - 0.03);
      const targetY = Math.max(0.04, normMinY - 0.03);
      const targetW = Math.min(0.92, (normMaxX - normMinX) + 0.06);
      const targetH = Math.min(0.92, (normMaxY - normMinY) + 0.06);

      // Smooth spatial box interpolation
      const lerp = 0.25;
      this.smoothBox.x += (targetX - this.smoothBox.x) * lerp;
      this.smoothBox.y += (targetY - this.smoothBox.y) * lerp;
      this.smoothBox.width += (targetW - this.smoothBox.width) * lerp;
      this.smoothBox.height += (targetH - this.smoothBox.height) * lerp;

      const centroid = {
        x: (sumX / greenPixelCount) / sw,
        y: (sumY / greenPixelCount) / sh
      };

      const avgChlorophyll = Math.min(99, Math.max(50, Math.round(sumChlorophyll / greenPixelCount)));

      // Pathology percentages
      const chlorosisRate = Math.min(40, Math.round((chlorosisPixels / greenPixelCount) * 100));
      const necrosisRate = Math.min(30, Math.round((necrosisPixels / Math.max(1, greenPixelCount * 0.12)) * 100));
      const variegationRate = Math.min(55, Math.round((variegationPixels / greenPixelCount) * 100));

      // Dynamic calculated health score based on genuine leaf metrics
      let computedHealth = 96;
      computedHealth -= Math.round(chlorosisRate * 1.5);
      computedHealth -= Math.round(necrosisRate * 2.0);
      if (currentLux < 200) computedHealth -= 5;
      if (currentLux > 900) computedHealth -= 4;
      computedHealth = Math.min(99, Math.max(52, computedHealth));

      // Dynamic Diagnostic Clinical Guidance
      let diagnosisCategory = 'optimal';
      let diagnosisHeadline = 'Optimal Foliage Vitality';
      let diagnosisAdvice = 'Vibrant chlorophyll absorption detected. Foliage exhibits healthy cellular vigor and balanced variegation.';

      if (chlorosisRate >= 16) {
        diagnosisCategory = 'chlorosis';
        diagnosisHeadline = 'Chlorosis / Leaf Yellowing';
        diagnosisAdvice = 'Yellowing observed on foliage. Typically caused by soil overwatering or poor pot drainage. Allow the top 2 inches of potting mix to dry between waterings.';
      } else if (necrosisRate >= 12) {
        diagnosisCategory = 'necrosis';
        diagnosisHeadline = 'Marginal Leaf Tip Browning';
        diagnosisAdvice = 'Dry crispy margins detected. Usually triggered by low indoor ambient humidity or dry air. Mist leaves with water and keep away from AC vents.';
      } else if (currentLux < 220) {
        diagnosisCategory = 'dim';
        diagnosisHeadline = 'Insufficient Light Level';
        diagnosisAdvice = `Ambient light is low (${currentLux} lx). Money Plants tolerate dim corners, but brighter indirect light will stimulate vibrant golden marbling and faster growth.`;
      } else if (currentLux > 900) {
        diagnosisCategory = 'bright';
        diagnosisHeadline = 'Direct Sunlight Warning';
        diagnosisAdvice = `Light is intense (${currentLux} lx). Shield your Money Plant from harsh direct midday rays to avoid bleached or scorched leaves.`;
      }

      // Distance guidance
      const boxArea = this.smoothBox.width * this.smoothBox.height;
      let distanceTip = 'Money Plant Locked';
      if (boxArea < 0.05) {
        distanceTip = 'Bring leaf slightly closer';
      } else if (boxArea > 0.85) {
        distanceTip = 'Step back slightly';
      }

      return {
        detected: true,
        box: { ...this.smoothBox },
        centroid,
        coverage: Math.round(coverage * 100),
        liveChlorophyll: avgChlorophyll,
        light: lightStatus,
        isSharp: isSharpFocus,
        distanceTip,
        diagnosis: {
          category: diagnosisCategory,
          headline: diagnosisHeadline,
          advice: diagnosisAdvice,
          healthScore: computedHealth,
          chlorosisRate,
          necrosisRate,
          variegationRate
        },
        mask: this.leafMask,
        maskWidth: sw,
        maskHeight: sh
      };
    } else {
      return {
        detected: false,
        box: { ...this.smoothBox },
        centroid: { x: 0.5, y: 0.5 },
        coverage: 0,
        liveChlorophyll: 0,
        light: lightStatus,
        isSharp: isSharpFocus,
        distanceTip: 'Align Money Plant in Viewfinder',
        diagnosis: {
          category: 'searching',
          headline: 'Searching for Money Plant...',
          advice: 'Hold your Money Plant leaves within the viewfinder. The computer vision scanner will automatically trace and analyze foliage health.',
          healthScore: 0,
          chlorosisRate: 0,
          necrosisRate: 0,
          variegationRate: 0
        },
        mask: this.leafMask,
        maskWidth: sw,
        maskHeight: sh,
      };
    }
  }
}


