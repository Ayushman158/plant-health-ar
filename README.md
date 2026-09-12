# Plant Vision AR — Spatial Botanical Bio-Diagnostic Scanner

A spatial WebAR plant health & foliage telemetry scanner built with Apple VisionOS design aesthetics. Point your camera at any houseplant or garden foliage to initiate a live computer vision bio-scan, projecting floating frosted glass telemetry panels, localized leaf health pins, and false-color NDVI infrared spectral analysis.

---

## Key Features

- **Apple VisionOS Spatial Interface**:
  - Deep frosted glass panels (`backdrop-filter: blur(28px) saturate(190%)`), hairline specular rim lighting, and subtle inner reflections.
  - Gyroscope-driven 3D parallax: floating cards tilt and respond dynamically to device orientation and perspective.
- **Minimalist Visual Telemetry**:
  - Concentric circular activity rings displaying overall plant vigor and sub-layer metrics.
  - Zero audio distraction: silent, visual-first bio-diagnostic interface.
- **Pastel Semantic Health Palette**:
  - 🌿 **Optimal / Flourishing**: Soft Pastel Mint (`#86efac`) & Sage (`#a7f3d0`)
  - 🍑 **Hydration Alert / Warning**: Soft Pastel Peach / Apricot (`#fed7aa`)
  - 🌸 **Tissue Stress / Alert**: Soft Pastel Coral / Rose (`#fca5a5`)
  - 💧 **Turgor & Cellular Moisture**: Soft Pastel Ice Blue (`#bae6fd`)
  - ☀️ **Solar PAR Flux**: Soft Pastel Primrose (`#fef08a`)
- **Interactive Spatial Leaf Pins**:
  - Tap anywhere on foliage in the viewfinder to drop localized AR diagnostic pins with leader lines and leaf-specific scores.
- **NDVI False-Color Infrared Spectral Scan**:
  - Real-time canvas filter simulating Normalized Difference Vegetation Index (NDVI) to highlight active photosynthetic regions in living leaf tissue.
- **Dual Testing Support (Live Camera + Calibrated Specimen Deck)**:
  - **Live AR Lens**: Real-time rear environment camera scanning with colorimetric computer vision leaf detection.
  - **Botanical Specimen Deck**: Calibrated specimens (Monstera Deliciosa, Calathea Roseopicta, Ficus Elastica, Golden Pothos) spanning flourishing, dehydrated, and nutrient-balancing states for instant testing on both mobile and desktop.

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Local Dev Server with HTTPS
```bash
npm run dev
```

Open the printed network URL (e.g. `https://192.168.1.47:3003/`) on your mobile Safari browser on the same local Wi-Fi network. Allow camera access and point your phone at any houseplant!

### 3. Build for Production
```bash
npm run build
```
The optimized bundle will be compiled to `dist/`.

---

## License
MIT
