/**
 * maskAnalysis — geometry extracted from a binary mask.
 *
 * Connected components give us real regions (each blob is a leaf cluster we can
 * actually point at), and Moore-neighbour boundary tracing gives a true
 * silhouette including concavities. The previous approach — keeping the
 * farthest edge pixel in each of 36 angular sectors around the centroid — can
 * only ever produce a star-shaped hull, so the gaps between leaves were
 * geometrically unrepresentable no matter how the drawing was tuned.
 */

/**
 * 4-connected component labelling.
 * @returns {{labels: Int32Array, components: Array}} components sorted largest first.
 */
export function labelComponents(mask, w, h, minArea = 24) {
  const labels = new Int32Array(w * h).fill(-1);
  const components = [];
  const stack = new Int32Array(w * h);
  // Components below minArea are labelled DROPPED so their pixels are not
  // rescanned, without burning a label id that a later component would reuse.
  const DROPPED = -2;
  let nextId = 0;

  for (let seed = 0; seed < mask.length; seed++) {
    if (mask[seed] === 0 || labels[seed] !== -1) continue;

    const id = nextId;
    let sp = 0;
    stack[sp++] = seed;
    labels[seed] = id;

    let area = 0;
    let sumX = 0;
    let sumY = 0;
    let minX = w;
    let maxX = 0;
    let minY = h;
    let maxY = 0;
    const members = [];

    while (sp > 0) {
      const idx = stack[--sp];
      const x = idx % w;
      const y = (idx / w) | 0;

      members.push(idx);
      area++;
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      if (x > 0 && mask[idx - 1] && labels[idx - 1] === -1) { labels[idx - 1] = id; stack[sp++] = idx - 1; }
      if (x < w - 1 && mask[idx + 1] && labels[idx + 1] === -1) { labels[idx + 1] = id; stack[sp++] = idx + 1; }
      if (y > 0 && mask[idx - w] && labels[idx - w] === -1) { labels[idx - w] = id; stack[sp++] = idx - w; }
      if (y < h - 1 && mask[idx + w] && labels[idx + w] === -1) { labels[idx + w] = id; stack[sp++] = idx + w; }
    }

    if (area < minArea) {
      for (let i = 0; i < members.length; i++) labels[members[i]] = DROPPED;
      continue;
    }

    nextId++;
    components.push({
      id,
      area,
      // Row-major scan order makes the seed the topmost-then-leftmost pixel of
      // the component, which is a valid boundary-trace start.
      seed,
      centroid: { x: sumX / area / w, y: sumY / area / h },
      bbox: {
        x: minX / w,
        y: minY / h,
        width: (maxX - minX + 1) / w,
        height: (maxY - minY + 1) / h,
      },
    });
  }

  components.sort((a, b) => b.area - a.area);
  return { labels, components };
}

const MOORE = [
  [1, 0], [1, 1], [0, 1], [-1, 1],
  [-1, 0], [-1, -1], [0, -1], [1, -1],
];

/**
 * Moore-neighbour boundary trace with Jacob's stopping criterion.
 * Returns pixel-space points walking the silhouette of one component.
 */
export function traceBoundary(mask, w, h, startIdx, maxPoints = 4000) {
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : mask[y * w + x]);

  const startX = startIdx % w;
  const startY = (startIdx / w) | 0;
  if (!at(startX, startY)) return [];

  const contour = [{ x: startX, y: startY }];
  let cx = startX;
  let cy = startY;
  // `dir` is the direction we last moved IN. The pixel we came from is at
  // (dir + 4) % 8, and the clockwise sweep resumes one step past it. The seed
  // is the topmost-then-leftmost pixel, so treat it as entered heading east —
  // that puts the backtrack to its west, which is guaranteed to be background.
  let dir = 0;

  // Jacob's stopping criterion: the trace is closed only when we re-enter the
  // start pixel *and* the next step repeats the original second pixel. Stopping
  // on the first revisit alone terminates early on shapes whose start corner is
  // reachable from two directions, which truncated the contour to a stub.
  let secondX = -1;
  let secondY = -1;

  for (let guard = 0; guard < maxPoints; guard++) {
    let moved = false;

    for (let i = 0; i < 8; i++) {
      const d = (dir + 5 + i) % 8;
      const nx = cx + MOORE[d][0];
      const ny = cy + MOORE[d][1];

      if (at(nx, ny)) {
        if (secondX === -1) {
          secondX = nx;
          secondY = ny;
        } else if (cx === startX && cy === startY && nx === secondX && ny === secondY) {
          return contour;
        }

        cx = nx;
        cy = ny;
        dir = d;
        contour.push({ x: cx, y: cy });
        moved = true;
        break;
      }
    }

    if (!moved) break; // isolated pixel
  }

  return contour;
}

/** Perpendicular-distance polyline simplification (Douglas-Peucker). */
export function simplify(points, epsilon) {
  if (points.length < 3) return points.slice();

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack = [[0, points.length - 1]];

  while (stack.length) {
    const [first, last] = stack.pop();
    if (last <= first + 1) continue;

    const ax = points[first].x;
    const ay = points[first].y;
    const bx = points[last].x;
    const by = points[last].y;
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;

    let maxDist = -1;
    let maxIdx = -1;

    for (let i = first + 1; i < last; i++) {
      const px = points[i].x - ax;
      const py = points[i].y - ay;
      // Squared perpendicular distance, avoiding a sqrt per point.
      const dist = lenSq === 0
        ? px * px + py * py
        : (px * dy - py * dx) ** 2 / lenSq;

      if (dist > maxDist) {
        maxDist = dist;
        maxIdx = i;
      }
    }

    if (maxDist > epsilon * epsilon && maxIdx > 0) {
      keep[maxIdx] = 1;
      stack.push([first, maxIdx], [maxIdx, last]);
    }
  }

  const out = [];
  for (let i = 0; i < points.length; i++) {
    if (keep[i]) out.push(points[i]);
  }
  return out;
}

