"""
Train binary accident classifier using YOLOv8 classification.
Dataset: dataset/Accident/ and dataset/NonAccident/
Output: backend/ml/models/accident_classifier.pt
"""
import os
import sys
import shutil
import random
from pathlib import Path

# ── Configuration ─────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent.parent
DATASET_DIR = BASE_DIR / "dataset"
ACCIDENT_DIR = DATASET_DIR / "Accident"
NON_ACCIDENT_DIR = DATASET_DIR / "NonAccident"
OUTPUT_MODEL = BASE_DIR / "backend" / "ml" / "models" / "accident_classifier.pt"
YOLO_DATA_DIR = BASE_DIR / "training" / "yolo_accident_data"

IMG_SIZE = 224
EPOCHS = 50
BATCH_SIZE = 32
TRAIN_SPLIT = 0.8


def prepare_yolo_dataset():
    """Organize images into YOLO classification format: data/train/class/ and data/val/class/"""
    print("📁 Preparing dataset...")

    for split in ["train", "val"]:
        for cls in ["Accident", "NonAccident"]:
            (YOLO_DATA_DIR / split / cls).mkdir(parents=True, exist_ok=True)

    def copy_split(src_dir, class_name):
        images = list(src_dir.glob("*.jpg")) + list(src_dir.glob("*.png")) + list(src_dir.glob("*.jpeg"))
        random.shuffle(images)
        split_idx = int(len(images) * TRAIN_SPLIT)
        train_imgs = images[:split_idx]
        val_imgs = images[split_idx:]

        for img in train_imgs:
            shutil.copy2(img, YOLO_DATA_DIR / "train" / class_name / img.name)
        for img in val_imgs:
            shutil.copy2(img, YOLO_DATA_DIR / "val" / class_name / img.name)

        print(f"  {class_name}: {len(train_imgs)} train, {len(val_imgs)} val")

    copy_split(ACCIDENT_DIR, "Accident")
    copy_split(NON_ACCIDENT_DIR, "NonAccident")
    print("✅ Dataset prepared!")


def train_with_yolo():
    """Train using YOLOv8 classification."""
    from ultralytics import YOLO

    print("\n🚀 Training YOLOv8 classification model...")
    model = YOLO("yolov8n-cls.pt")  # Nano model for speed

    results = model.train(
        data=str(YOLO_DATA_DIR),
        epochs=EPOCHS,
        imgsz=IMG_SIZE,
        batch=BATCH_SIZE,
        project=str(BASE_DIR / "training" / "runs"),
        name="accident_classifier",
        exist_ok=True,
        augment=True,
        flipud=0.0,
        fliplr=0.5,
        degrees=10,
        hsv_h=0.015,
        hsv_s=0.7,
        hsv_v=0.4,
        verbose=True,
    )

    # Copy best model to backend
    best_model = BASE_DIR / "training" / "runs" / "accident_classifier" / "weights" / "best.pt"
    if best_model.exists():
        OUTPUT_MODEL.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(best_model, OUTPUT_MODEL)
        print(f"\n✅ Best model saved to: {OUTPUT_MODEL}")
    else:
        print(f"⚠️  Best model not found at {best_model}")

    return results


def train_with_pytorch():
    """Fallback: train a simple CNN with PyTorch."""
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torch.utils.data import DataLoader
    from torchvision import datasets, transforms, models
    from sklearn.metrics import classification_report, confusion_matrix
    import numpy as np

    print("\n🚀 Training PyTorch CNN model (fallback)...")

    train_transform = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(10),
        transforms.ColorJitter(brightness=0.3, contrast=0.3),
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

    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=2)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=2)

    print(f"Classes: {train_dataset.classes}")
    print(f"Train: {len(train_dataset)}, Val: {len(val_dataset)}")

    # Use MobileNetV2 for efficiency
    model = models.mobilenet_v2(pretrained=True)
    model.classifier[1] = nn.Linear(model.last_channel, 2)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")
    model = model.to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=1e-4)
    scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=10, gamma=0.5)

    best_val_acc = 0.0
    OUTPUT_MODEL.parent.mkdir(parents=True, exist_ok=True)
    cnn_path = str(OUTPUT_MODEL).replace(".pt", "_cnn.pt")

    for epoch in range(EPOCHS):
        model.train()
        train_loss, train_correct = 0.0, 0
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            train_loss += loss.item()
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

    print(f"\n📊 Final Classification Report:")
    print(classification_report(all_labels, all_preds, target_names=train_dataset.classes))
    print(f"\n📊 Confusion Matrix:")
    print(confusion_matrix(all_labels, all_preds))
    print(f"\n✅ Best CNN model saved to: {cnn_path}")


if __name__ == "__main__":
    random.seed(42)

    if not ACCIDENT_DIR.exists():
        print(f"❌ Dataset not found at {ACCIDENT_DIR}")
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
