import os
import sys
import time
import json
import argparse
from typing import Dict, Any

import torch
import torch.nn as nn
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR

from dataset import get_dataloaders
from model import create_model, get_model_summary


def select_device(user_device: str = "auto") -> torch.device:
    """Selects best available compute hardware."""
    if user_device != "auto":
        return torch.device(user_device)
    if torch.backends.mps.is_available() and torch.backends.mps.is_built():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


def train_one_epoch(
    model: nn.Module,
    loader,
    criterion: nn.Module,
    optimizer: torch.optim.Optimizer,
    device: torch.device
) -> Dict[str, float]:
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    start_time = time.time()
    for batch_idx, (images, targets) in enumerate(loader):
        images = images.to(device)
        targets = targets.to(device)

        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, targets)
        loss.backward()
        optimizer.step()

        running_loss += loss.item() * images.size(0)
        _, preds = torch.max(outputs, 1)
        correct += (preds == targets).sum().item()
        total += targets.size(0)

        if (batch_idx + 1) % 50 == 0 or (batch_idx + 1) == len(loader):
            current_loss = running_loss / total
            current_acc = (correct / total) * 100.0
            print(f"  [Train] Step {batch_idx + 1}/{len(loader)} - Loss: {current_loss:.4f} - Acc: {current_acc:.2f}%")

    elapsed = time.time() - start_time
    epoch_loss = running_loss / total
    epoch_acc = (correct / total) * 100.0

    return {"loss": epoch_loss, "accuracy": epoch_acc, "time_sec": elapsed}


def evaluate(
    model: nn.Module,
    loader,
    criterion: nn.Module,
    device: torch.device
) -> Dict[str, float]:
    model.eval()
    running_loss = 0.0
    correct = 0
    total = 0

    start_time = time.time()
    with torch.no_grad():
        for images, targets in loader:
            images = images.to(device)
            targets = targets.to(device)

            outputs = model(images)
            loss = criterion(outputs, targets)

            running_loss += loss.item() * images.size(0)
            _, preds = torch.max(outputs, 1)
            correct += (preds == targets).sum().item()
            total += targets.size(0)

    elapsed = time.time() - start_time
    val_loss = running_loss / total
    val_acc = (correct / total) * 100.0

    return {"loss": val_loss, "accuracy": val_acc, "time_sec": elapsed}


def export_onnx(
    model: nn.Module,
    output_path: str,
    image_size: int = 224,
    device: torch.device = torch.device("cpu")
):
    """Exports model to ONNX with dynamic batching and validates via onnxruntime."""
    print(f"\nExporting model to ONNX: {output_path}...")
    model.eval()
    dummy_input = torch.randn(1, 3, image_size, image_size, device=device)

    # Ensure model is on CPU for clean ONNX export
    model_cpu = model.to(torch.device("cpu"))
    dummy_input_cpu = dummy_input.to(torch.device("cpu"))

    torch.onnx.export(
        model_cpu,
        dummy_input_cpu,
        output_path,
        export_params=True,
        opset_version=14,
        do_constant_folding=True,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {0: "batch_size"}, "output": {0: "batch_size"}}
    )

    # Validate with onnx and onnxruntime
    try:
        import onnx
        import onnxruntime as ort
        import numpy as np

        onnx_model = onnx.load(output_path)
        onnx.checker.check_model(onnx_model)

        session = ort.InferenceSession(output_path, providers=["CPUExecutionProvider"])
        test_inp = np.random.randn(1, 3, image_size, image_size).astype(np.float32)
        ort_outs = session.run(None, {"input": test_inp})
        print(f"ONNX export successful and verified! Output shape: {ort_outs[0].shape}")
    except Exception as e:
        print(f"Notice during ONNX verification: {e}")


def export_torchscript(model: nn.Module, output_path: str, image_size: int = 224):
    """Exports model to TorchScript (.pt) format."""
    print(f"Exporting model to TorchScript: {output_path}...")
    model_cpu = model.to(torch.device("cpu"))
    model_cpu.eval()
    dummy_input = torch.randn(1, 3, image_size, image_size)
    traced_model = torch.jit.trace(model_cpu, dummy_input)
    traced_model.save(output_path)
    print("TorchScript export completed successfully.")


