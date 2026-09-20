/**
 * DebugHud — on-screen telemetry, enabled with `?debug`.
 *
 * Exists because the interesting failures live on a phone, and the only other
 * way to read this state on iOS is tethering to a Mac with Web Inspector. The
 * two bugs that actually shipped — a wedged segmentation callback and frames
 * fed from a hidden video element — were both invisible from the UI and
 * obvious from these numbers.
 *
 * Deliberately plain: no styling flourishes, just the values that distinguish
 * one failure from another.
 */

const REFRESH_MS = 250;

export class DebugHud {
  constructor() {
    this.enabled = new URLSearchParams(location.search).has('debug');
    if (!this.enabled) return;

    this.el = document.createElement('div');
    this.el.className = 'debug-hud';
    this.el.addEventListener('click', () => this.el.classList.toggle('is-min'));
    document.body.appendChild(this.el);

    this.lastPaint = 0;
    this.frames = 0;
    this.fps = 0;
    this.fpsWindowStart = performance.now();
  }

  /** Called every render frame; throttles its own DOM writes. */
  update(app, nowMs) {
    if (!this.enabled) return;

    this.frames++;
    if (nowMs - this.fpsWindowStart >= 1000) {
      this.fps = Math.round((this.frames * 1000) / (nowMs - this.fpsWindowStart));
      this.frames = 0;
      this.fpsWindowStart = nowMs;
    }

    if (nowMs - this.lastPaint < REFRESH_MS) return;
    this.lastPaint = nowMs;

    const a = app.latest;
    const seg = app.analyzer.segmenter;
    const health = a?.segmenterHealth;
    const cam = app.camera;

    const v = cam.video;
    const track = cam.stream?.getVideoTracks?.()[0];

    const rows = [
      ['fps', this.fps],
      ['phase', app.phase + (app.frozen ? ' (FROZEN)' : '')],
      ['hasFrame', String(app.lastHadFrame)],
      ['camera', cam.isLiveCamera ? 'live' : (cam.activeSpecimenImage ? 'still' : 'none')],
      ['video', v?.videoWidth ? `${v.videoWidth}x${v.videoHeight}` : '—'],
      ['readyState', v?.readyState ?? '—'],
      ['paused', v ? String(v.paused) : '—'],
      ['trackState', track ? `${track.readyState}/${track.enabled ? 'on' : 'off'}${track.muted ? '/muted' : ''}` : '—'],
      ['canvas', `${app.displayCanvas.width}x${app.displayCanvas.height}`],
      ['—segmenter—', ''],
      ['loaded', String(seg.available)],
      ['loadErr', seg.failureReason ? String(seg.failureReason).slice(0, 42) : 'none'],
      ['maskDims', seg.width ? `${seg.width}x${seg.height}` : '—'],
      ['coverage', seg.coverage ? seg.coverage.toFixed(4) : '0'],
      ['stalledMs', health ? health.stalledForMs : '—'],
      ['dropped', seg.droppedCallbacks],
      ['reloads', seg.reloads],
      ['inFlight', String(seg.inFlight)],
      ['—detection—', ''],
      ['detected', String(a?.detected)],
      ['source', a?.source ?? '—'],
      ['degraded', String(a?.degraded)],
      ['contour', a?.contour?.length ?? 0],
      ['leaves', (a?.leaves || []).map((l) => l.ordinal).join(',') || 'none'],
      ['vitality', a?.diagnosis?.healthScore ?? '—'],
      ['raw', a?.diagnosis?.instantScore ?? '—'],
      ['lux', a?.light?.lux ?? '—'],
    ];

    this.el.innerHTML = rows
      .map(([k, v]) => (v === ''
        ? `<div class="debug-sep">${k}</div>`
        : `<div class="debug-row"><span>${k}</span><b>${v}</b></div>`))
      .join('');
  }
}
