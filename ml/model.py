import torch
import torch.nn as nn
from torchvision import models


def create_model(
    model_name: str = "mobilenet_v2",
    num_classes: int = 3,
    pretrained: bool = True,
    dropout_rate: float = 0.2
) -> nn.Module:
    """
    Instantiates an image classification backbone and adapts the classification head
    for the Money Plant disease classifier.
    """
    model_name = model_name.lower()

    if model_name == "mobilenet_v2":
        weights = models.MobileNet_V2_Weights.DEFAULT if pretrained else None
        model = models.mobilenet_v2(weights=weights)
        in_features = model.classifier[1].in_features
        model.classifier = nn.Sequential(
            nn.Dropout(p=dropout_rate),
            nn.Linear(in_features, num_classes)
        )
    elif model_name == "mobilenet_v3_small":
        weights = models.MobileNet_V3_Small_Weights.DEFAULT if pretrained else None
        model = models.mobilenet_v3_small(weights=weights)
        in_features = model.classifier[3].in_features
        model.classifier[3] = nn.Linear(in_features, num_classes)
    elif model_name == "resnet18":
        weights = models.ResNet18_Weights.DEFAULT if pretrained else None
        model = models.resnet18(weights=weights)
        in_features = model.fc.in_features
        model.fc = nn.Sequential(
            nn.Dropout(p=dropout_rate),
            nn.Linear(in_features, num_classes)
        )
    else:
        raise ValueError(f"Unsupported model architecture: {model_name}")

    return model


def get_model_summary(model: nn.Module) -> dict:
    """Returns parameter count and model details."""
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    return {
        "total_params": total_params,
        "trainable_params": trainable_params,
        "size_mb": round((total_params * 4) / (1024 * 1024), 2)
    }
