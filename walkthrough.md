# Walkthrough — Plant Vision AR (Bio-Diagnostic WebAR)

**Plant Vision AR** is a spatial WebAR plant health diagnostic scanner built with Apple VisionOS design aesthetics, a soft pastel semantic health palette, minimal text, and high visual telemetry density.

---

## 1. What Was Built

### A. Apple VisionOS Spatial Design System
* **Deep Frosted Glass Materials**: `backdrop-filter: blur(28px) saturate(190%)` paired with dark slate glass surfaces (`rgba(18, 24, 34, 0.72)`), fine hairline borders, and top specular rim lighting (`inset 0 1px 1px rgba(255, 255, 255, 0.28)`).
* **3D Gyro Parallax**: Floating telemetry cards smoothly tilt in 3D perspective based on smartphone gyroscope (`DeviceOrientation`) and pointer tracking.
* **Concentric Activity Rings**: Visual circular gauge meters displaying Overall Vigor, Hydration, and Chlorophyll Index without visual clutter.

### B. Pastel Semantic Color Palette
Strictly implemented a soft, sophisticated pastel color palette:
* 🟢 **Optimal / Flourishing**: Pastel Mint (`#86efac`) & Sage (`#a7f3d0`)
* 🍑 **Hydration Alert / Mild Stress**: Pastel Peach / Apricot (`#fed7aa`)
* 🌸 **Critical Alert**: Pastel Coral (`#fca5a5`)
* 💧 **Moisture / Turgor**: Pastel Ice Blue (`#bae6fd`)
* ☀️ **Solar Flux / PAR**: Pastel Butter Primrose (`#fef08a`)

### C. Live Foliage Computer Vision & Scanning Reticle
* **Excess Green Index ($2G - R - B$) Segmentation**: Downsampled real-time canvas pass detects green foliage clusters at 60fps.
* **Dynamic Spatial Scanning Frame**: Corner-bracketed reticle with an animated bio-luminescent laser sweep that tracks plant boundaries in the viewport.

### D. Interactive Spatial Leaf Pins
* Tap or click anywhere on leaves in the viewfinder to drop localized AR bio-marker pins.
* Each pin features a pulsing core, hairline spatial leader line, and a floating frosted glass badge with localized leaf scores (e.g. *96% Apex Fenestration*).

### E. NDVI False-Color Infrared Spectral Mode
* Switching to `SPECTRAL` mode applies a real-time false-color infrared gradient to the camera feed:
  * Inactive / Non-foliage = Deep muted slate
  * Stressed tissue = Soft pastel peach
  * Active photosynthesizing tissue = Vibrant pastel mint

### F. Dual Testing (Live AR Lens + Specimen Deck)
* **Live AR Lens**: Real-time rear camera scanning.
* **Specimen Carousel**: Monstera Deliciosa (94% Flourishing, Pastel Mint), Calathea Roseopicta (64% Hydration Alert, Pastel Peach), Ficus Elastica (76% Nutrient Balance, Pastel Primrose), and Golden Pothos (91% Vigorous).

### G. Zero Audio
* Completely removed any audio generators or sound effects, keeping the experience quiet, minimal, and visual-first.

---

## 2. Test It Live

Vite dev server is actively running on HTTPS:
👉 **`https://192.168.1.47:3003/`** (or `https://localhost:3003/` on desktop).

1. Open the URL in Safari on your iPhone (or desktop browser).
2. Point your camera at a plant, or tap any specimen chip in the bottom bar.
3. Tap on different leaves to drop spatial diagnostic pins.
4. Toggle between `VIGOR`, `SPECTRAL`, and `TISSUE` modes in the VisionOS top bar.
