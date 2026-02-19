"""
Accident Binary Classifier - Inference wrapper.
Uses a trained YOLOv8 classification model.
Falls back to a simple CNN if the .pt file is not found.
"""
import os
import numpy as np
from PIL import Image
import torch
import torch.nn as nn
import torchvision.transforms as transforms
from config import settings


CLASSES = ["Accident", "NonAccident"]

# Image transform for inference
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


class SimpleCNN(nn.Module):
    """Fallback CNN if YOLO model not available."""
    def __init__(self, num_classes=2):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(64, 128, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(128, 256, 3, padding=1), nn.ReLU(), nn.AdaptiveAvgPool2d(4),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(256 * 4 * 4, 512), nn.ReLU(), nn.Dropout(0.5),
            nn.Linear(512, num_classes),
        )

    def forward(self, x):
        return self.classifier(self.features(x))


_accident_model = None
_use_yolo = False


def load_accident_model():
    global _accident_model, _use_yolo
    if _accident_model is not None:
        return _accident_model

    model_path = settings.ACCIDENT_MODEL_PATH

    if os.path.exists(model_path):
        try:
            from ultralytics import YOLO
            _accident_model = YOLO(model_path)
            _use_yolo = True
            print(f"[AccidentClassifier] Loaded YOLO model from {model_path}")
            return _accident_model
        except Exception as e:
            print(f"[AccidentClassifier] YOLO load failed: {e}, trying PyTorch...")

    # Try loading as PyTorch state dict
    pt_path = model_path.replace(".pt", "_cnn.pt")
    model = SimpleCNN(num_classes=2)
    if os.path.exists(pt_path):
        model.load_state_dict(torch.load(pt_path, map_location="cpu"))
        print(f"[AccidentClassifier] Loaded CNN model from {pt_path}")
    else:
        print("[AccidentClassifier] WARNING: No trained model found. Using untrained CNN (demo mode).")

    model.eval()
    _accident_model = model
    _use_yolo = False
    return _accident_model


def predict_accident(image: Image.Image) -> dict:
    """
    Predict if an image contains an accident.
    Returns: {class: str, confidence: float, is_accident: bool}
    """
    model = load_accident_model()

    if _use_yolo:
        results = model(image, verbose=False)
        probs = results[0].probs
        class_idx = int(probs.top1)
        confidence = float(probs.top1conf)
        class_name = CLASSES[class_idx] if class_idx < len(CLASSES) else results[0].names[class_idx]
        is_accident = class_name == "Accident"
        return {
            "class": class_name,
            "confidence": confidence,
            "is_accident": is_accident,
        }
    else:
        # PyTorch CNN inference
        tensor = transform(image).unsqueeze(0)
        with torch.no_grad():
            logits = model(tensor)
            probs = torch.softmax(logits, dim=1)[0]
            class_idx = int(torch.argmax(probs))
            confidence = float(probs[class_idx])

        class_name = CLASSES[class_idx]
        return {
            "class": class_name,
            "confidence": confidence,
            "is_accident": class_name == "Accident",
        }


def predict_accident_from_array(frame_bgr: np.ndarray) -> dict:
    """Predict from OpenCV BGR frame."""
    import cv2
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    image = Image.fromarray(frame_rgb)
    return predict_accident(image)
