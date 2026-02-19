"""
Train 3-class severity classifier.
Dataset: dataset/Severity Score Dataset with Labels/1/, /2/, /3/
Output: backend/ml/models/severity_classifier.pt
"""
import os
import sys
import shutil
import random
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
SEVERITY_DIR = BASE_DIR / "dataset" / "Severity Score Dataset with Labels"
OUTPUT_MODEL = BASE_DIR / "backend" / "ml" / "models" / "severity_classifier.pt"
YOLO_DATA_DIR = BASE_DIR / "training" / "yolo_severity_data"

IMG_SIZE = 224
EPOCHS = 50
BATCH_SIZE = 32
TRAIN_SPLIT = 0.8

CLASS_MAP = {"1": "Minor_Impact", "2": "Substantial_Impact", "3": "Critical_Impact"}
# Sample counts: 1874 / 2100 / 2217 — compute class weights
CLASS_COUNTS = [1874, 2100, 2217]


def prepare_yolo_dataset():
    print("📁 Preparing severity dataset...")
    for split in ["train", "val"]:
        for cls_name in CLASS_MAP.values():
            (YOLO_DATA_DIR / split / cls_name).mkdir(parents=True, exist_ok=True)

    for folder, cls_name in CLASS_MAP.items():
        src_dir = SEVERITY_DIR / folder
        if not src_dir.exists():
            print(f"⚠️  Missing: {src_dir}")
            continue
        images = list(src_dir.glob("*.jpg")) + list(src_dir.glob("*.png")) + list(src_dir.glob("*.jpeg"))
        random.shuffle(images)
        split_idx = int(len(images) * TRAIN_SPLIT)
        for img in images[:split_idx]:
            shutil.copy2(img, YOLO_DATA_DIR / "train" / cls_name / img.name)
        for img in images[split_idx:]:
            shutil.copy2(img, YOLO_DATA_DIR / "val" / cls_name / img.name)
        print(f"  Severity {folder} ({cls_name}): {split_idx} train, {len(images)-split_idx} val")

    print("✅ Severity dataset prepared!")


def train_with_yolo():
    from ultralytics import YOLO
    print("\n🚀 Training YOLOv8 severity classifier...")
    model = YOLO("yolov8n-cls.pt")
    results = model.train(
        data=str(YOLO_DATA_DIR),
        epochs=EPOCHS,
        imgsz=IMG_SIZE,
        batch=BATCH_SIZE,
        project=str(BASE_DIR / "training" / "runs"),
        name="severity_classifier",
        exist_ok=True,
        augment=True,
        fliplr=0.5,
        degrees=10,
        hsv_h=0.015,
        hsv_s=0.7,
        hsv_v=0.4,
        verbose=True,
    )
    best_model = BASE_DIR / "training" / "runs" / "severity_classifier" / "weights" / "best.pt"
    if best_model.exists():
        OUTPUT_MODEL.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(best_model, OUTPUT_MODEL)
        print(f"\n✅ Best severity model saved to: {OUTPUT_MODEL}")
    return results


def train_with_pytorch():
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torch.utils.data import DataLoader
    from torchvision import datasets, transforms, models
    from sklearn.metrics import classification_report, confusion_matrix
    import numpy as np

    print("\n🚀 Training PyTorch severity CNN...")

    train_transform = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(15),
        transforms.ColorJitter(brightness=0.4, contrast=0.4, saturation=0.2),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    val_transform = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    train_dataset = datasets.ImageFolder(str(YOLO_DATA_DIR / "train"), transform=train_transform)
    val_dataset = datasets.ImageFolder(str(YOLO_DATA_DIR / "val"), transform=val_transform)

    # Class weights to handle imbalance
    total = sum(CLASS_COUNTS)
    weights = torch.tensor([total / (3 * c) for c in CLASS_COUNTS], dtype=torch.float)

    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=2)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=2)

    print(f"Classes: {train_dataset.classes}")
    print(f"Class weights: {weights.tolist()}")

    model = models.mobilenet_v2(pretrained=True)
    model.classifier[1] = nn.Linear(model.last_channel, 3)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")
    model = model.to(device)
    weights = weights.to(device)

    criterion = nn.CrossEntropyLoss(weight=weights)
    optimizer = optim.Adam(model.parameters(), lr=1e-4)
    scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=10, gamma=0.5)

    best_val_acc = 0.0
    OUTPUT_MODEL.parent.mkdir(parents=True, exist_ok=True)
    cnn_path = str(OUTPUT_MODEL).replace(".pt", "_cnn.pt")

    for epoch in range(EPOCHS):
        model.train()
        train_correct = 0
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            train_correct += (outputs.argmax(1) == labels).sum().item()

        model.eval()
        val_correct, all_preds, all_labels = 0, [], []
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                preds = outputs.argmax(1)
                val_correct += (preds == labels).sum().item()
                all_preds.extend(preds.cpu().numpy())
                all_labels.extend(labels.cpu().numpy())

        train_acc = train_correct / len(train_dataset)
        val_acc = val_correct / len(val_dataset)
        scheduler.step()
        print(f"Epoch [{epoch+1}/{EPOCHS}] Train Acc: {train_acc:.4f} | Val Acc: {val_acc:.4f}")

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), cnn_path)
            print(f"  ✅ New best model saved! Val Acc: {val_acc:.4f}")

    print(f"\n📊 Classification Report:")
    print(classification_report(all_labels, all_preds, target_names=train_dataset.classes))
    print(f"\n📊 Confusion Matrix:")
    print(confusion_matrix(all_labels, all_preds))
    print(f"\n✅ Best severity CNN saved to: {cnn_path}")


if __name__ == "__main__":
    random.seed(42)

    if not SEVERITY_DIR.exists():
        print(f"❌ Severity dataset not found at {SEVERITY_DIR}")
        sys.exit(1)

    prepare_yolo_dataset()

    try:
        train_with_yolo()
    except ImportError:
        print("⚠️  ultralytics not installed, falling back to PyTorch CNN...")
        train_with_pytorch()
    except Exception as e:
        print(f"⚠️  YOLO training failed: {e}, falling back to PyTorch CNN...")
        train_with_pytorch()
