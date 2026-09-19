import os
import random
from typing import Dict, List, Tuple
from PIL import Image
import torch
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms

DEFAULT_KAGGLE_PATH = os.path.expanduser(
    "~/.cache/kagglehub/datasets/mdhasanahmad/diseaseclassifier-money-plant-dataset/versions/1/Main Dataset"
)

# Standard ImageNet normalization parameters
NORMALIZE_MEAN = [0.485, 0.456, 0.406]
NORMALIZE_STD = [0.229, 0.224, 0.225]


def get_transforms(image_size: int = 224):
    """Returns training and validation/test torchvision transformation pipelines."""
    train_transform = transforms.Compose([
        transforms.Resize((256, 256)),
        transforms.RandomResizedCrop(image_size, scale=(0.8, 1.0)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomVerticalFlip(p=0.3),
        transforms.RandomRotation(degrees=15),
        transforms.ColorJitter(brightness=0.1, contrast=0.1, saturation=0.1),
        transforms.ToTensor(),
        transforms.Normalize(mean=NORMALIZE_MEAN, std=NORMALIZE_STD)
    ])

    eval_transform = transforms.Compose([
        transforms.Resize((256, 256)),
        transforms.CenterCrop(image_size),
        transforms.ToTensor(),
        transforms.Normalize(mean=NORMALIZE_MEAN, std=NORMALIZE_STD)
    ])

    return train_transform, eval_transform


class MoneyPlantDataset(Dataset):
    """PyTorch Dataset for Money Plant disease leaf images."""

    def __init__(self, samples: List[Tuple[str, int]], transform=None):
        self.samples = samples
        self.transform = transform

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int]:
        img_path, label = self.samples[idx]
        with Image.open(img_path) as img:
            image = img.convert("RGB")
        if self.transform:
            image = self.transform(image)
        return image, label


def resolve_dataset_dir(data_dir: str = None) -> str:
    """Finds the dataset directory either from user arg, default cache, or via kagglehub."""
    if data_dir and os.path.isdir(data_dir):
        return data_dir

    if os.path.isdir(DEFAULT_KAGGLE_PATH):
        return DEFAULT_KAGGLE_PATH

    print("Dataset not found in cache. Attempting to download via kagglehub...")
    import kagglehub
    downloaded = kagglehub.dataset_download("mdhasanahmad/diseaseclassifier-money-plant-dataset")
    candidate = os.path.join(downloaded, "Main Dataset")
    if os.path.isdir(candidate):
        return candidate
    return downloaded


def load_dataset_samples(data_dir: str) -> Tuple[List[Tuple[str, int]], Dict[int, str], Dict[str, int]]:
    """
    Scans the dataset directory and returns:
    - samples: list of (file_path, class_idx)
    - idx_to_class: {0: 'Bacterial wilt disease', 1: 'Healthy', 2: 'Manganese Toxicity'}
    - class_to_idx: inverse of idx_to_class
    """
    subdirs = sorted([d for d in os.listdir(data_dir) if os.path.isdir(os.path.join(data_dir, d)) and not d.startswith('.')])
    if not subdirs:
        raise ValueError(f"No class subdirectories found in: {data_dir}")

    class_to_idx = {name: idx for idx, name in enumerate(subdirs)}
    idx_to_class = {idx: name for idx, name in enumerate(subdirs)}

    samples = []
    valid_exts = {".jpg", ".jpeg", ".png", ".webp"}

    for class_name in subdirs:
        class_dir = os.path.join(data_dir, class_name)
        class_idx = class_to_idx[class_name]
        for fname in os.listdir(class_dir):
            if fname.startswith("."):
                continue
            ext = os.path.splitext(fname)[1].lower()
            if ext in valid_exts:
                samples.append((os.path.join(class_dir, fname), class_idx))

    return samples, idx_to_class, class_to_idx


def create_stratified_splits(
    samples: List[Tuple[str, int]],
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    seed: int = 42
) -> Tuple[List[Tuple[str, int]], List[Tuple[str, int]], List[Tuple[str, int]]]:
    """Deterministically splits samples per class into train, val, and test subsets."""
    random.seed(seed)

    by_class: Dict[int, List[Tuple[str, int]]] = {}
    for sample in samples:
        cls_idx = sample[1]
        by_class.setdefault(cls_idx, []).append(sample)

    train_samples = []
    val_samples = []
    test_samples = []

    for cls_idx, class_list in by_class.items():
        random.shuffle(class_list)
        n = len(class_list)
        n_train = int(n * train_ratio)
        n_val = int(n * val_ratio)

        train_samples.extend(class_list[:n_train])
        val_samples.extend(class_list[n_train:n_train + n_val])
        test_samples.extend(class_list[n_train + n_val:])

    random.shuffle(train_samples)
    random.shuffle(val_samples)
    random.shuffle(test_samples)

    return train_samples, val_samples, test_samples


def get_dataloaders(
    data_dir: str = None,
    batch_size: int = 32,
    num_workers: int = 2,
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    seed: int = 42,
    image_size: int = 224
):
    """Creates PyTorch DataLoaders for train, validation, and test splits."""
    root_dir = resolve_dataset_dir(data_dir)
    samples, idx_to_class, class_to_idx = load_dataset_samples(root_dir)

    train_samples, val_samples, test_samples = create_stratified_splits(
        samples, train_ratio=train_ratio, val_ratio=val_ratio, seed=seed
    )

    train_tf, eval_tf = get_transforms(image_size=image_size)

    train_ds = MoneyPlantDataset(train_samples, transform=train_tf)
    val_ds = MoneyPlantDataset(val_samples, transform=eval_tf)
    test_ds = MoneyPlantDataset(test_samples, transform=eval_tf)

    train_loader = DataLoader(
        train_ds,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        pin_memory=True
    )

    val_loader = DataLoader(
        val_ds,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=True
    )

    test_loader = DataLoader(
        test_ds,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=True
    )

    meta = {
        "data_dir": root_dir,
        "num_classes": len(idx_to_class),
        "idx_to_class": idx_to_class,
        "class_to_idx": class_to_idx,
        "train_count": len(train_samples),
        "val_count": len(val_samples),
        "test_count": len(test_samples),
        "total_count": len(samples)
    }

    return train_loader, val_loader, test_loader, meta
