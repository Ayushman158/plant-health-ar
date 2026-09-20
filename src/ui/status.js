/**
 * One definition of the health status and its wording.
 *
 * This lived in two places and drifted: the result card could show the headline
 * "Worth a closer look" above the body text "looks vibrant with no major issues
 * detected", because the headline read the score and the body read the category.
 * That happens whenever several sub-threshold problems add up — no single
 * condition is flagged, but the score still lands in the 50s.
 */

export function statusFor(diagnosis = {}) {
  if (diagnosis.category === 'necrosis') return 'concern';
  if (diagnosis.category === 'chlorosis') return 'watch';
  if (diagnosis.healthScore >= 85) return 'healthy';
  if (diagnosis.healthScore >= 70) return 'watch';
  return 'concern';
}

/** Short label for the top-bar chip. */
export function statusChipLabel(status) {
  return { healthy: 'Healthy', watch: 'Watch', concern: 'Attention' }[status] || 'Searching';
}

/** Fuller label for the diagnosis sheet. */
export function statusSheetLabel(status) {
  return {
    healthy: 'Healthy',
    watch: 'Worth watching',
    concern: 'Needs attention',
  }[status] || 'Unknown';
}

export function headlineFor(diagnosis, status) {
  switch (diagnosis.category) {
    case 'necrosis': return 'Possible edge browning';
    case 'chlorosis': return 'Possible yellowing';
    case 'dim': return 'Low light';
    case 'bright': return 'Strong direct light';
    default:
      return status === 'healthy' ? 'Looks healthy' : 'Worth a closer look';
  }
}

export function summaryFor(diagnosis, analysis, status) {
  switch (diagnosis.category) {
    case 'chlorosis':
      return 'Some yellowing in the foliage. Check soil moisture and drainage.';
    case 'necrosis':
      return 'Dry, brown leaf margins. Often low humidity or dry air.';
    case 'dim':
      return `Room light reads around ${analysis.light?.lux} lx. Brighter indirect light would help.`;
    case 'bright':
      return `Light reads around ${analysis.light?.lux} lx. Shield it from harsh midday sun.`;
    default:
      // No single condition crossed its threshold. Say that, rather than
      // claiming everything is vibrant while the headline hedges.
      return status === 'healthy'
        ? 'Your money plant looks vibrant with no major issues detected.'
        : 'No single clear problem, but leaf colour is a little uneven overall.';
  }
}
