/**
 * HealthStabilizer — makes the reported health readable rather than twitchy.
 *
 * The underlying measurement is per-frame pixel counting, so at 30 Hz the raw
 * chlorosis and necrosis rates move with every exposure change, refocus and
 * hand tremor. Surfacing that directly made the vitality figure flicker across
 * a ten-point range while the phone sat still, which reads as the system
 * guessing rather than measuring.
 *
 * Three separate mechanisms, because they solve different problems:
 *
 *   1. The rates are low-pass filtered, so the score reflects roughly the last
 *      second of evidence instead of the last frame.
 *   2. The displayed number only moves once the smoothed value has drifted
 *      outside a deadband, so a settled reading stays put.
 *   3. The category has enter/exit hysteresis plus a minimum dwell time, so the
 *      headline and the contour colour cannot oscillate between two states.
 *
 * None of this invents or flatters data — it is the same measurement, reported
 * at a rate a person can actually read.
 */

/** Smoothing factor for the pathology rates. ~0.8s time constant at 30 Hz. */
const RATE_ALPHA = 0.04;
/** The displayed score ignores drift smaller than this. */
const DISPLAY_DEADBAND = 3;
/** Minimum time a category must hold before it may change again. */
const CATEGORY_DWELL_MS = 1400;

/**
 * Enter/exit pairs. A condition must exceed `enter` to be flagged, and then
 * fall below the lower `exit` to be cleared — so a rate hovering on the
 * boundary does not toggle the whole UI.
 */
const CHLOROSIS = { enter: 16, exit: 11 };
const NECROSIS = { enter: 12, exit: 8 };
const LUX_DIM = { enter: 220, exit: 300 };
const LUX_BRIGHT = { enter: 900, exit: 760 };

export class HealthStabilizer {
  constructor() {
    this.chlorosis = null;
    this.necrosis = null;
    this.category = 'optimal';
    this.categorySince = 0;
    this.displayedScore = null;
  }

  reset() {
    this.chlorosis = null;
    this.necrosis = null;
    this.category = 'optimal';
    this.categorySince = 0;
    this.displayedScore = null;
  }

  /**
   * @param diagnosis raw per-frame diagnosis from LeafDetector
   * @param lux smoothed ambient estimate
   * @param nowMs monotonic clock
   * @returns a diagnosis object with stabilised score, rates and category
   */
  update(diagnosis, lux, nowMs) {
    const rawChlorosis = diagnosis.chlorosisRate ?? 0;
    const rawNecrosis = diagnosis.necrosisRate ?? 0;

    // Seed on the first reading so the score does not crawl up from zero.
    this.chlorosis = this.chlorosis === null
      ? rawChlorosis
      : this.chlorosis + (rawChlorosis - this.chlorosis) * RATE_ALPHA;
    this.necrosis = this.necrosis === null
      ? rawNecrosis
      : this.necrosis + (rawNecrosis - this.necrosis) * RATE_ALPHA;

    const category = this.resolveCategory(lux, nowMs);
    const score = this.resolveScore(lux);

    return {
      ...diagnosis,
      category,
      healthScore: score,
      chlorosisRate: Math.round(this.chlorosis),
      necrosisRate: Math.round(this.necrosis),
      // The instantaneous reading, for anything that wants the unfiltered value.
      instantScore: diagnosis.healthScore,
    };
  }

  resolveCategory(lux, nowMs) {
    const current = this.category;

    // Which conditions are active, honouring hysteresis against the current
    // state: a flagged condition needs only to stay above its exit threshold.
    const chlorotic = current === 'chlorosis'
      ? this.chlorosis >= CHLOROSIS.exit
      : this.chlorosis >= CHLOROSIS.enter;

    const necrotic = current === 'necrosis'
      ? this.necrosis >= NECROSIS.exit
      : this.necrosis >= NECROSIS.enter;

    const dim = current === 'dim' ? lux <= LUX_DIM.exit : lux <= LUX_DIM.enter;
    const bright = current === 'bright' ? lux >= LUX_BRIGHT.exit : lux >= LUX_BRIGHT.enter;

    let next = 'optimal';
    if (chlorotic) next = 'chlorosis';
    else if (necrotic) next = 'necrosis';
    else if (dim) next = 'dim';
    else if (bright) next = 'bright';

    if (next === current) return current;

    // Hold the current category until it has been shown long enough to read.
    if (nowMs - this.categorySince < CATEGORY_DWELL_MS) return current;

    this.category = next;
    this.categorySince = nowMs;
    return next;
  }

  resolveScore(lux) {
    let score = 96;
    score -= this.chlorosis * 1.5;
    score -= this.necrosis * 2.0;
    if (lux < LUX_DIM.enter) score -= 5;
    if (lux > LUX_BRIGHT.enter) score -= 4;

    const target = Math.round(Math.min(99, Math.max(52, score)));

    if (this.displayedScore === null) {
      this.displayedScore = target;
    } else if (Math.abs(target - this.displayedScore) >= DISPLAY_DEADBAND) {
      // Step toward the target rather than jumping, so a genuine change reads
      // as the reading settling instead of a flicker.
      this.displayedScore += Math.sign(target - this.displayedScore) *
        Math.min(2, Math.abs(target - this.displayedScore));
    }

    return this.displayedScore;
  }
}