def main():
    parser = argparse.ArgumentParser(description="Train Money Plant Disease Classification Model")
    parser.add_argument("--epochs", type=int, default=5, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size for training")
    parser.add_argument("--lr", type=float, default=1e-3, help="Peak learning rate for AdamW")
    parser.add_argument("--weight-decay", type=float, default=1e-4, help="Weight decay for regularization")
    parser.add_argument("--model-name", type=str, default="mobilenet_v2", help="Backbone model name")
    parser.add_argument("--data-dir", type=str, default=None, help="Path to Money Plant dataset directory")
    parser.add_argument("--output-dir", type=str, default="ml/checkpoints", help="Output directory for checkpoints and models")
    parser.add_argument("--device", type=str, default="auto", help="Compute device (auto, mps, cuda, cpu)")
    parser.add_argument("--image-size", type=int, default=224, help="Input resolution (224x224)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    parser.add_argument("--num-workers", type=int, default=2, help="DataLoader worker count")
    parser.add_argument("--export-onnx", action="store_true", default=True, help="Export model to ONNX format")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)
    device = select_device(args.device)
    print("=" * 65)
    print(" Money Plant (*Epipremnum aureum*) Disease Classifier Training")
    print("=" * 65)
    print(f"Using Compute Device: {device} ({'Apple Silicon GPU (MPS)' if device.type == 'mps' else device.type})")
    print(f"Architecture:         {args.model_name}")
    print(f"Epochs:               {args.epochs}")
    print(f"Batch Size:           {args.batch_size}")
    print(f"Learning Rate:        {args.lr}")
    print(f"Checkpoints Dir:      {args.output_dir}")
    print("-" * 65)

    print("\nLoading dataset and creating stratified splits...")
    train_loader, val_loader, test_loader, meta = get_dataloaders(
        data_dir=args.data_dir,
        batch_size=args.batch_size,
        num_workers=args.num_workers,
        seed=args.seed,
        image_size=args.image_size
    )

    print(f"Total Dataset Images: {meta['total_count']:,}")
    print(f"  - Train Set:        {meta['train_count']:,} images (70%)")
    print(f"  - Validation Set:   {meta['val_count']:,} images (15%)")
    print(f"  - Test Set:         {meta['test_count']:,} images (15%)")
    print(f"Target Classes ({meta['num_classes']}):")
    for idx, name in meta['idx_to_class'].items():
        print(f"    [{idx}] {name}")

    # Build model
    model = create_model(
        model_name=args.model_name,
        num_classes=meta["num_classes"],
        pretrained=True
    )
    model.to(device)

    summary = get_model_summary(model)
    print(f"\nModel Parameters: {summary['total_params']:,} ({summary['size_mb']} MB)")

    criterion = nn.CrossEntropyLoss()
    optimizer = AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)
    scheduler = CosineAnnealingLR(optimizer, T_max=args.epochs, eta_min=1e-5)

    best_val_loss = float("inf")
    best_val_acc = 0.0
    history = {"train_loss": [], "train_acc": [], "val_loss": [], "val_acc": []}

    best_ckpt_path = os.path.join(args.output_dir, "best_money_plant_mobilenet.pth")

    print("\nStarting Training Loop...")
    total_start = time.time()

    for epoch in range(1, args.epochs + 1):
        print(f"\n--- Epoch {epoch}/{args.epochs} (LR: {scheduler.get_last_lr()[0]:.6f}) ---")
        train_res = train_one_epoch(model, train_loader, criterion, optimizer, device)
        val_res = evaluate(model, val_loader, criterion, device)
        scheduler.step()

        history["train_loss"].append(train_res["loss"])
        history["train_acc"].append(train_res["accuracy"])
        history["val_loss"].append(val_res["loss"])
        history["val_acc"].append(val_res["accuracy"])

        print(
            f"Epoch {epoch} Summary: "
            f"Train Loss={train_res['loss']:.4f}, Train Acc={train_res['accuracy']:.2f}% | "
            f"Val Loss={val_res['loss']:.4f}, Val Acc={val_res['accuracy']:.2f}% | "
            f"Train Time={train_res['time_sec']:.1f}s"
        )

        # Save checkpoint if validation improves
        if val_res["loss"] < best_val_loss:
            best_val_loss = val_res["loss"]
            best_val_acc = val_res["accuracy"]
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_loss": best_val_loss,
                "val_acc": best_val_acc,
                "class_to_idx": meta["class_to_idx"],
                "idx_to_class": meta["idx_to_class"],
                "model_name": args.model_name
            }, best_ckpt_path)
            print(f"  ★ New best model saved! (Val Acc: {best_val_acc:.2f}%, Val Loss: {best_val_loss:.4f})")

    total_time = time.time() - total_start
    print("\n" + "=" * 65)
    print(f"Training Complete in {total_time / 60:.2f} minutes!")
    print(f"Best Validation Accuracy: {best_val_acc:.2f}% (Loss: {best_val_loss:.4f})")
    print("=" * 65)

    # Save class metadata with plant pathology details
    labels_path = os.path.join(args.output_dir, "class_labels.json")
    diagnostic_details = {
        "Bacterial wilt disease": {
            "disease_id": "bacterial_wilt",
            "common_name": "Bacterial Wilt",
            "pathogen": "Ralstonia solanacearum / Erwinia spp.",
            "severity": "High Alert",
            "status": "alert",
            "symptoms": "Rapid vascular wilting, yellowing leaf blades, limp petiole collapse without preliminary drying.",
            "care_actions": "Quarantine specimen immediately. Discard severely affected foliage. Sterilize pruning tools. Avoid overhead watering."
        },
        "Healthy": {
            "disease_id": "healthy",
            "common_name": "Healthy & Optimal",
            "pathogen": "None",
            "severity": "Optimal",
            "status": "optimal",
            "symptoms": "Turgid glossy leaf tissue, vibrant chlorophyll pigmentation, active photosynthesis.",
            "care_actions": "Maintain moderate indirect sunlight and weekly watering when topsoil dries."
        },
        "Manganese Toxicity": {
            "disease_id": "manganese_toxicity",
            "common_name": "Manganese Toxicity",
            "pathogen": "Abiotic Physiological Nutrient Stress",
            "severity": "Tissue Warning",
            "status": "warning",
            "symptoms": "Interveinal dark-brown necrotic specks, chlorotic halo margins, leaf tip cupping caused by acidic soil (pH < 5.2).",
            "care_actions": "Flush potting mix with filtered neutral water. Check soil pH and apply horticultural lime to raise pH to 6.0-6.5."
        }
    }

    labels_data = {
        "model_name": args.model_name,
        "classes": [meta["idx_to_class"][i] for i in range(len(meta["idx_to_class"]))],
        "idx_to_class": meta["idx_to_class"],
        "class_to_idx": meta["class_to_idx"],
        "diagnostics": diagnostic_details
    }
    with open(labels_path, "w") as f:
        json.dump(labels_data, f, indent=2)
    print(f"Saved class diagnostic mapping: {labels_path}")

    # Save training history
    history_path = os.path.join(args.output_dir, "training_metrics.json")
    with open(history_path, "w") as f:
        json.dump({
            "history": history,
            "best_val_accuracy": best_val_acc,
            "best_val_loss": best_val_loss,
            "epochs": args.epochs,
            "total_time_seconds": total_time
        }, f, indent=2)
    print(f"Saved training history: {history_path}")

    # Load best checkpoint for export
    print(f"\nReloading best checkpoint from: {best_ckpt_path}...")
    checkpoint = torch.load(best_ckpt_path, map_location="cpu")
    best_model = create_model(model_name=args.model_name, num_classes=meta["num_classes"], pretrained=False)
    best_model.load_state_dict(checkpoint["model_state_dict"])

    # Export TorchScript
    ts_path = os.path.join(args.output_dir, "money_plant_mobilenet.pt")
    export_torchscript(best_model, ts_path, image_size=args.image_size)

    # Export ONNX
    if args.export_onnx:
        onnx_path = os.path.join(args.output_dir, "money_plant_mobilenet.onnx")
        export_onnx(best_model, onnx_path, image_size=args.image_size)

    print("\nAll model artifacts exported successfully to:", args.output_dir)


if __name__ == "__main__":
    main()
