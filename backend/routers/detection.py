"""
Detection router: video upload pipeline + live frame analysis.
"""
import os
import uuid
import base64
import logging
from datetime import datetime
from typing import Optional

import numpy as np
import cv2
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import Incident, Evidence, Camera
from database.schemas import DetectionResult, LiveFrameResult
from ml.video_processor import (
    extract_frames, detect_accident_in_frames,
    extract_video_clip, generate_thumbnail, get_video_duration
)
from services.encryption_service import encrypt_video
from services.alert_service import send_accident_alert
from services.websocket_manager import manager
from config import settings

router = APIRouter(prefix="/api/detect", tags=["detection"])
logger = logging.getLogger(__name__)

# Track consecutive accident frames per camera for live detection
_consecutive_accident_frames: dict = {}


@router.post("/upload", response_model=DetectionResult)
async def upload_and_detect(
    file: UploadFile = File(...),
    camera_id: Optional[str] = Form(None),
    lat: Optional[float] = Form(None),
    lon: Optional[float] = Form(None),
    location_name: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """
    Upload a video file, run accident detection, classify severity,
    encrypt evidence, store metadata, and send SMS alert.
    """
    # ── 1. Save uploaded video to temp ──────────────────────────────────────
    temp_dir = os.path.join(settings.STORAGE_PATH, "temp")
    os.makedirs(temp_dir, exist_ok=True)
    temp_filename = f"{uuid.uuid4()}.mp4"
    temp_path = os.path.join(temp_dir, temp_filename)

    try:
        content = await file.read()
        with open(temp_path, "wb") as f:
            f.write(content)
        logger.info(f"[Detection] Saved upload to {temp_path} ({len(content)} bytes)")

        # ── 2. Extract frames & detect ───────────────────────────────────────
        frames = extract_frames(temp_path, fps=2)
        if not frames:
            raise HTTPException(status_code=400, detail="Could not extract frames from video.")

        detection = detect_accident_in_frames(frames, threshold=settings.MODEL_CONFIDENCE_THRESHOLD)

        if not detection["accident_found"]:
            return DetectionResult(
                accident_found=False,
                confidence=detection["max_confidence"],
                message="No accident detected in the uploaded video.",
            )

        # ── 3. Cut accident clip ─────────────────────────────────────────────
        clip_filename = f"clip_{uuid.uuid4()}.mp4"
        clip_path = os.path.join(temp_dir, clip_filename)
        extract_video_clip(
            temp_path,
            detection["start_time"],
            detection["end_time"],
            clip_path,
            padding=10.0,
        )

        # ── 4. Generate thumbnail ────────────────────────────────────────────
        thumb_dir = os.path.join(settings.STORAGE_PATH, "thumbnails")
        os.makedirs(thumb_dir, exist_ok=True)
        thumb_filename = f"thumb_{uuid.uuid4()}.jpg"
        thumb_path = os.path.join(thumb_dir, thumb_filename)
        if detection["best_frame"] is not None:
            generate_thumbnail(detection["best_frame"], thumb_path)

        # ── 5. Encrypt the clip ──────────────────────────────────────────────
        enc_dir = os.path.join(settings.STORAGE_PATH, "encrypted_videos")
        os.makedirs(enc_dir, exist_ok=True)
        enc_filename = f"evidence_{uuid.uuid4()}.enc"
        enc_path = os.path.join(enc_dir, enc_filename)

        source_for_encryption = clip_path if os.path.exists(clip_path) else temp_path
        enc_result = encrypt_video(source_for_encryption, enc_path)

        # ── 6. Get camera info ───────────────────────────────────────────────
        camera = None
        camera_name = "Uploaded Video"
        if camera_id:
            camera = db.query(Camera).filter(Camera.id == camera_id).first()
            if camera:
                camera_name = camera.name
                lat = lat or camera.latitude
                lon = lon or camera.longitude
                location_name = location_name or camera.location_name

        # ── 7. Create incident record ────────────────────────────────────────
        incident = Incident(
            camera_id=camera_id,
            accident_confidence=detection["max_confidence"],
            severity_level=detection["severity_level"],
            severity_label=detection["severity_label"],
            location_lat=lat,
            location_lon=lon,
            location_name=location_name or "Unknown",
            video_clip_path=enc_path,
            thumbnail_path=thumb_path if os.path.exists(thumb_path) else None,
            video_hash_sha256=enc_result["sha256_hash"],
            video_hash_md5=enc_result["md5_hash"],
            encryption_key_hash=enc_result["key_hash"],
            status="detected",
        )
        db.add(incident)
        db.flush()

        # ── 8. Create evidence record ────────────────────────────────────────
        duration = get_video_duration(source_for_encryption)
        file_size = os.path.getsize(enc_path)

        evidence = Evidence(
            incident_id=incident.id,
            original_filename=file.filename,
            encrypted_filename=enc_filename,
            file_size_bytes=file_size,
            duration_seconds=duration,
            sha256_hash=enc_result["sha256_hash"],
            md5_hash=enc_result["md5_hash"],
            encryption_algorithm="AES-256-CBC",
        )
        db.add(evidence)
        db.commit()
        db.refresh(incident)

        # ── 9. Send SMS alert ────────────────────────────────────────────────
        alert_result = send_accident_alert({
            "incident_id": incident.id,
            "timestamp": incident.timestamp,
            "severity_label": detection["severity_label"],
            "severity_level": detection["severity_level"],
            "location_name": location_name or "Unknown",
            "location_lat": lat,
            "location_lon": lon,
            "confidence": detection["max_confidence"],
            "camera_name": camera_name,
        })

        if alert_result.get("success"):
            incident.alert_sent = True
            incident.alert_sent_at = datetime.utcnow()
            incident.alert_message = alert_result.get("message", "")
            db.commit()

        # ── 10. Broadcast WebSocket event ────────────────────────────────────
        await manager.broadcast_accident({
            "incident_id": incident.id,
            "camera_id": camera_id,
            "severity": detection["severity_label"],
            "confidence": detection["max_confidence"],
            "timestamp": incident.timestamp.isoformat(),
            "location": location_name or "Unknown",
        })

        if alert_result.get("success"):
            await manager.broadcast_alert_sent({
                "incident_id": incident.id,
                "phone_number": settings.ALERT_TO_NUMBER,
                "timestamp": datetime.utcnow().isoformat(),
            })

        return DetectionResult(
            incident_id=incident.id,
            accident_found=True,
            confidence=detection["max_confidence"],
            severity_level=detection["severity_level"],
            severity_label=detection["severity_label"],
            video_hash_sha256=enc_result["sha256_hash"],
            video_hash_md5=enc_result["md5_hash"],
            alert_sent=alert_result.get("success", False),
            message=f"Accident detected with {detection['max_confidence']*100:.1f}% confidence. "
                    f"Severity: {detection['severity_label']}. Evidence encrypted and stored.",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Detection] Error processing upload: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")
    finally:
        # Clean up temp files
        for path in [temp_path, clip_path if 'clip_path' in locals() else None]:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except Exception:
                    pass


@router.post("/live-frame", response_model=LiveFrameResult)
async def analyze_live_frame(
    frame_b64: str = Form(...),
    camera_id: str = Form("default"),
    db: Session = Depends(get_db),
):
    """
    Analyze a single base64-encoded frame for accident detection.
    Triggers full incident creation after 3 consecutive positive frames.
    """
    try:
        img_data = base64.b64decode(frame_b64)
        nparr = np.frombuffer(img_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            raise HTTPException(status_code=400, detail="Invalid image data")

        from ml.video_processor import process_live_frame
        result = process_live_frame(frame)

        # Track consecutive detections
        if camera_id not in _consecutive_accident_frames:
            _consecutive_accident_frames[camera_id] = 0

        if result["accident_detected"] and result["confidence"] >= settings.MODEL_CONFIDENCE_THRESHOLD:
            _consecutive_accident_frames[camera_id] += 1
        else:
            _consecutive_accident_frames[camera_id] = 0

        severity_level = None
        severity_label = None

        if result["accident_detected"]:
            from ml.severity_classifier import predict_severity_from_array
            sev = predict_severity_from_array(frame)
            severity_level = sev["severity_level"]
            severity_label = sev["severity_label"]

        # Broadcast live update
        await manager.broadcast_detection_update(
            camera_id, result["confidence"], result["accident_detected"]
        )

        return LiveFrameResult(
            accident_detected=result["accident_detected"],
            confidence=result["confidence"],
            severity_level=severity_level,
            severity_label=severity_label,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[LiveFrame] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.websocket("/stream/{camera_id}")
async def websocket_stream(websocket: WebSocket, camera_id: str):
    """WebSocket endpoint for live feed processing."""
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            import json
            payload = json.loads(data)
            frame_b64 = payload.get("frame", "")

            if frame_b64:
                img_data = base64.b64decode(frame_b64)
                nparr = np.frombuffer(img_data, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

                if frame is not None:
                    from ml.video_processor import process_live_frame
                    result = process_live_frame(frame)
                    await manager.send_personal_message({
                        "type": "detection_result",
                        "camera_id": camera_id,
                        "accident_detected": result["accident_detected"],
                        "confidence": result["confidence"],
                    }, websocket)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
