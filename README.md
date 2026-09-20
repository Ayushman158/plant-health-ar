# Money Plant — Botanical Health Scanner

Point a phone camera at a plant. The app locates the plant in the frame, draws a
contour around it, drops a small marker on each leaf region it can distinguish,
and reports what the leaf colour suggests about its health — attached to the
plant, not in a dashboard.

---

## Run it

```bash
npm install
npm run dev
```

`getUserMedia` needs a secure context. The dev server runs HTTPS via
`@vitejs/plugin-basic-ssl`, so the printed network URL works from a phone on the
same Wi-Fi (accept the self-signed certificate warning once).

```bash
npm run build      # → dist/
```

Deployed to **Vercel** from `main` (`vercel.json` pins the build). The GitHub
Pages workflow also still publishes `dist/` to the `gh-pages` branch.

`vercel.json` disables Vercel deployments for `gh-pages`: that branch holds only
built output with no `package.json`, so Vercel's automatic preview build for it
failed on every Pages deploy. If the failure emails continue, set an Ignored
Build Step in the dashboard instead:

```bash
if [ "$VERCEL_GIT_COMMIT_REF" = "gh-pages" ]; then exit 0; else exit 1; fi
```

`base` is `'./'`, so the bundle works from any subpath.

---

## What it actually does

The pipeline runs three stages per frame:

| Stage | File | Rate | Produces |
| --- | --- | --- | --- |
| Colour + photometrics | `vision/leafDetector.js` | every frame | foliage/chlorosis/necrosis/variegation label mask, estimated lux, focus proxy |
| Object segmentation | `vision/plantSegmenter.js` | ~8 Hz | binary "potted plant" mask from DeepLabV3 |
| Optical flow | `vision/flowTracker.js` | every frame | frame-to-frame displacement for anchor persistence |

`vision/plantAnalyzer.js` combines them into a single analysis object.
`vision/maskAnalysis.js` turns a mask into geometry: connected components,
Moore-neighbour boundary tracing, Douglas-Peucker simplification, Chaikin
smoothing, chamfer distance transform and medial axis.

### Honest capability level

This is **computer-vision overlay with 2D image-plane tracking**. It is not
world tracking and not 3D anchoring. Specifically:

- There is **no camera pose, no depth and no map of the scene.** Markers live in
  the image plane.
- Anchors are carried between segmentation runs by Lucas-Kanade optical flow, so
  they stay on their leaf as the camera pans. This is genuine frame-to-frame
  tracking, but it **drifts under rotation and cannot recover an anchor that
  leaves the frame** and comes back.
- When flow loses an anchor it is dimmed (`.is-drifting`) rather than shown as
  though it were still locked.

Moving to real world tracking would need WebXR hit-test (Android Chrome only) or
a commercial SLAM SDK. Neither is present.

### Segmentation gates detection

**Colour never decides whether a plant is present.** If the segmentation model
loaded, it is the sole authority; colour only measures health *within* the
region the model found.

This was learned the hard way. An earlier version fell back to the colour mask
whenever segmentation found less foliage than colour did — which meant a
confident "this is not a plant" was overridden by "but there is green in frame",
and a green-capped bottle of hand sanitiser was reported as a healthy money
plant with three leaves. Colour cannot tell foliage from packaging.

Verified against synthetic non-plants:

| scene | detected | segmentation coverage |
| --- | --- | --- |
| green bottle cap + green label | no | 0 |
| yellow packet | no | 0 |
| green book + yellow box | no | 0 |
| monstera photo | yes | 12.4% |
| pothos photo | yes | 23.3% |

Pathology rates are also recounted using only pixels inside the segmented
plant, so a yellow packet behind the pot cannot register as leaf yellowing.

If the model fails to load (older browser), the app falls back to colour-only
detection and the diagnosis sheet says so. That mode is explicitly degraded,
not equivalent.

A mask older than 700ms is treated as absent rather than reported as live —
otherwise a rejected frame leaves the previous mask in memory and the app
confidently describes a scene that has moved on.

### Leaf tracing (SlimSAM)

Tapping a leaf marker and choosing "Trace this leaf" freezes the frame, runs
SlimSAM once on it, and returns that leaf's actual boundary — not the blob
outline of a connected component. Metrics are then counted inside the traced
mask.

Freezing is deliberate: the mask belongs to one frame, so drawing it over a
moving feed would drift off the leaf it describes.

Two things worth knowing if you touch this:

- `post_process_masks` returns a **Tensor** with dims `[batch, numMasks,
  height, width]`, not a `RawImage`. It has no `.width`/`.height`.
- **Do not pick the candidate mask with the highest IoU score.** SAM emits three
  nested guesses; measured on a monstera the scores ran `[0.65, 0.78, 0.85]`
  while coverage ran `[18.7%, 0.2%, 0.1%]`, so the best-scored candidate was 774
  pixels of speckle. Selection filters to a plausible area range first, then
  takes the best score within it.

