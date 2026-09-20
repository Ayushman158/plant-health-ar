/**
 * Maps normalised frame coordinates (0..1 over the camera image) to CSS pixels
 * in the viewport.
 *
 * The camera canvas is laid out with `object-fit: cover`, so whenever the video
 * aspect ratio differs from the screen's, part of the frame is cropped away.
 * Positioning an overlay with raw percentages ignores that crop and drifts the
 * further a marker sits from centre — which is exactly the kind of error that
 * reads as "the tracking is bad" when the tracking is fine.
 */
export function coverTransform(frameW, frameH, viewW, viewH) {
  if (!frameW || !frameH || !viewW || !viewH) {
    return { scale: 1, offsetX: 0, offsetY: 0, frameW: 1, frameH: 1 };
  }

  const scale = Math.max(viewW / frameW, viewH / frameH);
  return {
    scale,
    offsetX: (viewW - frameW * scale) / 2,
    offsetY: (viewH - frameH * scale) / 2,
    frameW,
    frameH,
  };
}

/** Normalised frame point → viewport CSS pixels. */
export function toScreen(nx, ny, t) {
  return {
    x: t.offsetX + nx * t.frameW * t.scale,
    y: t.offsetY + ny * t.frameH * t.scale,
  };
}

/** Viewport CSS pixels → normalised frame point (inverse of `toScreen`). */
export function toFrame(px, py, t) {
  return {
    x: (px - t.offsetX) / (t.frameW * t.scale),
    y: (py - t.offsetY) / (t.frameH * t.scale),
  };
}
