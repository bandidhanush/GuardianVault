"""
Video processing pipeline: frame extraction, accident detection, clip cutting, thumbnail generation.
"""
import os
import cv2
import numpy as np
from PIL import Image
from typing import List, Tuple, Optional
from config import settings


def extract_frames(video_path: str, fps: float = 2.0) -> List[Tuple[np.ndarray, float]]:
    """
    Extract frames from a video at the given fps rate.
    Returns list of (frame_bgr, timestamp_seconds).
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    video_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frame_interval = max(1, int(video_fps / fps))

    frames = []
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % frame_interval == 0:
            timestamp = frame_idx / video_fps
            frames.append((frame, timestamp))
        frame_idx += 1

    cap.release()
    return frames


def detect_accident_in_frames(
    frames: List[Tuple[np.ndarray, float]],
    threshold: float = None
) -> dict:
    """
    Run accident + severity detection on extracted frames.
    Returns comprehensive detection result.
    """
    from ml.accident_classifier import predict_accident_from_array
    from ml.severity_classifier import predict_severity_from_array

    if threshold is None:
        threshold = settings.MODEL_CONFIDENCE_THRESHOLD

    accident_frames = []
    all_confidences = []

    for frame, timestamp in frames:
        result = predict_accident_from_array(frame)
        confidence = result["confidence"] if result["is_accident"] else 1.0 - result["confidence"]
        all_confidences.append(result["confidence"] if result["is_accident"] else 0.0)

        if result["is_accident"] and result["confidence"] >= threshold:
            accident_frames.append({
                "frame": frame,
                "timestamp": timestamp,
                "confidence": result["confidence"],
            })

    if not accident_frames:
        return {
            "accident_found": False,
            "start_time": None,
            "end_time": None,
            "max_confidence": max(all_confidences) if all_confidences else 0.0,
            "severity_level": None,
            "severity_label": None,
            "accident_frames": [],
            "best_frame": None,
        }

    # Find the best frame (highest confidence)
    best = max(accident_frames, key=lambda x: x["confidence"])
    start_time = accident_frames[0]["timestamp"]
    end_time = accident_frames[-1]["timestamp"]

    # Run severity on best accident frame
    severity_result = predict_severity_from_array(best["frame"])

    return {
        "accident_found": True,
        "start_time": start_time,
        "end_time": end_time,
        "max_confidence": best["confidence"],
        "severity_level": severity_result["severity_level"],
        "severity_label": severity_result["severity_label"],
        "accident_frames": accident_frames,
        "best_frame": best["frame"],
    }


def extract_video_clip(
    video_path: str,
    start_time: float,
    end_time: float,
    output_path: str,
    padding: float = 10.0
) -> Optional[str]:
    """
    Cut a clip from video using FFmpeg for better browser compatibility.
    Adds padding seconds before and after the accident window.
    Uses -movflags +faststart for immediate web playback.
    """
    clip_start = max(0, start_time - padding)
    clip_end = end_time + padding
    duration = clip_end - clip_start

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Try FFmpeg first (faster and better for web)
    import subprocess
    try:
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(clip_start),
            "-i", video_path,
            "-t", str(duration),
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "23",
            "-c:a", "aac",
            "-movflags", "+faststart",
            output_path
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return output_path
    except Exception as e:
        print(f"[VideoProcessor] FFmpeg clip failed: {e}. Falling back to OpenCV...")

    # Fallback to OpenCV if FFmpeg fails
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None

    video_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    start_frame = int(clip_start * video_fps)
    end_frame = int(clip_end * video_fps)

    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(output_path, fourcc, video_fps, (width, height))

    frame_count = 0
    while cap.get(cv2.CAP_PROP_POS_FRAMES) <= end_frame:
        ret, frame = cap.read()
        if not ret: break
        out.write(frame)
        frame_count += 1

    cap.release()
    out.release()
    return output_path if frame_count > 0 else None


def process_live_frame(frame_bgr: np.ndarray) -> dict:
    """Single frame inference for live feed."""
    from ml.accident_classifier import predict_accident_from_array
    result = predict_accident_from_array(frame_bgr)
    return {
        "accident_detected": result["is_accident"],
        "confidence": result["confidence"],
        "class": result["class"],
    }


def generate_thumbnail(frame_bgr: np.ndarray, output_path: str) -> str:
    """Save a representative accident frame as JPEG thumbnail."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    # Add red border overlay to indicate accident
    h, w = frame_bgr.shape[:2]
    thumb = cv2.resize(frame_bgr, (640, 360))
    cv2.rectangle(thumb, (0, 0), (639, 359), (0, 0, 255), 6)
    cv2.putText(thumb, "ACCIDENT DETECTED", (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 2)
    cv2.imwrite(output_path, thumb, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return output_path


def get_video_duration(video_path: str) -> float:
    """Get video duration in seconds."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return 0.0
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
    cap.release()
    return frames / fps
