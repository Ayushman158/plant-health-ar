import os
import json
import argparse
from typing import Dict, List

import torch
import torch.nn as nn
import numpy as np

from dataset import get_dataloaders
from model import create_model


def compute_metrics(confusion_matrix: np.ndarray, class_names: List[str]) -> Dict[str, Dict[str, float]]:
    """Calculates precision, recall, and F1-score from confusion matrix."""
    metrics = {}
    total_samples = np.sum(confusion_matrix)
    overall_acc = np.trace(confusion_matrix) / total_samples

    for idx, name in enumerate(class_names):
        tp = confusion_matrix[idx, idx]
        fp = np.sum(confusion_matrix[:, idx]) - tp
        fn = np.sum(confusion_matrix[idx, :]) - tp
        support = np.sum(confusion_matrix[idx, :])

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

        metrics[name] = {
            "precision": round(float(precision), 4),
            "recall": round(float(recall), 4),
            "f1_score": round(float(f1), 4),
            "support": int(support)
        }

    return {"overall_accuracy": round(float(overall_acc), 4), "per_class": metrics}


def main():
    parser = argparse.ArgumentParser(description="Evaluate Money Plant Disease Classifier on Test Set")
    parser.add_argument("--checkpoint", type=str, default="ml/checkpoints/best_money_plant_mobilenet.pth")
    parser.add_argument("--data-dir", type=str, default=None)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--device", type=str, default="auto")
    args = parser.parse_args()

    if not os.path.isfile(args.checkpoint):
        print(f"Error: Checkpoint file not found at: {args.checkpoint}")
        return

    # Select device
    if args.device == "auto":
        device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    else:
        device = torch.device(args.device)

    print(f"Loading checkpoint: {args.checkpoint}")
    checkpoint = torch.load(args.checkpoint, map_location="cpu")
    idx_to_class = checkpoint.get("idx_to_class", {0: "Bacterial wilt disease", 1: "Healthy", 2: "Manganese Toxicity"})
    idx_to_class = {int(k): v for k, v in idx_to_class.items()}
    class_names = [idx_to_class[i] for i in range(len(idx_to_class))]
    num_classes = len(class_names)

    model_name = checkpoint.get("model_name", "mobilenet_v2")
    model = create_model(model_name=model_name, num_classes=num_classes, pretrained=False)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.to(device)
    model.eval()

    # Load test set
    _, _, test_loader, meta = get_dataloaders(
        data_dir=args.data_dir,
        batch_size=args.batch_size
    )

    print(f"Evaluating model on {meta['test_count']:,} test images...")
    confusion_matrix = np.zeros((num_classes, num_classes), dtype=np.int64)

    with torch.no_grad():
        for images, targets in test_loader:
            images = images.to(device)
            targets = targets.to(device)
            outputs = model(images)
            _, preds = torch.max(outputs, 1)

            for t, p in zip(targets.cpu().numpy(), preds.cpu().numpy()):
                confusion_matrix[t, p] += 1

    report = compute_metrics(confusion_matrix, class_names)

    print("\n" + "=" * 65)
    print(" MONEY PLANT DISEASE CLASSIFIER — TEST EVALUATION REPORT")
    print("=" * 65)
    print(f"Total Test Set Samples: {meta['test_count']:,}")
    print(f"Overall Test Accuracy:  {report['overall_accuracy'] * 100:.2f}%\n")

    print(f"{'Class Name':<26} {'Precision':<10} {'Recall':<10} {'F1-Score':<10} {'Support':<8}")
    print("-" * 65)
    for name in class_names:
        m = report["per_class"][name]
        print(f"{name:<26} {m['precision'] * 100:>6.2f}%   {m['recall'] * 100:>6.2f}%   {m['f1_score'] * 100:>6.2f}%   {m['support']:>6}")
    print("-" * 65)

    print("\nConfusion Matrix (Rows = Actual, Columns = Predicted):")
    header = "Actual \\ Pred".ljust(22) + "  ".join([f"[{i}]" for i in range(num_classes)])
    print(header)
    for i, row in enumerate(confusion_matrix):
        row_str = f"[{i}] {class_names[i][:16]:<16} " + "  ".join([f"{val:>3}" for val in row])
        print(row_str)

    report_path = os.path.join(os.path.dirname(args.checkpoint), "test_evaluation_report.json")
    with open(report_path, "w") as f:
        json.dump({
            "overall_accuracy": report["overall_accuracy"],
            "per_class": report["per_class"],
            "confusion_matrix": confusion_matrix.tolist(),
            "class_names": class_names
        }, f, indent=2)
    print(f"\nSaved detailed evaluation report to: {report_path}")


if __name__ == "__main__":
    main()
