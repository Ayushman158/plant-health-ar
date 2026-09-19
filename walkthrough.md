# Walkthrough — Money Plant Disease Classifier Training & Integration

We trained, evaluated, exported, and integrated an image classification neural network for Money Plant (*Epipremnum aureum*) disease pathology using the Kaggle **[DiseaseClassifier: Money Plant Dataset](https://www.kaggle.com/datasets/mdhasanahmad/diseaseclassifier-money-plant-dataset)** (by MD Hasan Ahmad).

---

## 1. Dataset Overview & Stratification

The dataset contains **15,000 images** (256×256 resolution) divided equally into 3 diagnostic categories:

| Diagnostic Class | Category | Total Images | Train (70%) | Validation (15%) | Test (15%) |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Bacterial wilt disease** | Pathogenic Infection (*Ralstonia solanacearum*) | 5,000 | 3,500 | 750 | 750 |
| **Healthy** | Optimal Vigor & Normal Physiology | 5,000 | 3,500 | 750 | 750 |
| **Manganese Toxicity** | Abiotic Mineral Excess (Soil pH < 5.2) | 5,000 | 3,500 | 750 | 750 |
| **TOTAL** | | **15,000** | **10,500** | **2,250** | **2,250** |

---

## 2. Model Architecture & Training Details

- **Backbone**: MobileNetV2 pretrained on ImageNet.
- **Classification Head**: `Dropout(p=0.2)` + `Linear(1280, 3)`.
- **Compute Device**: Apple Silicon GPU via Metal Performance Shaders (`mps`).
- **Optimizer**: AdamW (`lr=1e-3`, `weight_decay=1e-4`).
- **Scheduler**: `CosineAnnealingLR` over 5 epochs.
- **Data Augmentations**: RandomResizedCrop(224), RandomHorizontalFlip, RandomVerticalFlip, ColorJitter, RandomRotation(15°), ImageNet normalization.

### Training Progress Across Epochs

| Epoch | Learning Rate | Train Loss | Train Accuracy | Validation Loss | Validation Accuracy | Status |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1** | `0.001000` | 0.0670 | 98.00% | 0.0148 | 99.60% | ★ Best Model Saved |
| **2** | `0.000905` | 0.0257 | 99.30% | 0.0148 | 99.29% | Checkpoint |
| **3** | `0.000658` | 0.0083 | 99.76% | 0.0017 | 99.96% | ★ Best Model Saved |
| **4** | `0.000352` | 0.0059 | 99.90% | 0.0003 | **100.00%** | ★ Best Model Saved |
| **5** | `0.000105` | 0.0035 | 99.90% | 0.0003 | **100.00%** | ★ Final Converged |

Total training runtime on Apple Silicon MPS: **~17 minutes**.

---

## 3. Test Set Evaluation (2,250 Held-Out Samples)

Evaluated the best checkpoint (`best_money_plant_mobilenet.pth`) against the untouched **2,250 test set images**:

```
=================================================================
 MONEY PLANT DISEASE CLASSIFIER — TEST EVALUATION REPORT
=================================================================
Total Test Set Samples: 2,250
Overall Test Accuracy:  100.00%

Class Name                 Precision  Recall     F1-Score   Support 
-----------------------------------------------------------------
Bacterial wilt disease     100.00%   100.00%   100.00%      750
Healthy                    100.00%   100.00%   100.00%      750
Manganese Toxicity         100.00%   100.00%   100.00%      750
-----------------------------------------------------------------

Confusion Matrix (Rows = Actual, Columns = Predicted):
Actual \ Pred         [0]  [1]  [2]
[0] Bacterial wilt d 750    0    0
[1] Healthy            0  750    0
[2] Manganese Toxici   0    0  750
```

---

## 4. Single-Image Inference Verification

Verified the model on representative test specimen images using both PyTorch and ONNX Runtime:

### 1. Healthy Leaf (`money_plant_healthy.jpg`)
```bash
python3 ml/predict.py --image "public/assets/specimens/money_plant_healthy.jpg"
```
```
Classification: HEALTHY (100.00% Confidence)
Breakdown:
  Bacterial wilt disease   [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]   0.0%
  Healthy                  [█████████████████████████████░] 100.0%
  Manganese Toxicity       [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]   0.0%
Clinical: Turgid glossy leaf tissue, vibrant chlorophyll, active photosynthesis.
```

### 2. Bacterial Wilt Disease (`money_plant_wilt.jpg`)
```bash
python3 ml/predict.py --image "public/assets/specimens/money_plant_wilt.jpg"
```
```
Classification: BACTERIAL WILT DISEASE (100.00% Confidence)
Breakdown:
  Bacterial wilt disease   [█████████████████████████████░] 100.0%
  Healthy                  [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]   0.0%
  Manganese Toxicity       [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]   0.0%
Clinical: Ralstonia solanacearum / Erwinia spp. — Vascular occlusion, limp petiole collapse.
```

### 3. Manganese Toxicity (`money_plant_manganese.jpg`) via ONNX Runtime
```bash
python3 ml/predict.py --image "public/assets/specimens/money_plant_manganese.jpg" --onnx
```
```
Classification: MANGANESE TOXICITY (100.00% Confidence)
Breakdown:
  Bacterial wilt disease   [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]   0.0%
  Healthy                  [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]   0.0%
  Manganese Toxicity       [██████████████████████████████] 100.0%
Clinical: Interveinal dark-brown necrotic specks, chlorotic halo margins, acidic soil stress.
```

---

## 5. Exported Model Artifacts

All models are saved and ready for deployment:

| File | Format | Size | Purpose |
| :--- | :--- | :---: | :--- |
| [`best_money_plant_mobilenet.pth`](file:///Users/ayushmanbharadwaj/plant-vision-ar/ml/checkpoints/best_money_plant_mobilenet.pth) | PyTorch State Dict | 26 MB | Checkpoint with optimizer state & epoch info |
| [`money_plant_mobilenet.onnx`](file:///Users/ayushmanbharadwaj/plant-vision-ar/public/models/money_plant_mobilenet.onnx) | ONNX (opset 14) | 8.5 MB | High-performance inference (browser / cross-platform) |
| [`money_plant_mobilenet.pt`](file:///Users/ayushmanbharadwaj/plant-vision-ar/ml/checkpoints/money_plant_mobilenet.pt) | TorchScript JIT | 9.0 MB | C++ / PyTorch mobile deployment |
| [`class_labels.json`](file:///Users/ayushmanbharadwaj/plant-vision-ar/public/models/class_labels.json) | JSON Metadata | 1.7 KB | Class mappings, clinical descriptions, symptoms, and care tips |
| [`training_metrics.json`](file:///Users/ayushmanbharadwaj/plant-vision-ar/ml/checkpoints/training_metrics.json) | JSON Log | 730 B | Epoch loss and accuracy progression curves |

---

## 6. Web Application Integration

1. **Specimen Profiles**:
   - Added `money_plant_wilt` (Bacterial Wilt Alert, coral theme `#fca5a5`, vascular collapse pins).
   - Added `money_plant_manganese` (Manganese Toxicity Warning, apricot theme `#fed7aa`, necrotic lesion pins).
   - Retained `money_plant` (Healthy / Optimal, mint theme `#86efac`).
2. **Public Assets**:
   - Extracted calibrated test leaves from the dataset into `public/assets/specimens/`.
   - Copied ONNX model and diagnostic labels into `public/models/`.
3. **Build Verification**:
   - `npm run build` verified cleanly (0 errors).
