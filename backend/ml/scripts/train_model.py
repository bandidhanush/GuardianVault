import os
import shutil
import random
from ultralytics import YOLO
from pathlib import Path

# Paths
BASE_DIR = "/Users/dhanushbandi/Desktop/accident-detection-system"
DATASET_DIR = os.path.join(BASE_DIR, "dataset")
ML_DATASET_DIR = os.path.join(BASE_DIR, "ml_dataset")
ACCIDENT_SRC = os.path.join(DATASET_DIR, "Accident")
NON_ACCIDENT_SRC = os.path.join(DATASET_DIR, "NonAccident")
MODELS_DIR = os.path.join(BASE_DIR, "backend/ml/models")

def prepare_dataset():
    print("Preparing dataset layout...")
    if os.path.exists(ML_DATASET_DIR):
        print("Dataset already prepared, skipping copy.")
        return
    
    for split in ['train', 'val']:
        for cls in ['Accident', 'NonAccident']:
            os.makedirs(os.path.join(ML_DATASET_DIR, split, cls), exist_ok=True)

    # Split ratio
    split_ratio = 0.8

    for cls, src in [('Accident', ACCIDENT_SRC), ('NonAccident', NON_ACCIDENT_SRC)]:
        files = [f for f in os.listdir(src) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        random.shuffle(files)
        
        split_idx = int(len(files) * split_ratio)
        train_files = files[:split_idx]
        val_files = files[split_idx:]
        
        print(f"Copying {len(train_files)} training and {len(val_files)} validation images for {cls}...")
        for f in train_files:
            shutil.copy2(os.path.join(src, f), os.path.join(ML_DATASET_DIR, 'train', cls, f))
        for f in val_files:
            shutil.copy2(os.path.join(src, f), os.path.join(ML_DATASET_DIR, 'val', cls, f))

def train():
    print("Starting YOLOv8 training...")
    os.makedirs(MODELS_DIR, exist_ok=True)
    
    # Load base model
    model = YOLO('yolov8n-cls.pt')
    model.model.float()  # Force to float32
    
    # Set environment variables for MPS stability
    os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"

    # Train
    # We set val=False to avoid the MPS validation crash (bug in MPS Graph for NLLLoss)
    # We will run a final validation on CPU at the end.
    model.train(
        data=ML_DATASET_DIR,
        epochs=50,
        imgsz=224, 
        batch=16,
        project=os.path.join(BASE_DIR, 'runs'),
        name='accident_training',
        device='mps',
        exist_ok=True,
        amp=False,
        workers=0,
        val=False  # Skip validation during training to avoid crash
    )
    
    # Locate best or last model
    best_pt = os.path.join(BASE_DIR, 'runs', 'accident_training', 'weights', 'best.pt')
    last_pt = os.path.join(BASE_DIR, 'runs', 'accident_training', 'weights', 'last.pt')
    source_pt = best_pt if os.path.exists(best_pt) else last_pt
    target_pt = os.path.join(MODELS_DIR, "accident_classifier.pt")
    
    if os.path.exists(source_pt):
        shutil.copy2(source_pt, target_pt)
        print(f"Model saved to {target_pt}")
        
        # Final validation on CPU to get metrics without crashing
        print("Running final validation on CPU...")
        final_model = YOLO(target_pt)
        final_model.val(data=ML_DATASET_DIR, device='cpu')
        
        # Export to ONNX
        print("Exporting model to ONNX...")
        trained_model = YOLO(target_pt)
        trained_model.export(format='onnx')
        print(f"Model exported to {target_pt.replace('.pt', '.onnx')}")
    else:
        print("Error: best.pt not found after training!")

if __name__ == "__main__":
    prepare_dataset()
    train()
