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

## Neural Disease Classifier (Money Plant Pathology)

The system includes a deep learning bio-diagnostic engine trained on the **[DiseaseClassifier: Money Plant Dataset](https://www.kaggle.com/datasets/mdhasanahmad/diseaseclassifier-money-plant-dataset)** (MD Hasan Ahmad, 15,000 images, 3 diagnostic classes):
1. **Healthy**: Optimal cellular turgor, vigorous chlorophyll synthesis.
2. **Bacterial Wilt Disease** (*Ralstonia solanacearum*): Vascular occlusion, rapid blade collapse.
3. **Manganese Toxicity**: Abiotic mineral disorder causing interveinal necrotic spots and chlorotic margins.

### Model Architecture & Performance
- **Backbone**: MobileNetV2 with transfer learning (ImageNet initialization).
- **Classification Head**: `Dropout(p=0.2)` + `Linear(1280, 3)`.
- **Hardware Acceleration**: Apple Silicon Metal Performance Shaders (`mps`) / CUDA / CPU.
- **Validation Accuracy**: >99%
- **Exports**: PyTorch checkpoint (`.pth`), TorchScript (`.pt`), and ONNX (`.onnx`).

### Running Model Training
```bash
# Install Python ML dependencies
pip3 install -r ml/requirements.txt

# Train the model (automatically uses Apple Silicon MPS GPU)
python3 ml/train.py --epochs 5 --batch-size 32
```

### Running Test Evaluation
```bash
python3 ml/evaluate.py
```
Computes overall test accuracy, per-class precision/recall/F1-score, and a confusion matrix.

### Running Single-Image Inference
```bash
# Run prediction with PyTorch
python3 ml/predict.py --image "public/assets/specimens/money_plant_wilt.jpg"

# Run prediction with ONNX Runtime
python3 ml/predict.py --image "public/assets/specimens/money_plant_manganese.jpg" --onnx
```

---

## License
MIT
