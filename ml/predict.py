import os
import json
import argparse
from PIL import Image
import torch
import torch.nn.functional as F
from torchvision import transforms

from model import create_model
from dataset import NORMALIZE_MEAN, NORMALIZE_STD


def load_image(image_path: str, image_size: int = 224) -> torch.Tensor:
    transform = transforms.Compose([
        transforms.Resize((256, 256)),
        transforms.CenterCrop(image_size),
        transforms.ToTensor(),
        transforms.Normalize(mean=NORMALIZE_MEAN, std=NORMALIZE_STD)
    ])
    with Image.open(image_path) as img:
        rgb_img = img.convert("RGB")
        tensor = transform(rgb_img).unsqueeze(0)
    return tensor


def predict_pytorch(model: torch.nn.Module, image_tensor: torch.Tensor, device: torch.device):
    model.eval()
    with torch.no_grad():
        logits = model(image_tensor.to(device))
        probs = F.softmax(logits, dim=1).cpu().numpy()[0]
    return probs


def predict_onnx(onnx_path: str, image_tensor: torch.Tensor):
    import onnxruntime as ort
    session = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
    inp_name = session.get_inputs()[0].name
    inp_val = image_tensor.numpy().astype("float32")
    outputs = session.run(None, {inp_name: inp_val})
    logits = outputs[0][0]
    # Softmax
    exp_logits = torch.exp(torch.tensor(logits))
    probs = (exp_logits / exp_logits.sum()).numpy()
    return probs


def main():
    parser = argparse.ArgumentParser(description="Predict Money Plant Leaf Disease")
    parser.add_argument("--image", type=str, required=True, help="Path to input leaf image")
    parser.add_argument("--model-path", type=str, default="ml/checkpoints/best_money_plant_mobilenet.pth")
    parser.add_argument("--onnx", action="store_true", help="Use ONNX runtime instead of PyTorch")
    parser.add_argument("--labels", type=str, default="ml/checkpoints/class_labels.json")
    args = parser.parse_args()

    if not os.path.isfile(args.image):
        print(f"Error: Image file not found: {args.image}")
        return

    # Load labels
    diagnostic_info = {}
    if os.path.isfile(args.labels):
        with open(args.labels, "r") as f:
            label_data = json.load(f)
            class_names = label_data.get("classes", ["Bacterial wilt disease", "Healthy", "Manganese Toxicity"])
            diagnostic_info = label_data.get("diagnostics", {})
    else:
        class_names = ["Bacterial wilt disease", "Healthy", "Manganese Toxicity"]

    image_tensor = load_image(args.image)

    if args.onnx or args.model_path.endswith(".onnx"):
        print(f"Running inference using ONNX Runtime ({args.model_path})...")
        probs = predict_onnx(args.model_path, image_tensor)
    else:
        print(f"Running inference using PyTorch ({args.model_path})...")
        device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
        checkpoint = torch.load(args.model_path, map_location="cpu")
        model = create_model(model_name=checkpoint.get("model_name", "mobilenet_v2"), num_classes=len(class_names), pretrained=False)
        model.load_state_dict(checkpoint["model_state_dict"])
        model.to(device)
        probs = predict_pytorch(model, image_tensor, device)

    top_idx = int(probs.argmax())
    top_class = class_names[top_idx]
    top_conf = probs[top_idx] * 100.0

    print("\n" + "=" * 60)
    print(f"🌿 BIO-DIAGNOSTIC LEAF SCAN RESULT")
    print("=" * 60)
    print(f"Image:          {os.path.basename(args.image)}")
    print(f"Classification: {top_class.upper()}")
    print(f"Confidence:     {top_conf:.2f}%\n")

    print("Class Probability Breakdown:")
    for idx, name in enumerate(class_names):
        bar_len = int(probs[idx] * 30)
        bar = "█" * bar_len + "░" * (30 - bar_len)
        print(f"  {name:<24} [{bar}] {probs[idx] * 100:>5.1f}%")

    if top_class in diagnostic_info:
        info = diagnostic_info[top_class]
        print("\nClinical Details:")
        print(f"  • Severity:     {info.get('severity')}")
        print(f"  • Pathogen:     {info.get('pathogen')}")
        print(f"  • Symptoms:     {info.get('symptoms')}")
        print(f"  • Treatment:    {info.get('care_actions')}")
    print("=" * 60)


if __name__ == "__main__":
    main()
