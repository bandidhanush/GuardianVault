"""
Severity Classifier - 3-class: Minor (1), Substantial (2), Critical (3)
"""
import os
import numpy as np
from PIL import Image
import torch
import torch.nn as nn
import torchvision.transforms as transforms
from config import settings


SEVERITY_CLASSES = {0: (1, "Minor Impact"), 1: (2, "Substantial Impact"), 2: (3, "Critical Impact")}

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


class SeverityCNN(nn.Module):
    def __init__(self, num_classes=3):
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


_severity_model = None
_use_yolo = False


def load_severity_model():
    global _severity_model, _use_yolo
    if _severity_model is not None:
        return _severity_model

    model_path = settings.SEVERITY_MODEL_PATH

    if os.path.exists(model_path):
        try:
            from ultralytics import YOLO
            _severity_model = YOLO(model_path)
            _use_yolo = True
            print(f"[SeverityClassifier] Loaded YOLO model from {model_path}")
            return _severity_model
        except Exception as e:
            print(f"[SeverityClassifier] YOLO load failed: {e}, trying PyTorch...")

    pt_path = model_path.replace(".pt", "_cnn.pt")
    model = SeverityCNN(num_classes=3)
    if os.path.exists(pt_path):
        model.load_state_dict(torch.load(pt_path, map_location="cpu"))
        print(f"[SeverityClassifier] Loaded CNN model from {pt_path}")
    else:
        print("[SeverityClassifier] WARNING: No trained model found. Using untrained CNN (demo mode).")

    model.eval()
    _severity_model = model
    _use_yolo = False
    return _severity_model


def predict_severity(image: Image.Image) -> dict:
    """
    Predict severity level of an accident image.
    Returns: {severity_level: int, severity_label: str, confidence: float}
    """
    model = load_severity_model()

    if _use_yolo:
        results = model(image, verbose=False)
        probs = results[0].probs
        class_idx = int(probs.top1)
        confidence = float(probs.top1conf)
        level, label = SEVERITY_CLASSES.get(class_idx, (2, "Substantial Impact"))
        return {"severity_level": level, "severity_label": label, "confidence": confidence}
    else:
        tensor = transform(image).unsqueeze(0)
        with torch.no_grad():
            logits = model(tensor)
            probs = torch.softmax(logits, dim=1)[0]
            class_idx = int(torch.argmax(probs))
            confidence = float(probs[class_idx])

        level, label = SEVERITY_CLASSES.get(class_idx, (2, "Substantial Impact"))
        return {"severity_level": level, "severity_label": label, "confidence": confidence}


def predict_severity_from_array(frame_bgr: np.ndarray) -> dict:
    import cv2
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    image = Image.fromarray(frame_rgb)
    return predict_severity(image)