The weights (~13 MB) are self-hosted. The onnxruntime WASM is not: onnxruntime
ships several builds and transformers.js picks between them by browser feature
detection, so pinning `wasmPaths` overrides that and 404s on whichever variant
it actually wanted. Everything loads lazily on first use, so a user who never
traces a leaf never downloads it.

### What the numbers mean

Every figure comes from **leaf colour and frame brightness in the camera image**.

- **Vitality** is a rule-based score (`96 − chlorosis·1.5 − necrosis·2.0 − light
  penalties`, clamped 52–99). It is labelled "AI vitality estimate" everywhere it
  appears and is not a scientific measurement.
- **Foliage** and per-leaf readings are pixel counts within each region, and each
  leaf card states how many points it sampled.
- **Light** is estimated from mean Rec.709 luma. It is a relative indication, not
  a calibrated lux meter.
- **Hydration is not measured and is not shown.** Earlier versions displayed a
  "Hydration" tile that was a relabelling of leaf colour; nothing in the pipeline
  senses soil or water. That tile now reports ambient light, which is genuinely
  derived from the frame.

---

## Layout

```
index.html                camera stage, top bar, result card, two sheets
src/
  main.js                 shell + detection state machine (searching → detected → tracking)
  index.css               all styling; tokens at the top
  vision/
    cameraStream.js       getUserMedia, canvas compositing, gallery stills
    leafDetector.js       per-pixel colour + photometric analysis
    plantSegmenter.js     MediaPipe ImageSegmenter wrapper (optional, degrades gracefully)
    flowTracker.js        pyramidal Lucas-Kanade optical flow
    leafAnchors.js        stable tracked leaf regions with real per-region metrics
    maskAnalysis.js       components, boundary trace, simplify, smooth, distance transform, medial axis
    plantAnalyzer.js      orchestrates the stages; segmentation gates detection
    healthStabilizer.js   low-pass + hysteresis so the vitality figure is readable
    leafHealth.js         shared per-region colour metrics
    leafSegmenter.js      SlimSAM leaf tracing (lazy, optional)
  ui/
    arOverlay.js          contour + structure canvas rendering
    leafMarkers.js        DOM leaf markers and their detail cards
    diagnosis.js          result card + diagnosis sheet content
    sheet.js              shared bottom-sheet behaviour
    viewportMap.js        object-fit: cover coordinate mapping
    leafInspector.js      frozen-frame leaf tracing flow
    status.js             single source of status wording
public/
  mediapipe/wasm/         MediaPipe runtime, self-hosted (no CDN at runtime)
  models/deeplab_v3.tflite
  models/slimsam/         SlimSAM weights, self-hosted (~13 MB)
  assets/specimens/       test images
ml/
  train.py, model.py, …   MobileNetV2 disease classifier training
  exports/                trained ONNX + labels (NOT wired into the app — see below)
```

### The ONNX classifier is not used

`ml/exports/money_plant_mobilenet.onnx` is a trained 3-class MobileNetV2
(bacterial wilt / healthy / manganese toxicity). Nothing in `src/` loads it and
there is no `onnxruntime-web` dependency. It was moved out of `public/` so it is
not shipped in every deploy, but it remains in the repo.

Before wiring it up, re-validate the split: `ml/checkpoints/test_evaluation_report.json`
reports **1.000 accuracy with a perfect confusion matrix across 750 samples per
class**, which is far more consistent with augmented copies leaking between train
and test than with a genuinely perfect model.

---

## Dependencies

| Package | Licence | Why |
| --- | --- | --- |
| `vite` | MIT | build + dev server |
| `@vitejs/plugin-basic-ssl` | MIT | HTTPS in dev, so phones can use the camera |
| `@mediapipe/tasks-vision` | Apache-2.0 | DeepLabV3 image segmentation |
| `@huggingface/transformers` | Apache-2.0 | SlimSAM leaf tracing (lazy-loaded) |

MediaPipe's WASM runtime is self-hosted under `public/mediapipe/wasm/` rather
than loaded from a CDN. Both SIMD and non-SIMD builds are present (~18 MB in the
repo); the loader downloads only the one the browser supports, about 9.4 MB.
Switch `assetUrl()` in `plantSegmenter.js` to a jsDelivr URL if you would rather
trade the repo size for a runtime CDN dependency.

Browser support: MediaPipe Tasks Vision needs WASM SIMD — iOS Safari 16.4+ and
Android Chrome 91+. On anything older the segmenter fails to load, `available`
stays false, and the app runs on the colour mask alone; the diagnosis sheet says
so.

---

## Verification

No test suite. The vision geometry was verified against synthetic masks (a
concave C-shape and a two-branch stem) for component labelling, boundary
tracing, distance transform and medial axis, and the optical flow was verified
against a known 10px/7.5px image shift — it matched to within 0.15px on textured
points and correctly rejected the untextured ones rather than reporting them as
tracked.

Beyond that, verification is: point it at a plant. Does the contour sit on the
plant, do the markers stay on their leaves as you move, does a browning leaf get
flagged.

`window.__plantApp` exposes the live app instance for inspection on device.
