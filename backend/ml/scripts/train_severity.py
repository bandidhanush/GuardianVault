import os
import shutil
import random
from ultralytics import YOLO
from pathlib import Path

# Paths
BASE_DIR = "/Users/dhanushbandi/Desktop/accident-detection-system"
DATASET_DIR = os.path.join(BASE_DIR, "dataset/Severity Score Dataset with Labels")
ML_DATASET_DIR = os.path.join(BASE_DIR, "ml_severity_dataset")
MODELS_DIR = os.path.join(BASE_DIR, "backend/ml/models")

def prepare_dataset():
    print("Preparing severity dataset layout...")
    if os.path.exists(ML_DATASET_DIR):
        print("Dataset already prepared, skipping copy.")
        return
    
    for split in ['train', 'val']:
        for cls in ['1', '2', '3']:
            os.makedirs(os.path.join(ML_DATASET_DIR, split, cls), exist_ok=True)

    # Split ratio
    split_ratio = 0.8

    for cls in ['1', '2', '3']:
        src = os.path.join(DATASET_DIR, cls)
        if not os.path.exists(src):
            print(f"Warning: Source directory {src} not found!")
            continue
            
        files = [f for f in os.listdir(src) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        random.shuffle(files)
        
        split_idx = int(len(files) * split_ratio)
        train_files = files[:split_idx]
        val_files = files[split_idx:]
        
        print(f"Copying {len(train_files)} training and {len(val_files)} validation images for Severity {cls}...")
        for f in train_files:
            shutil.copy2(os.path.join(src, f), os.path.join(ML_DATASET_DIR, 'train', cls, f))
        for f in val_files:
            shutil.copy2(os.path.join(src, f), os.path.join(ML_DATASET_DIR, 'val', cls, f))

def train():
    print("Starting YOLOv8 Severity training...")
    os.makedirs(MODELS_DIR, exist_ok=True)
    
    # Load base model
    model = YOLO('yolov8n-cls.pt')
    model.model.float()  # Force to float32 for MPS stability
    
    # Set environment variables for MPS stability
    os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"

    # Train
    # Using val=False to avoid the known MPS Graph crash on NLLLoss validation
    model.train(
        data=ML_DATASET_DIR,
        epochs=50,
        imgsz=224, 
        batch=16,
        project=os.path.join(BASE_DIR, 'runs'),
        name='severity_training',
        device='mps',
        exist_ok=True,
        amp=False,
        workers=0,
        val=False
    )
    
    # Locate best or last model
    best_pt = os.path.join(BASE_DIR, 'runs', 'severity_training', 'weights', 'best.pt')
    last_pt = os.path.join(BASE_DIR, 'runs', 'severity_training', 'weights', 'last.pt')
    source_pt = best_pt if os.path.exists(best_pt) else last_pt
    target_pt = os.path.join(MODELS_DIR, "severity_classifier.pt")
    
    if os.path.exists(source_pt):
        shutil.copy2(source_pt, target_pt)
        print(f"Model saved to {target_pt}")
        
        # Run final validation on CPU
        print("Running final validation on CPU...")
        final_model = YOLO(target_pt)
        final_model.val(data=ML_DATASET_DIR, device='cpu')
        
        # Export to ONNX
        print("Exporting model to ONNX...")
        final_model.export(format='onnx')
        print(f"Model exported to {target_pt.replace('.pt', '.onnx')}")
    else:
        print("Error: No weights found after training!")

if __name__ == "__main__":
    prepare_dataset()
    train()