/** Chaikin corner cutting — rounds the staircase left by a pixel-grid trace. */
export function chaikin(points, iterations = 2) {
  let pts = points;

  for (let it = 0; it < iterations; it++) {
    if (pts.length < 4) return pts;
    const next = [];

    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      next.push(
        { x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 },
        { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 },
      );
    }
    pts = next;
  }

  return pts;
}

/**
 * Full silhouette pipeline: trace the component, drop pixel noise, round it,
 * and normalise to 0..1 so the result is resolution-independent.
 */
export function silhouette(mask, w, h, component, { epsilon = 1.6, smoothing = 2 } = {}) {
  const traced = traceBoundary(mask, w, h, component.seed);
  if (traced.length < 12) return [];

  const simplified = simplify(traced, epsilon);
  if (simplified.length < 6) return [];

  return chaikin(simplified, smoothing).map((p) => ({ x: p.x / w, y: p.y / h }));
}

/**
 * Two-pass chamfer distance transform. Each set pixel gets its approximate
 * distance to the nearest background pixel, in pixel units.
 */
export function distanceTransform(mask, w, h) {
  const INF = 1e9;
  const dist = new Float32Array(w * h);

  for (let i = 0; i < mask.length; i++) dist[i] = mask[i] ? INF : 0;

  // Chamfer 3-4 weights approximate Euclidean distance to within ~2%.
  const D1 = 1;
  const D2 = 1.41421356;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (dist[i] === 0) continue;
      let d = dist[i];
      if (y > 0) d = Math.min(d, dist[i - w] + D1);
      if (x > 0) d = Math.min(d, dist[i - 1] + D1);
      if (y > 0 && x > 0) d = Math.min(d, dist[i - w - 1] + D2);
      if (y > 0 && x < w - 1) d = Math.min(d, dist[i - w + 1] + D2);
      dist[i] = d;
    }
  }

  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (dist[i] === 0) continue;
      let d = dist[i];
      if (y < h - 1) d = Math.min(d, dist[i + w] + D1);
      if (x < w - 1) d = Math.min(d, dist[i + 1] + D1);
      if (y < h - 1 && x < w - 1) d = Math.min(d, dist[i + w + 1] + D2);
      if (y < h - 1 && x > 0) d = Math.min(d, dist[i + w - 1] + D2);
      dist[i] = d;
    }
  }

  return dist;
}

/**
 * Medial-axis ridge points: pixels that are local maxima of the distance
 * transform along at least one axis. This is the mask's own structure — the
 * centre lines of stems and leaf blades — not a decorative wireframe. On a
 * trailing vine it is genuinely noisy, which is why callers thin it further and
 * draw it faintly rather than as confident anatomy.
 *
 * @returns array of `{x, y, thickness}` in normalised coordinates.
 */
export function medialAxis(mask, w, h, { minThickness = 1.6, stride = 1 } = {}) {
  const dist = distanceTransform(mask, w, h);
  const points = [];

  for (let y = 1; y < h - 1; y += stride) {
    for (let x = 1; x < w - 1; x += stride) {
      const i = y * w + x;
      const d = dist[i];
      if (d < minThickness) continue;

      const horizontalRidge = d >= dist[i - 1] && d >= dist[i + 1];
      const verticalRidge = d >= dist[i - w] && d >= dist[i + w];
      if (!horizontalRidge && !verticalRidge) continue;

      points.push({ x: x / w, y: y / h, thickness: d });
    }
  }

  return points;
}


/**
 * Shape statistics for the largest component of a binary mask.
 *
 * Used to tell foliage from packaging without an object model. Leaves form an
 * irregular region: lobed, gappy, long perimeter for its area. A bottle cap or
 * a cereal packet is a compact blob that nearly fills its bounding box.
 *
 * `compactness` is 4*pi*area / perimeter^2 — 1.0 for a perfect circle, lower
 * the more ragged the outline. `fill` is the share of the bounding box the
 * component occupies.
 */
export function shapeStats(mask, w, h, minArea = 32) {
  const { components } = labelComponents(mask, w, h, minArea);
  if (components.length === 0) return null;

  const c = components[0];
  const boundary = traceBoundary(mask, w, h, c.seed);
  if (boundary.length < 8) return null;

  let perimeter = 0;
  for (let i = 1; i < boundary.length; i++) {
    const dx = boundary[i].x - boundary[i - 1].x;
    const dy = boundary[i].y - boundary[i - 1].y;
    perimeter += Math.hypot(dx, dy);
  }
  if (perimeter <= 0) return null;

  const boxArea = c.bbox.width * w * c.bbox.height * h;

  return {
    areaShare: c.area / (w * h),
    compactness: (4 * Math.PI * c.area) / (perimeter * perimeter),
    fill: boxArea > 0 ? c.area / boxArea : 0,
    components: components.length,
  };
}
